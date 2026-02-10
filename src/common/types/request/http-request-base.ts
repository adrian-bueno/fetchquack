import { HttpInterceptorFn } from "../interceptor";

/**
 * Base configuration shared by all HTTP request types.
 *
 * Extended by:
 * - {@link HttpRequest} - Standard requests (fetch)
 * - {@link HttpStreamRequest} - Streaming requests (fetchStream)
 * - {@link HttpSseRequest} - Server-Sent Events (sse)
 *
 * @example
 * ```typescript
 * const baseConfig: HttpRequestBase = {
 *   method: 'POST',
 *   url: 'https://api.example.com/data',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: { key: 'value' },
 *   interceptors: [loggingInterceptor, authInterceptor],
 *   signal: abortController.signal
 * };
 * ```
 */
export interface HttpRequestBase {
  /** HTTP method: 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', etc. */
  method: string;

  /** Full URL or path (interceptors can transform relative to absolute) */
  url: string;

  /** Request body - strings sent as-is, objects JSON-stringified automatically */
  body?: any;

  /** HTTP headers as key-value pairs */
  headers?: Record<string, string>;

  /** Interceptor chain to process request/response */
  interceptors?: HttpInterceptorFn[];

  /** AbortSignal to cancel in-flight requests */
  signal?: AbortSignal;
}
