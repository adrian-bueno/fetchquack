import { HttpInterceptorContext, HttpInterceptorFn, HttpInterceptorNext } from '../common';


/**
 * Configuration for the header interceptor.
 */
export interface HeaderInterceptorOptions {
  /** Headers to add to requests */
  headers: Record<string, string>;

  /** Optional filter to conditionally add headers */
  shouldAddHeaders?: (context: HttpInterceptorContext) => boolean;
}

/**
 * Creates an interceptor that adds custom headers to all requests.
 *
 * Useful for:
 * - API keys
 * - Correlation/request IDs
 * - Custom user agents
 * - Accept headers
 * - Content-Type defaults
 *
 * @param options - Headers to add and optional filter function
 * @returns Configured interceptor function
 *
 * @example
 * ```typescript
 * // Add static headers
 * const headers = headerInterceptor({
 *   headers: {
 *     'X-API-Version': '2.0',
 *     'X-Client-Id': 'my-app'
 *   }
 * });
 *
 * // Add headers conditionally
 * const headers = headerInterceptor({
 *   headers: {
 *     'X-Internal-Only': 'true'
 *   },
 *   shouldAddHeaders: (ctx) => ctx.url.includes('/internal/')
 * });
 *
 * // Combine with other interceptors
 * const client = new HttpClient({
 *   globalInterceptors: [
 *     headerInterceptor({ headers: { 'Accept': 'application/json' } }),
 *     authInterceptor({ getToken: () => token }),
 *     loggingInterceptor()
 *   ]
 * });
 * ```
 */
export function headerInterceptor(options: HeaderInterceptorOptions): HttpInterceptorFn {
  const shouldAddHeaders = options.shouldAddHeaders || (() => true);

  return async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
    // Merge custom headers into request if filter passes
    if (shouldAddHeaders(context)) {
      Object.assign(context.headers, options.headers);
    }

    return next(context);
  };
}
