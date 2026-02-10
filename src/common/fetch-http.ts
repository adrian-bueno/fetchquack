import { fetchWithProgress } from './fetch-with-progress';
import {
  executeFetch,
  ensureContentType,
  safeJsonParse,
  executeInterceptorChain,
} from './fetch-common';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpInterceptorContext,
  HttpError,
} from './types';


export interface FetchHttpOptions {
  /** Interceptors applied to requests made through this function */
  globalInterceptors?: Array<HttpInterceptorFn>;
}


/**
 * Sends a standard HTTP request and returns the response.
 *
 * This is a lower-level function. For most use cases, prefer using `HttpClient.fetch()`.
 *
 * **Response handling:**
 * - `parseJson: true` (default) → Response parsed as JSON
 * - `parseJson: false` → Response returned as string
 * - `decodeToString: false` → Response returned as Uint8Array
 *
 * **Progress tracking:**
 * Use `onUploadProgress` and `onDownloadProgress` callbacks to monitor transfer progress.
 * This uses XMLHttpRequest in browsers or ReadableStream in Node.js/Deno/Bun.
 *
 * @typeParam T - Expected type of the parsed JSON response
 * @param request - Request configuration
 * @param options - Global options including interceptors
 * @returns Promise resolving to the response data
 * @throws {HttpError} On HTTP errors (non-2xx status) or network failures
 * @throws {HttpJsonParseError} When JSON parsing fails
 *
 * @example
 * ```typescript
 * // Simple GET request
 * const data = await fetchHttp<User>({ method: 'GET', url: '/api/user' });
 *
 * // POST with progress
 * const result = await fetchHttp({
 *   method: 'POST',
 *   url: '/api/upload',
 *   body: largeData,
 *   onUploadProgress: (p) => console.log(`${p.percentage}%`)
 * });
 * ```
 */
export async function fetchHttp<T = any>(
  request: HttpRequest,
  options?: FetchHttpOptions
): Promise<T | string | Uint8Array> {
  const parseJson = request.parseJson ?? true;
  const decodeToString = request.decodeToString ?? true;
  const headers = { ...request.headers };

  // Auto-detect Content-Type based on body type if not explicitly set
  ensureContentType(headers, request.body ?? null);

  // Build the request context that will be passed through interceptors
  const context: HttpInterceptorContext = {
    method: request.method.toUpperCase(),
    url: request.url,
    body: request.body ?? null,
    headers,
    metadata: {},  // Can be used by interceptors to pass data
  };

  // Merge global and request-specific interceptors (global first)
  const interceptors = [
    ...(options?.globalInterceptors ?? []),
    ...(request.interceptors ?? []),
  ];

  try {
    // Progress tracking requires a different code path (XHR in browser, streams in Node)
    if (request.onUploadProgress || request.onDownloadProgress) {
      return await fetchWithProgress<T>(
        context,
        interceptors,
        parseJson,
        decodeToString,
        request.onUploadProgress,
        request.onDownloadProgress
      );
    }

    // Standard fetch path - uses native fetch API
    const signal = request.signal ?? new AbortController().signal;
    const response = await executeInterceptorChain(
      context,
      interceptors,
      (ctx) => executeFetch(ctx, signal)
    );

    if (!response.ok) {
      // Always consume error response body to prevent resource leaks
      // This is especially important for Deno which tracks resources strictly
      await response.response.text().catch(() => {});
      throw new HttpError(response.status, `HTTP error! status: ${response.status}`);
    }

    // Parse response based on configuration
    if (decodeToString) {
      const text = await response.response.text();
      return parseJson ? safeJsonParse<T>(text) : text;
    }

    // Binary response - return as Uint8Array for consistent cross-platform handling
    const buffer = await response.response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    // Re-throw HttpError as-is, wrap other errors
    if (error instanceof HttpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpError(0, `Fetch failed: ${message}`, error as Error);
  }
}
