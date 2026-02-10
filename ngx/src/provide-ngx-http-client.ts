import { EnvironmentProviders, Injector, makeEnvironmentProviders } from "@angular/core";
import { HttpClient, HttpClientOptions } from "fetchquack";

import { wrapInterceptorsNgContext } from "./wrap-interceptor-ng-context";


/**
 * Options for configuring the NgxHttpClient provider.
 *
 * Extends base HttpClientOptions - all options are passed through
 * to the underlying HttpClient instance.
 */
export interface ProvideNgxHttpClientOptions extends HttpClientOptions { }


/**
 * Provides the fetchquack HttpClient for Angular dependency injection.
 *
 * Call this in your application config to configure global interceptors
 * and make NgxHttpClient available throughout the application.
 *
 * Interceptors provided here will run in Angular's injection context,
 * allowing them to use `inject()` to access Angular services.
 *
 * @param options - Optional configuration including global interceptors
 * @returns EnvironmentProviders for Angular's provider array
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { ApplicationConfig } from '@angular/core';
 * import { provideNgxHttpClient, authInterceptor, loggingInterceptor } from 'fetchquack/ngx';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideNgxHttpClient({
 *       globalInterceptors: [
 *         authInterceptor({ getToken: () => inject(AuthService).getToken() }),
 *         loggingInterceptor({ prefix: '[API]' })
 *       ]
 *     })
 *   ]
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Using inject() in interceptor (runs in injection context)
 * const myInterceptor: HttpInterceptorFn = async (ctx, next) => {
 *   const config = inject(ConfigService);
 *   ctx.headers['X-Api-Version'] = config.apiVersion;
 *   return next(ctx);
 * };
 *
 * provideNgxHttpClient({
 *   globalInterceptors: [myInterceptor]
 * });
 * ```
 */
export function provideNgxHttpClient(options?: ProvideNgxHttpClientOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: HttpClient,
      useFactory: (injector: Injector) => {
        // Create HttpClient with interceptors wrapped for injection context
        return new HttpClient({
          ...options,
          globalInterceptors: wrapInterceptorsNgContext(options?.globalInterceptors, injector)
        });
      },
      deps: [Injector]
    }
  ]);
}
