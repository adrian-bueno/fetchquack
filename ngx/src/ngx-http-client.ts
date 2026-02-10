import { inject, Injectable, Injector } from "@angular/core";
import { Observable } from "rxjs";
import { HttpClient, SseEvent } from "fetchquack";

import { wrapInterceptorsNgContext } from "./wrap-interceptor-ng-context";
import {
  NgxHttpRequest,
  NgxHttpRequestObservable,
  NgxHttpSseRequest,
  NgxHttpStreamRequest,
  NgxHttpStreamRequestBinary,
  NgxHttpStreamRequestString
} from "./ngx-http-request";


/**
 * Angular HTTP client with RxJS Observable support for streaming and SSE.
 *
 * Wraps the base `HttpClient` to provide Angular-idiomatic APIs:
 * - Observable-based responses with automatic cleanup on unsubscribe
 * - Interceptors run in Angular's injection context (can use `inject()`)
 * - Automatic AbortController management tied to Observable lifecycle
 *
 * **Injection:** Available as a root-level injectable service.
 *
 * @example
 * // In a component
 * private http = inject(NgxHttpClient);
 *
 * // Observable-based fetch
 * user$ = this.http.fetch<User>({
 *   method: 'GET',
 *   url: '/api/user',
 *   returnObservable: true
 * });
 *
 * @example
 * // Promise-based fetch
 * async loadData() {
 *   const data = await this.http.fetch({ method: 'GET', url: '/api/data' });
 * }
 *
 * @example
 * // Streaming with automatic cleanup
 * streamResponse() {
 *   return this.http.fetchStream({
 *     method: 'POST',
 *     url: '/api/stream',
 *     decodeToString: true
 *   }).pipe(takeUntilDestroyed());
 * }
 */
@Injectable({ providedIn: 'root' })
export class NgxHttpClient {

  /** Base HTTP client instance (injected or created) */
  private readonly httpClient = inject(HttpClient, { optional: true }) ?? new HttpClient();

  /** Angular injector for running interceptors in injection context */
  private readonly injector = inject(Injector);

  /**
   * Makes an HTTP request and returns the complete response body.
   *
   * Supports both Promise and Observable return types:
   * - `returnObservable: true` - Returns Observable with automatic abort on unsubscribe
   * - `returnObservable: false` (default) - Returns Promise, user manages AbortSignal
   *
   * @example
   * // Observable (auto-managed lifecycle)
   * this.http.fetch<User>({
   *   method: 'GET',
   *   url: '/api/user',
   *   returnObservable: true
   * }).subscribe(user => console.log(user));
   *
   * @example
   * // Promise with manual abort
   * const ctrl = new AbortController();
   * const user = await this.http.fetch<User>({
   *   method: 'GET',
   *   url: '/api/user',
   *   signal: ctrl.signal
   * });
   *
   * @example
   * // Binary response
   * this.http.fetch({
   *   method: 'GET',
   *   url: '/api/image.png',
   *   decodeToString: false,
   *   returnObservable: true
   * }).subscribe(bytes => processImage(bytes));
   */
  fetch(request: NgxHttpRequestObservable & { decodeToString: false; returnObservable: true }): Observable<Uint8Array>;
  fetch(request: NgxHttpRequest & { decodeToString: false; returnObservable?: false }): Promise<Uint8Array>;
  fetch(request: NgxHttpRequestObservable & { parseJson: false; decodeToString?: true; returnObservable: true }): Observable<string>;
  fetch(request: NgxHttpRequest & { parseJson: false; decodeToString?: true; returnObservable?: false }): Promise<string>;
  fetch<T = any>(request: NgxHttpRequestObservable & { parseJson?: true; decodeToString?: true; returnObservable: true }): Observable<T>;
  fetch<T = any>(request: NgxHttpRequest & { parseJson?: true; decodeToString?: true; returnObservable?: false }): Promise<T>;
  fetch<T = any>(request: (NgxHttpRequest | NgxHttpRequestObservable) & { returnObservable?: boolean }): Promise<T | string | Uint8Array> | Observable<T | string | Uint8Array> {
    // Wrap interceptors to run in Angular injection context
    const wrappedRequest = {
      ...request,
      interceptors: wrapInterceptorsNgContext(request.interceptors, this.injector)
    };

    // Observable mode: manage AbortController internally
    if (request.returnObservable) {
      return new Observable<T | string | Uint8Array>(observer => {
        const abortController = new AbortController();

        this.httpClient.fetch({ ...wrappedRequest, signal: abortController.signal } as any)
          .then((result: T | string | Uint8Array) => {
            observer.next(result);
            observer.complete();
          })
          .catch((error: any) => {
            observer.error(error);
          });

        // Cleanup: abort request when Observable unsubscribed
        return () => abortController.abort();
      });
    }

    // Promise mode: pass through to base client
    return this.httpClient.fetch(wrappedRequest as any) as Promise<T | string | Uint8Array>;
  }

