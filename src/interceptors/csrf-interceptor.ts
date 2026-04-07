import {
  HttpInterceptorContext,
  HttpInterceptorFn,
  HttpInterceptorNext,
  HttpInterceptorResponse
} from '../common';


/**
 * Reads CSRF token from browser cookies.
 * @internal
 */
function getTokenFromCookie(cookieName: string): string | null {
  // Not available in server environments
  if (typeof document === 'undefined') {
    return null;
  }

  // Parse cookies to find the CSRF token
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmedCookie = cookie.trim();
    const separatorIndex = trimmedCookie.indexOf('=');
    if (separatorIndex === -1) continue;

    const name = trimmedCookie.slice(0, separatorIndex);
    const value = trimmedCookie.slice(separatorIndex + 1);

    if (name === cookieName) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Configuration for CSRF protection interceptor.
 */
export interface CsrfInterceptorOptions {
  /** Cookie name containing CSRF token. @default 'XSRF-TOKEN' */
  cookieName?: string;

  /** Header name to send token in. @default 'X-XSRF-TOKEN' */
  headerName?: string;

  /** Methods requiring CSRF protection. @default ['POST', 'PUT', 'PATCH', 'DELETE'] */
  protectedMethods?: string[];
}

/**
 * @deprecated Use {@link CsrfInterceptorOptions} instead.
 */
export type CsrfInterceptorConfig = CsrfInterceptorOptions;

/**
 * Creates a CSRF protection interceptor for browser environments.
 *
 * Automatically reads CSRF tokens from cookies and adds them as headers
 * to state-changing requests. Compatible with backend frameworks like:
 * - Spring Security (XSRF-TOKEN/X-XSRF-TOKEN)
 * - Django (csrftoken/X-CSRFToken)
 * - Express csurf middleware
 *
 * **Note:** Only works in browser environments where `document.cookie` is available.
 *
 * @param options - Optional configuration for cookie/header names
 * @returns Configured interceptor function
 *
 * @example
 * ```typescript
 * // Default config (Spring Security compatible)
 * const csrf = csrfInterceptor();
 *
 * // Django configuration
 * const csrf = csrfInterceptor({
 *   cookieName: 'csrftoken',
 *   headerName: 'X-CSRFToken'
 * });
 *
 * // Use in client
 * const client = new HttpClient({
 *   globalInterceptors: [csrfInterceptor()]
 * });
 * ```
 */
export function csrfInterceptor(options?: CsrfInterceptorOptions): HttpInterceptorFn {
  const cookieName = options?.cookieName ?? 'XSRF-TOKEN';
  const headerName = options?.headerName ?? 'X-XSRF-TOKEN';
  const protectedMethods = options?.protectedMethods ?? ['POST', 'PUT', 'PATCH', 'DELETE'];

  return async (ctx: HttpInterceptorContext, next: HttpInterceptorNext): Promise<HttpInterceptorResponse> => {
    // Only add CSRF token for state-changing methods
    if (protectedMethods.includes(ctx.method.toUpperCase())) {
      const token = getTokenFromCookie(cookieName);

      // Add token if found and header not already set
      if (token && !ctx.headers[headerName] && !ctx.headers[headerName.toLowerCase()]) {
        ctx.headers[headerName] = token;
      }
    }

    return next(ctx);
  };
}
