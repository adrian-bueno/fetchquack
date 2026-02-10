import { Injector, runInInjectionContext } from "@angular/core";
import { HttpInterceptorFn, HttpInterceptorContext, HttpInterceptorNext } from "fetchquack";


/**
 * Wraps interceptor functions to execute within Angular's injection context.
 *
 * This enables interceptors to use Angular's `inject()` function to access
 * services, configs, and other injectables - just like Angular's built-in
 * HTTP interceptors.
 *
 * @param interceptors - Array of interceptor functions to wrap
 * @param injector - Angular Injector instance for the injection context
 * @returns Wrapped interceptors that run in injection context
 *
 * @example
 * ```typescript
 * // Interceptor using inject() - works because of this wrapper
 * const authInterceptor: HttpInterceptorFn = async (ctx, next) => {
 *   const auth = inject(AuthService);  // ✓ Works!
 *   const token = await auth.getToken();
 *   ctx.headers['Authorization'] = `Bearer ${token}`;
 *   return next(ctx);
 * };
 * ```
 *
 * @internal Used by NgxHttpClient and provideNgxHttpClient
 */
export function wrapInterceptorsNgContext(
  interceptors: HttpInterceptorFn[] | undefined,
  injector: Injector
): HttpInterceptorFn[] {
  // Return empty array if no interceptors provided
  if (!interceptors || interceptors.length === 0) {
    return [];
  }

  // Wrap each interceptor to run in Angular's injection context
  return interceptors.map(interceptor => {
    return (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
      // runInInjectionContext enables inject() calls within the interceptor
      return runInInjectionContext(injector, () => interceptor(context, next));
    };
  });
}
