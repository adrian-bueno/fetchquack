import { executeFetch, ensureContentType, executeInterceptorChain } from './fetch-common';
import { RetryPolicy, RETRY_DEFAULTS } from './retry-policy';
import { SseParser } from './sse-parser';
import { HttpInterceptorFn, HttpSseRequest, HttpInterceptorContext, HttpError, SseEvent } from './types';


export interface FetchSseOptions {
  /** Interceptors applied to SSE requests made through this function */
  globalInterceptors?: Array<HttpInterceptorFn>;
}


/**
 * Connects to a Server-Sent Events (SSE) endpoint.
 *
 * This is a lower-level function. For most use cases, prefer using `HttpClient.sse()`.
 *
 * Implements the SSE protocol (W3C EventSource) with additional features:
 * - Support for any HTTP method (not just GET like native EventSource)
 * - Request body support for POST/PUT endpoints
 * - Interceptor chain for authentication, logging, etc.
 * - Automatic reconnection with configurable exponential backoff
 * - Last-Event-ID tracking for resumable connections
 *
 * **SSE Event Format:**
 * ```
 * id: 123
 * event: message
 * data: {"text": "hello"}
 * retry: 5000
 * ```
 *
 * @typeParam T - Expected type of event data (when parseJson is true)
 * @param request - SSE request configuration
 * @param options - Global options including interceptors
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 *
 * fetchSse({
 *   method: 'GET',
 *   url: '/api/events',
 *   autoReconnect: true,
 *   parseJson: true,
 *   signal: controller.signal,
 *   onEvent: (event) => {
 *     console.log(`[${event.event}] ${event.id}: ${event.data}`);
 *   },
 *   onError: (error) => console.error(error),
 *   onComplete: () => console.log('Disconnected')
 * });
 *
 * // Close connection
 * controller.abort();
 * ```
 */
