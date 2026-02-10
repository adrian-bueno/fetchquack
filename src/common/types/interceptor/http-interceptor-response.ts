/**
 * Response object passed through the interceptor chain.
 *
 * Wraps the native Fetch Response with convenient properties
 * for interceptors to inspect and act upon.
 *
 * @example
 * ```typescript
 * const interceptor: HttpInterceptorFn = async (ctx, next) => {
 *   const response = await next(ctx);
 *
 *   // Check status
 *   if (!response.ok) {
 *     console.error(`Request failed: ${response.status} ${response.statusText}`);
 *   }
 *
 *   // Read headers
 *   const contentType = response.headers.get('Content-Type');
 *
 *   // Access original Response for body reading
 *   // (only in final handler - body can only be read once)
 *   const data = await response.response.json();
 *
 *   return response;
 * };
 * ```
 */
export interface HttpInterceptorResponse {
  /** HTTP status code (200, 404, 500, etc.) */
  status: number;

  /** HTTP status text ("OK", "Not Found", etc.) */
  statusText: string;

  /** Response headers */
  headers: Headers;

  /** True if status is in 200-299 range */
  ok: boolean;

  /** Original Fetch Response (for body access) */
  response: Response;
}
