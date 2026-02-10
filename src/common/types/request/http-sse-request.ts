import { HttpRequestBase } from "./http-request-base";
import { RetryPolicyConfig } from "./retry-policy-config";
import { SseEvent } from "./sse-event";

/**
 * Configuration for Server-Sent Events (SSE) connections.
 *
 * Used with `HttpClient.sse()` for real-time event streaming.
 * Supports automatic reconnection with exponential backoff and
 * Last-Event-ID tracking for resumable connections.
 *
 * **Key features:**
 * - Auto-reconnect with configurable retry policy
 * - Last-Event-ID tracking for missed event recovery
 * - Server-sent retry interval support
 * - JSON parsing of event data
 *
 * @example
 * ```typescript
 * // Basic SSE connection
 * const abort = await client.sse({
 *   method: 'GET',
 *   url: '/api/events',
 *   onEvent: (event) => {
 *     console.log(`${event.event}: ${event.data}`);
 *   }
 * });
 *
 * // With auto-reconnect and JSON parsing
 * await client.sse<NotificationEvent>({
 *   method: 'GET',
 *   url: '/api/notifications',
 *   parseJson: true,
 *   autoReconnect: true,
 *   retryPolicy: {
 *     maxRetries: 10,
 *     initialInterval: 1000,
 *     maxInterval: 30000,
 *     backoffMultiplier: 2
 *   },
 *   onEvent: (event) => showNotification(event.data),
 *   onError: (err) => console.error('SSE error:', err)
 * });
 *
 * // Cancel connection
 * abort();
 * ```
 */
export interface HttpSseRequest extends HttpRequestBase {
  /** Parse event data as JSON. Default: false (data is string) */
  parseJson?: boolean;

  /**
   * Strip optional space after colon in SSE fields.
   * SSE spec allows "data: value" or "data:value".
   * Default: true (normalize to consistent format)
   */
  stripOptionalSpace?: boolean;

  /** Enable automatic reconnection on disconnect. Default: false */
  autoReconnect?: boolean;

  /** Retry policy for reconnection (exponential backoff, limits) */
  retryPolicy?: RetryPolicyConfig;

  /** Event callback - receives each parsed SSE event */
  onEvent?: (event: SseEvent<any>) => void;

  /** Error callback - receives connection and parse errors */
  onError?: (error: Error) => void;

  /** Completion callback - called on normal stream end */
  onComplete?: () => void;
}
