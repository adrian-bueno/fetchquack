import {
  executeFetch,
  ensureContentType,
  executeInterceptorChain,
} from './fetch-common';
import {
  HttpInterceptorFn,
  HttpStreamRequest,
  HttpInterceptorContext,
  HttpError,
} from './types';


/**
 * Options for the {@link fetchHttpStream} function.
 */
export interface FetchHttpStreamOptions {
  /** Interceptors applied to all requests made through this function */
  globalInterceptors?: Array<HttpInterceptorFn>;
}


/**
 * Sends an HTTP request and streams the response body as chunks.
 *
 * This is a lower-level function. For most use cases, prefer using `HttpClient.fetchStream()`.
 *
 * Unlike `fetchHttp()`, this function is callback-based and processes data as it arrives,
 * making it suitable for large responses or real-time data processing.
 *
 * **Chunk types:**
 * - `decodeToString: true` → Chunks delivered as strings (UTF-8 decoded)
 * - `decodeToString: false` (default) → Chunks delivered as Uint8Array
 *
 * @param request - Request configuration with streaming callbacks
 * @param options - Global options including interceptors
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 *
 * fetchHttpStream({
 *   method: 'GET',
 *   url: '/api/stream',
 *   decodeToString: true,
 *   signal: controller.signal,
 *   onData: (chunk) => process(chunk),
 *   onComplete: () => console.log('Done'),
 *   onError: (err) => console.error(err)
 * });
 * ```
 */
export function fetchHttpStream(
  request: HttpStreamRequest,
  options?: FetchHttpStreamOptions
): void {
  const headers = { ...request.headers };
  ensureContentType(headers, request.body ?? null);

  // Build request context for the interceptor chain
  const context: HttpInterceptorContext = {
    method: request.method.toUpperCase(),
    url: request.url,
    body: request.body ?? null,
    headers,
    metadata: { streaming: true },  // Flag for interceptors to detect streaming requests
  };

  const interceptors = [
    ...(options?.globalInterceptors ?? []),
    ...(request.interceptors ?? []),
  ];

  const signal = request.signal ?? new AbortController().signal;

  // Execute interceptor chain and handle response
  executeInterceptorChain(context, interceptors, (ctx) => executeFetch(ctx, signal))
    .then((response) => {
      if (!response.ok) {
        request.onError?.(new HttpError(response.status, `HTTP error! status: ${response.status}`));
        return;
      }
      if (!response.response.body) {
        request.onError?.(new HttpError(0, 'No response body'));
        return;
      }

      // Create decoder only if string output is requested (saves memory for binary)
      const reader = response.response.body.getReader();
      const decoder = request.decodeToString ? new TextDecoder() : null;

      // Start recursive chunk reading
      readStream(reader, decoder, request.onData as any, request.onError, request.onComplete);
    })
    .catch((error) => {
      // AbortError is expected when user cancels - don't report as error
      if (error.name === 'AbortError') return;
      const httpError = error instanceof HttpError
        ? error
        : new HttpError(0, `Fetch failed: ${error.message}`, error);
      request.onError?.(httpError);
    });
}


/**
 * Recursively reads chunks from a ReadableStream.
 *
 * This function reads one chunk at a time and calls itself to continue reading.
 * Recursion is safe here because each iteration is async and doesn't grow the call stack.
 *
 * @param reader - The stream reader to read from
 * @param decoder - TextDecoder for string output, or null for binary
 * @param onData - Callback for each chunk received
 * @param onError - Callback for errors
 * @param onComplete - Callback when stream ends
 */
function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder | null,
  onData?: (chunk: Uint8Array | string) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void
): void {
  reader
    .read()
    .then(({ done, value }) => {
      if (done) {
        onComplete?.();
        return;
      }

      if (decoder) {
        onData?.(decoder.decode(value, { stream: true }));
      } else {
        onData?.(value);
      }

      readStream(reader, decoder, onData, onError, onComplete);
    })
    .catch((error) => {
      reader.cancel().catch(() => {}); // Prevent resource leaks
      onError?.(new HttpError(0, 'Stream read failed', error));
    });
}
