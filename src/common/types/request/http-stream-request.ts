import { HttpRequestBase } from './http-request-base';

/**
 * Base configuration for streaming HTTP requests.
 * @internal
 */
interface HttpStreamRequestBase extends HttpRequestBase {
  /** Error callback - receives any errors during streaming */
  onError?: (error: Error) => void;

  /** Completion callback - called when stream ends normally */
  onComplete?: () => void;
}

/**
 * Configuration for streaming binary data (Uint8Array chunks).
 *
 * @example
 * ```typescript
 * await client.fetchStream({
 *   method: 'GET',
 *   url: '/api/binary-stream',
 *   decodeToString: false,
 *   onData: (chunk: Uint8Array) => {
 *     // Process raw bytes
 *     fileWriter.write(chunk);
 *   }
 * });
 * ```
 */
export interface HttpStreamRequestBinary extends HttpStreamRequestBase {
  /** Must be false or omitted for binary chunks */
  decodeToString?: false;

  /** Callback for each binary chunk received */
  onData?: (chunk: Uint8Array) => void;
}

/**
 * Configuration for streaming text data (string chunks).
 *
 * @example
 * ```typescript
 * await client.fetchStream({
 *   method: 'POST',
 *   url: '/api/chat',
 *   body: { prompt: 'Hello' },
 *   decodeToString: true,
 *   onData: (text: string) => {
 *     // Append streaming text to UI
 *     output.textContent += text;
 *   }
 * });
 * ```
 */
export interface HttpStreamRequestString extends HttpStreamRequestBase {
  /** Must be true for string chunks */
  decodeToString: true;

  /** Callback for each text chunk received */
  onData?: (chunk: string) => void;
}

/**
 * Configuration for streaming HTTP requests.
 *
 * Used with `HttpClient.fetchStream()` for processing data as it arrives.
 * Choose between binary (Uint8Array) or text (string) chunks via `decodeToString`.
 *
 * **Use cases:**
 * - Streaming AI/LLM responses
 * - Downloading large files with progress
 * - Real-time data feeds (non-SSE)
 * - NDJSON/JSON Lines streams
 *
 * @example
 * ```typescript
 * // String stream for AI chat
 * const abort = await client.fetchStream({
 *   method: 'POST',
 *   url: '/api/chat/stream',
 *   body: { messages: [...] },
 *   decodeToString: true,
 *   onData: (text) => appendToChat(text),
 *   onComplete: () => console.log('Done'),
 *   onError: (err) => console.error(err)
 * });
 *
 * // Cancel streaming
 * abort();
 * ```
 */
export type HttpStreamRequest = HttpStreamRequestBinary | HttpStreamRequestString;
