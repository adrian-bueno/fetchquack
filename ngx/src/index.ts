/**
 * Angular integration for fetchquack library.
 *
 * Provides RxJS Observable-based API for HTTP, streaming, and SSE requests
 * with full Angular dependency injection support.
 *
 * @example
 * ```typescript
 * // In app.config.ts
 * import { provideNgxHttpClient } from 'fetchquack/ngx';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideNgxHttpClient({
 *       globalInterceptors: [loggingInterceptor()]
 *     })
 *   ]
 * };
 *
 * // In a component or service
 * import { NgxHttpClient } from 'fetchquack/ngx';
 *
 * @Component({ ... })
 * export class MyComponent {
 *   private http = inject(NgxHttpClient);
 *
 *   getData() {
 *     return this.http.fetch<User>({
 *       method: 'GET',
 *       url: '/api/users/1',
 *       returnObservable: true
 *     });
 *   }
 *
 *   streamChat(prompt: string) {
 *     return this.http.fetchStream({
 *       method: 'POST',
 *       url: '/api/chat',
 *       body: { prompt },
 *       decodeToString: true
 *     });
 *   }
 *
 *   subscribeEvents() {
 *     return this.http.sse<Notification>({
 *       method: 'GET',
 *       url: '/api/events',
 *       parseJson: true
 *     });
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */
export * from './ngx-http-client';
export * from './ngx-http-request';
export * from './provide-ngx-http-client';

