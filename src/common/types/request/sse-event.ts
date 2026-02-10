/**
 * Represents a parsed Server-Sent Event.
 *
 * Each event can contain:
 * - `id` - Event identifier for resumable connections (Last-Event-ID)
 * - `event` - Custom event type (defaults to "message" if not specified)
 * - `data` - The event payload (string or parsed JSON if parseJson is true)
 * - `retry` - Server-suggested reconnection interval in milliseconds
 *
 * @typeParam T - Type of the data field (string by default, or custom type when parseJson is true)
 *
 * @example
 * ```typescript
 * // SSE message:
 * // id: 123
 * // event: notification
 * // data: {"text": "Hello"}
 *
 * // Parsed event (with parseJson: true):
 * const event: SseEvent<{ text: string }> = {
 *   id: '123',
 *   event: 'notification',
 *   data: { text: 'Hello' }
 * };
 * ```
 */
export interface SseEvent<T = any> {
  /** Event identifier for Last-Event-ID tracking */
  id?: string;
  /** Custom event type (e.g., "message", "update", "error") */
  event?: string;
  /** Event payload - string or parsed object based on parseJson setting */
  data?: T;
  /** Server-suggested reconnection interval in milliseconds */
  retry?: number;
}