export function fetchSse<T = any>(
  request: HttpSseRequest,
  options?: FetchSseOptions
): void {
  // Parse configuration with defaults
  const parseJson = request.parseJson ?? false;
  const stripOptionalSpace = request.stripOptionalSpace ?? true;
  const autoReconnect = request.autoReconnect ?? false;

  // === Connection State ===
  // These variables maintain state across reconnection attempts
  let abortController: AbortController | null = null;
  let isAborted = false;  // True when user explicitly aborts
  let lastEventId = request.headers?.['Last-Event-ID'] ?? '';  // For resumable connections
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  // Initialize retry policy with exponential backoff
  // Uses jitter to prevent thundering herd when many clients reconnect simultaneously
  const retryPolicy = new RetryPolicy({
    maxRetries: request.retryPolicy?.maxRetries ?? 0,  // 0 = unlimited
    initialInterval: request.retryPolicy?.initialInterval ?? RETRY_DEFAULTS.INITIAL_INTERVAL,
    maxInterval: request.retryPolicy?.maxInterval ?? RETRY_DEFAULTS.MAX_INTERVAL,
    backoffMultiplier: request.retryPolicy?.backoffMultiplier ?? RETRY_DEFAULTS.BACKOFF_MULTIPLIER,
    jitter: request.retryPolicy?.jitter ?? 100,
  });

  // Listen to external abort signal (user's AbortController)
  request.signal?.addEventListener('abort', cleanup, { once: true });

  /**
   * Cleans up all resources and stops reconnection attempts.
   * Called when user aborts or when max retries exceeded.
   */
  function cleanup() {
    isAborted = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    // Cancel reader before aborting controller to prevent Deno resource leaks
    const reader = currentReader;
    currentReader = null;
    reader?.cancel().catch(() => {});
    abortController?.abort();
  }

  /**
   * Schedules a reconnection attempt after the appropriate delay.
   * Respects max retries and uses exponential backoff with jitter.
   */
  function scheduleReconnect() {
    if (isAborted || !autoReconnect) return;

    if (!retryPolicy.shouldRetry()) {
      request.onError?.(new HttpError(0, `Maximum retry attempts (${retryPolicy.getRetryCount()}) reached`));
      request.onComplete?.();
      return;
    }

    retryTimer = setTimeout(connect, retryPolicy.getNextInterval());
  }

  /**
   * Establishes connection to the SSE endpoint.
   * Called initially and on each reconnection attempt.
   */
  function connect() {
    if (isAborted) return;

    // Abort previous connection attempt if still pending
    abortController?.abort();
    abortController = new AbortController();

    // Build headers with SSE-specific values
    const headers = { ...request.headers };
    // Send Last-Event-ID for resumable connections
    if (lastEventId) headers['Last-Event-ID'] = lastEventId;
    ensureContentType(headers, request.body ?? null);
    // Request SSE content type
    if (!headers['Accept'] && !headers['accept']) headers['Accept'] = 'text/event-stream';

    const context: HttpInterceptorContext = {
      method: request.method.toUpperCase(),
      url: request.url,
      body: request.body ?? null,
      headers,
      metadata: { streaming: true, sse: true },  // Flags for interceptors
    };

    const interceptors = [
      ...(options?.globalInterceptors ?? []),
      ...(request.interceptors ?? []),
    ];

    // Execute request through interceptor chain
    executeInterceptorChain(context, interceptors, (ctx) => executeFetch(ctx, abortController!))
      .then((response) => {
        // Check if aborted while waiting for response
        if (isAborted) {
          response.response.body?.cancel().catch(() => {});
          return;
        }

        // Handle HTTP errors
        if (!response.ok) {
          response.response.body?.cancel().catch(() => {});
          // 204 No Content = server intentionally closed, don't reconnect
          if (response.status === 204) {
            request.onComplete?.();
            return;
          }
          request.onError?.(new HttpError(response.status, `HTTP error! status: ${response.status}`));
          scheduleReconnect();
          return;
        }

        // Validate Content-Type per SSE spec
        const contentType = response.headers.get('Content-Type');
        if (contentType && !contentType.toLowerCase().includes('text/event-stream')) {
          response.response.body?.cancel().catch(() => {});
          request.onError?.(new HttpError(0, `Invalid Content-Type for SSE: ${contentType}`));
          // Per SSE spec: wrong content-type = fail without retry
          request.onComplete?.();
          return;
        }

        if (!response.response.body) {
          request.onError?.(new HttpError(0, 'No response body'));
          scheduleReconnect();
          return;
        }

        // Connection successful - reset retry counter
        retryPolicy.reset();
        currentReader = response.response.body.getReader();

        // Start parsing SSE events from the stream
        readSseStream<T>(
          currentReader,
          { parseJson, stripOptionalSpace },
          (event) => {
            // Track event ID for resumable connections
            if (event.id) lastEventId = event.id;
            // Server can override retry interval
            if (event.retry !== undefined) retryPolicy.setCustomInterval(event.retry);
            request.onEvent?.(event);
          },
          (error) => {
            currentReader = null;
            if (isAborted) return;
            request.onError?.(error);
            scheduleReconnect();
          },
          () => {
            // Stream ended normally - server closed connection
            currentReader = null;
            if (isAborted) return;
            scheduleReconnect();
          }
        );
      })
      .catch((error) => {
        if (isAborted || error.name === 'AbortError') return;
        const httpError = error instanceof HttpError
          ? error
          : new HttpError(0, `Fetch failed: ${error.message}`, error);
        request.onError?.(httpError);
        scheduleReconnect();
      });
  }

  // Start initial connection
  connect();
}


/**
 * Reads and parses an SSE stream using the SseParser.
 *
 * Feeds raw bytes to the parser which handles:
 * - Line-based parsing per SSE spec
 * - Field extraction (event, data, id, retry)
 * - Multi-line data concatenation
 * - Optional JSON parsing of data field
 *
 * @param reader - Stream reader to read from
 * @param config - Parser configuration
 * @param onEvent - Called for each complete event
 * @param onError - Called on stream read errors
 * @param onComplete - Called when stream ends
 */
function readSseStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  config: { parseJson: boolean; stripOptionalSpace: boolean },
  onEvent: (event: SseEvent<T>) => void,
  onError: (error: Error) => void,
  onComplete: () => void
): void {
  const parser = new SseParser<T>(config);
  parser.onEvent = onEvent;

  /**
   * Recursively reads chunks from the stream and feeds them to the parser.
   * Each chunk may contain partial events, complete events, or multiple events.
   */
  function read() {
    reader
      .read()
      .then(({ done, value }) => {
        if (done) {
          // Stream ended - flush any remaining buffered data
          parser.finish();
          onComplete();
          return;
        }
        // Feed bytes to parser - it will emit events via onEvent callback
        parser.feedBytes(value);
        read();  // Continue reading
      })
      .catch((error) => {
        onError(new HttpError(0, 'Stream read failed', error));
      });
  }

  read();
}
