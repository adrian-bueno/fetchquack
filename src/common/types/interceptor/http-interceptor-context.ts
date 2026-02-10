/**
 * Request context passed through the interceptor chain.
 *
 * Interceptors can read and modify any property to transform the request.
 * The final context is used to make the actual HTTP request.
 *
 * @example
 * ```typescript
 * const interceptor: HttpInterceptorFn = async (ctx, next) => {
 *   // Modify URL
 *   ctx.url = `https://api.example.com${ctx.url}`;
 *
 *   // Add header
 *   ctx.headers['X-Request-Id'] = generateId();
 *
 *   // Store data for later interceptors
 *   ctx.metadata = { startTime: Date.now() };
 *
 *   return next(ctx);
 * };
 * ```
 */
export interface HttpInterceptorContext {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  method: string;

  /** Full request URL */
  url: string;

  /** Request body - string, object (will be JSON-stringified), or null */
  body?: string | object | null;

  /** HTTP headers as key-value pairs */
  headers: Record<string, string>;

  /**
   * Custom metadata for passing data between interceptors.
   * Also used internally to flag request types:
   * - `streaming: true` - fetchStream/sse requests
   * - `sse: true` - SSE requests specifically
   */
  metadata?: Record<string, any>;
}
