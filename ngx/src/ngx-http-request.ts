import { HttpRequest, HttpSseRequest, HttpStreamRequestBinary, HttpStreamRequestString } from "fetchquack";


/**
 * Configuration for standard HTTP requests in Promise mode.
 *
 * Extends the base HttpRequest, allowing user to provide their own
 * AbortSignal for request cancellation.
 *
 * @example
 * ```typescript
 * const ctrl = new AbortController();
 * const data = await ngxHttp.fetch<User>({
 *   method: 'GET',
 *   url: '/api/user',
 *   signal: ctrl.signal,
 *   returnObservable: false
 * });
 * ```
 */
export interface NgxHttpRequest extends HttpRequest { }

/**
 * Configuration for standard HTTP requests in Observable mode.
 *
 * Omits `signal` since AbortController is automatically managed by
 * the Observable subscription lifecycle (abort on unsubscribe).
 *
 * @example
 * ```typescript
 * ngxHttp.fetch<User[]>({
 *   method: 'GET',
 *   url: '/api/users',
 *   returnObservable: true
 * }).pipe(
 *   takeUntilDestroyed()
 * ).subscribe(users => this.users = users);
 * ```
 */
export interface NgxHttpRequestObservable extends Omit<HttpRequest, 'signal'> { }

/**
 * Configuration for binary streaming requests.
 *
 * Callbacks (onData, onError, onComplete) are omitted since the Observable
 * handles data emission. Signal is auto-managed by subscription lifecycle.
 *
 * @example
 * ```typescript
 * ngxHttp.fetchStream({
 *   method: 'GET',
 *   url: '/api/download',
 *   decodeToString: false  // or omit for binary
 * }).subscribe(chunk => processBytes(chunk));
 * ```
 */
export interface NgxHttpStreamRequestBinary
  extends Omit<HttpStreamRequestBinary, "onData" | "onError" | "onComplete" | "signal"> { }

/**
 * Configuration for text streaming requests.
 *
 * Callbacks are omitted since the Observable handles data emission.
 * Signal is auto-managed by subscription lifecycle.
 *
 * @example
 * ```typescript
 * ngxHttp.fetchStream({
 *   method: 'POST',
 *   url: '/api/chat',
 *   body: { prompt: 'Hello' },
 *   decodeToString: true
 * }).subscribe(text => this.response += text);
 * ```
 */
export interface NgxHttpStreamRequestString
  extends Omit<HttpStreamRequestString, "onData" | "onError" | "onComplete" | "signal"> { }

/**
 * Union type for streaming requests (binary or text).
 */
export type NgxHttpStreamRequest = NgxHttpStreamRequestBinary | NgxHttpStreamRequestString;

/**
 * Configuration for SSE (Server-Sent Events) requests.
 *
 * Callbacks (onEvent, onError, onComplete) are omitted since the Observable
 * handles event emission. Signal is auto-managed by subscription lifecycle.
 *
 * Supports auto-reconnect and retry policy configuration.
 *
 * @example
 * ```typescript
 * ngxHttp.sse<Notification>({
 *   method: 'GET',
 *   url: '/api/events',
 *   parseJson: true,
 *   autoReconnect: true,
 *   retryPolicy: { maxRetries: 10 }
 * }).pipe(
 *   filter(e => e.event === 'notification')
 * ).subscribe(event => showNotification(event.data));
 * ```
 */
export interface NgxHttpSseRequest
  extends Omit<HttpSseRequest, "onEvent" | "onError" | "onComplete" | "signal"> { }