  /**
   * Streams HTTP response body as Observable of chunks.
   *
   * Automatically manages AbortController - request is cancelled when
   * the Observable subscription is disposed (unsubscribed).
   *
   * @example
   * // Text streaming (AI chat, logs)
   * this.http.fetchStream({
   *   method: 'POST',
   *   url: '/api/chat',
   *   body: { prompt: 'Hello' },
   *   decodeToString: true
   * }).subscribe({
   *   next: (text) => this.output += text,
   *   complete: () => console.log('Stream complete')
   * });
   *
   * @example
   * // Binary streaming (file download)
   * this.http.fetchStream({
   *   method: 'GET',
   *   url: '/api/file.bin',
   *   decodeToString: false
   * }).subscribe(chunk => writer.write(chunk));
   *
   * @param request - Stream request configuration
   * @returns Observable emitting chunks (Uint8Array or string based on decodeToString)
   */
  fetchStream(request: NgxHttpStreamRequestBinary): Observable<Uint8Array>;
  fetchStream(request: NgxHttpStreamRequestString): Observable<string>;
  fetchStream(request: NgxHttpStreamRequest): Observable<Uint8Array | string> {
    return new Observable<Uint8Array | string>(observer => {
      const abortController = new AbortController();

      // Delegate to base client with Observable callbacks
      this.httpClient.fetchStream({
        ...request,
        signal: abortController.signal,
        interceptors: wrapInterceptorsNgContext(request.interceptors, this.injector),
        onData: (chunk: Uint8Array | string) => observer.next(chunk),
        onError: (error: Error) => observer.error(error),
        onComplete: () => observer.complete(),
      } as any);

      // Cleanup: abort stream when Observable unsubscribed
      return () => abortController.abort();
    });
  }

  /**
   * Connects to a Server-Sent Events endpoint and returns an Observable of events.
   *
   * Automatically manages AbortController - connection is closed when
   * the Observable subscription is disposed (unsubscribed).
   *
   * **Note:** Auto-reconnect is handled internally by the base client.
   * The Observable will continue emitting events across reconnections
   * until explicitly unsubscribed or max retries exceeded.
   *
   * @typeParam T - Type of parsed event data
   * @param request - SSE request configuration
   * @returns Observable emitting SseEvent objects
   *
   * @example
   * // Basic SSE subscription
   * this.http.sse<Notification>({
   *   method: 'GET',
   *   url: '/api/notifications',
   *   parseJson: true
   * }).pipe(
   *   takeUntilDestroyed()
   * ).subscribe(event => {
   *   console.log(`${event.event}: ${event.data.message}`);
   * });
   *
   * @example
   * // With auto-reconnect
   * this.http.sse<ChatMessage>({
   *   method: 'GET',
   *   url: '/api/chat/stream',
   *   parseJson: true,
   *   autoReconnect: true,
   *   retryPolicy: { maxRetries: 5, initialInterval: 1000 }
   * }).subscribe({
   *   next: (event) => this.handleMessage(event.data),
   *   error: (err) => this.handleDisconnect(err)
   * });
   */
  sse<T = any>(request: NgxHttpSseRequest): Observable<SseEvent<T>> {

    return new Observable<SseEvent<T>>(observer => {
      const abortController = new AbortController();

      // Delegate to base SSE client with Observable callbacks
      this.httpClient.sse<T>({
        ...request,
        signal: abortController.signal,
        interceptors: wrapInterceptorsNgContext(request.interceptors, this.injector),
        onEvent: (event: SseEvent<T>) => observer.next(event),
        onError: (error: any) => observer.error(error),
        onComplete: () => observer.complete(),
      });

      // Cleanup: close SSE connection when Observable unsubscribed
      return () => abortController.abort();
    });
  }

}
