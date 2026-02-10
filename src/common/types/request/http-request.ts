import { HttpProgressEvent } from "./http-progress-event";
import { HttpRequestBase } from "./http-request-base";

/**
 * Configuration for standard HTTP requests.
 *
 * Used with `HttpClient.fetch()` for promise-based requests
 * that return the complete response body.
 *
 * @typeParam T - Expected response type (inferred from parseJson/decodeToString)
 *
 * @example
 * ```typescript
 * // JSON response (default)
 * const user = await client.fetch<User>({
 *   method: 'GET',
 *   url: '/api/user/1',
 *   parseJson: true // default
 * });
 *
 * // Binary response (images, files)
 * const imageData = await client.fetch<Uint8Array>({
 *   method: 'GET',
 *   url: '/api/image.png',
 *   decodeToString: false
 * });
 *
 * // With progress tracking
 * await client.fetch({
 *   method: 'POST',
 *   url: '/api/upload',
 *   body: largePayload,
 *   onUploadProgress: (p) => console.log(`Upload: ${p.percentage}%`),
 *   onDownloadProgress: (p) => console.log(`Download: ${p.percentage}%`)
 * });
 * ```
 */
export interface HttpRequest extends HttpRequestBase {
  /** Parse response as JSON. Default: true */
  parseJson?: boolean;

  /**
   * Decode response to string vs binary.
   * - `true` (default): Return string (or parsed JSON if parseJson is true)
   * - `false`: Return Uint8Array for binary data (images, PDFs, etc.)
   */
  decodeToString?: boolean;

  /** Upload progress callback (browser: XMLHttpRequest, server: limited support) */
  onUploadProgress?: (progress: HttpProgressEvent) => void;

  /** Download progress callback */
  onDownloadProgress?: (progress: HttpProgressEvent) => void;
}
