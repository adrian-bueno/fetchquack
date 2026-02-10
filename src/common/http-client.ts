import { HttpInterceptorFn, HttpRequest, HttpStreamRequest, HttpSseRequest } from './types';
import { fetchHttp } from './fetch-http';
import { fetchHttpStream } from './fetch-http-stream';
import { fetchSse } from './fetch-sse';


/**
 * Configuration options for HttpClient.
 */
export interface HttpClientOptions {
  /**
   * Array of interceptors applied to all requests made by this client.
   * Interceptors execute in order and can modify requests/responses.
   *
   * @example
   * ```typescript
   * const client = new HttpClient({
   *   globalInterceptors: [
   *     authInterceptor({ getToken: () => localStorage.getItem('token') }),
   *     loggingInterceptor({ prefix: '[API]' })
   *   ]
   * });
   * ```
   */
  globalInterceptors?: Array<HttpInterceptorFn>;
}


/**
 * HTTP client for making standard requests, streaming requests, and SSE connections.
 *
 * This is the main entry point for the library. It provides a unified API for:
 * - **Regular HTTP requests** (`fetch`) - Promise-based, returns parsed response
 * - **Streaming requests** (`fetchStream`) - Callback-based, receives chunks as they arrive
 * - **Server-Sent Events** (`sse`) - Callback-based, receives parsed SSE events with auto-reconnect
 *
 * All methods support interceptors for cross-cutting concerns like authentication,
 * logging, and error handling.
 *
 * @example
 * ```typescript
 * // Create a client with global interceptors
 * const client = new HttpClient({
 *   globalInterceptors: [authInterceptor({ getToken: () => token })]
 * });
 *
 * // Make a JSON request
 * const user = await client.fetch<User>({ method: 'GET', url: '/api/user/1' });
 *
 * // Stream a large response
 * client.fetchStream({
 *   method: 'GET',
 *   url: '/api/large-file',
 *   decodeToString: true,
 *   onData: (chunk) => console.log(chunk),
 *   onComplete: () => console.log('Done')
 * });
 *
 * // Connect to SSE endpoint
 * client.sse({
 *   method: 'GET',
 *   url: '/api/events',
 *   autoReconnect: true,
 *   onEvent: (event) => console.log(event.data)
 * });
 * ```
 */
export class HttpClient {

  private readonly globalInterceptors: Array<HttpInterceptorFn>;

  /**
   * Creates a new HttpClient instance.
   *
   * @param options - Configuration options for the client
   *
   * @example
   * ```typescript
   * // Basic client without interceptors
   * const client = new HttpClient();
   *
   * // Client with authentication and logging
   * const client = new HttpClient({
   *   globalInterceptors: [
   *     authInterceptor({ getToken: () => getAuthToken() }),
   *     loggingInterceptor()
   *   ]
   * });
   * ```
   */
  constructor(options?: HttpClientOptions) {
    this.globalInterceptors = options?.globalInterceptors || [];
  }

  /**
   * Sends an HTTP request and returns binary data.
   * Use this for downloading files, images, or other binary content.
   *
   * @param request - Request configuration with `decodeToString: false`
   * @returns Promise resolving to Uint8Array
   *
   * @example
   * ```typescript
   * const imageData = await client.fetch({
   *   method: 'GET',
   *   url: '/api/image.png',
   *   decodeToString: false
   * });
   * ```
   */
  async fetch(request: HttpRequest & { decodeToString: false }): Promise<Uint8Array>;

  /**
   * Sends an HTTP request and returns the response as text.
   * Use this when you need the raw text without JSON parsing.
   *
   * @param request - Request configuration with `parseJson: false`
   * @returns Promise resolving to string
   *
   * @example
   * ```typescript
   * const html = await client.fetch({
   *   method: 'GET',
   *   url: '/api/page.html',
   *   parseJson: false
   * });
   * ```
   */
  async fetch(request: HttpRequest & { parseJson: false; decodeToString?: true }): Promise<string>;

