import { HttpInterceptorContext, HttpInterceptorFn, HttpInterceptorNext } from '../common';


/**
 * Configuration for the authentication interceptor.
 *
 * @example
 * ```typescript
 * const options: AuthInterceptorOptions = {
 *   getToken: () => localStorage.getItem('authToken'),
 *   headerName: 'Authorization',
 *   tokenPrefix: 'Bearer ',
 *   shouldSkipAuth: (ctx) => ctx.url.includes('/public/')
 * };
 * ```
 */
export interface AuthInterceptorOptions {
  /**
   * Token provider function. Can be sync or async.
   * Return null to skip adding auth header.
   */
  getToken: () => string | null | Promise<string | null>;

  /** Header name for the token. @default 'Authorization' */
  headerName?: string;

  /** Prefix before token value. @default 'Bearer ' */
  tokenPrefix?: string;

  /** Filter to skip auth for certain requests (e.g., public endpoints) */
  shouldSkipAuth?: (context: HttpInterceptorContext) => boolean;
}

/**
 * Creates an interceptor that adds authentication tokens to requests.
 *
 * Supports JWT, API keys, and custom auth schemes.
 * Token can be retrieved synchronously (localStorage) or asynchronously
 * (refresh token flow, secure storage).
 *
 * @param options - Configuration including token provider and header settings
 * @returns Configured interceptor function
 *
 * @example
 * ```typescript
 * // Basic JWT auth from localStorage
 * const auth = authInterceptor({
 *   getToken: () => localStorage.getItem('jwt')
 * });
 *
 * // Async token with refresh
 * const auth = authInterceptor({
 *   getToken: async () => {
 *     const token = await tokenService.getValidToken();
 *     return token;
 *   }
 * });
 *
 * // API key auth
 * const auth = authInterceptor({
 *   getToken: () => API_KEY,
 *   headerName: 'X-API-Key',
 *   tokenPrefix: ''  // No prefix for API keys
 * });
 *
 * // Skip auth for public endpoints
 * const auth = authInterceptor({
 *   getToken: () => getToken(),
 *   shouldSkipAuth: (ctx) => ctx.url.startsWith('/api/public')
 * });
 * ```
 */
export function authInterceptor(options: AuthInterceptorOptions): HttpInterceptorFn {
  const headerName = options.headerName || 'Authorization';
  const tokenPrefix = options.tokenPrefix ?? 'Bearer ';
  const shouldSkipAuth = options.shouldSkipAuth || (() => false);

  return async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
    // Skip auth for filtered requests (public endpoints, etc.)
    if (shouldSkipAuth(context)) {
      return next(context);
    }

    // Get token - supports both sync and async providers
    const token = await options.getToken();

    if (token) {
      context.headers[headerName] = `${tokenPrefix}${token}`;
    }

    return next(context);
  };
}