  /**
   * Sends an HTTP request and returns parsed JSON.
   * This is the default behavior - responses are automatically parsed as JSON.
   *
   * @typeParam T - The expected type of the parsed JSON response
   * @param request - Request configuration
   * @returns Promise resolving to the parsed JSON data
   *
   * @example
   * ```typescript
   * interface User { id: number; name: string; }
   *
   * const user = await client.fetch<User>({
   *   method: 'GET',
   *   url: '/api/user/1'
   * });
   *
   * // With POST body
   * const newUser = await client.fetch<User>({
   *   method: 'POST',
   *   url: '/api/users',
   *   body: { name: 'John' }
   * });
   * ```
   */
  async fetch<T = any>(request: HttpRequest & { parseJson?: true; decodeToString?: true }): Promise<T>;

  /**
   * Sends a standard HTTP request.
   *
   * The response type depends on the configuration:
   * - `parseJson: true` (default): Returns parsed JSON as type T
   * - `parseJson: false`: Returns raw text as string
   * - `decodeToString: false`: Returns binary data as Uint8Array
   *
   * Supports progress tracking for uploads and downloads via callbacks.
   *
   * @typeParam T - The expected response type
   * @param request - Request configuration
   * @returns Promise resolving to the response data
   * @throws {HttpError} When the request fails or returns a non-2xx status
   * @throws {HttpJsonParseError} When JSON parsing fails
   */
  async fetch<T = any>(request: HttpRequest): Promise<T | string | Uint8Array> {
    return fetchHttp<T>(request, { globalInterceptors: this.globalInterceptors });
  }

  /**
   * Sends an HTTP request and streams the response body as chunks.
   *
   * Use this for large responses where you want to process data as it arrives,
   * rather than waiting for the complete response. Chunks can be received as
   * raw binary (Uint8Array) or decoded text (string).
   *
   * **Important:** This method is callback-based and returns immediately.
   * Use an AbortController to cancel the stream.
   *
   * @param request - Request configuration with streaming callbacks
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   *
   * // Stream as text
   * client.fetchStream({
   *   method: 'GET',
   *   url: '/api/large-file.txt',
   *   decodeToString: true,
   *   signal: controller.signal,
   *   onData: (chunk) => console.log('Received:', chunk),
   *   onError: (error) => console.error('Error:', error),
   *   onComplete: () => console.log('Stream complete')
   * });
   *
   * // Stream as binary
   * client.fetchStream({
   *   method: 'GET',
   *   url: '/api/file.bin',
   *   onData: (chunk) => processBytes(chunk),
   *   onComplete: () => console.log('Done')
   * });
   *
   * // Cancel the stream
   * controller.abort();
   * ```
   */
  fetchStream(request: HttpStreamRequest): void {
    fetchHttpStream(request, { globalInterceptors: this.globalInterceptors });
  }

  /**
   * Connects to a Server-Sent Events (SSE) endpoint.
   *
   * SSE provides real-time server-to-client communication over HTTP. Events are
   * automatically parsed according to the SSE specification (W3C EventSource).
   *
   * **Features:**
   * - Automatic event parsing with optional JSON data parsing
   * - Auto-reconnect with exponential backoff
   * - Last-Event-ID tracking for resumable connections
   * - Support for custom event types
   *
   * **Important:** This method is callback-based and returns immediately.
   * Use an AbortController to close the connection.
   *
   * @typeParam T - The expected type of the event data (when parseJson is true)
   * @param request - SSE request configuration with event callbacks
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   *
   * // Basic SSE connection
   * client.sse({
   *   method: 'GET',
   *   url: '/api/events',
   *   signal: controller.signal,
   *   onEvent: (event) => {
   *     console.log('Event type:', event.event);
   *     console.log('Data:', event.data);
   *     console.log('ID:', event.id);
   *   },
   *   onError: (error) => console.error(error),
   *   onComplete: () => console.log('Connection closed')
   * });
   *
   * // With auto-reconnect and JSON parsing
   * client.sse<{ message: string }>({
   *   method: 'GET',
   *   url: '/api/notifications',
   *   parseJson: true,
   *   autoReconnect: true,
   *   retryPolicy: {
   *     maxRetries: 5,
   *     initialInterval: 1000
   *   },
   *   onEvent: (event) => showNotification(event.data.message)
   * });
   *
   * // Close the connection
   * controller.abort();
   * ```
   */
  sse<T = any>(request: HttpSseRequest): void {
    fetchSse<T>(request, { globalInterceptors: this.globalInterceptors });
  }

}
