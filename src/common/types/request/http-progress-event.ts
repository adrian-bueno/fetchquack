/**
 * Progress information for upload/download operations.
 *
 * **Note on progress availability:**
 * - Browser: Full upload progress via XMLHttpRequest
 * - Server (Node/Deno/Bun): Limited upload progress support
 * - Download progress: Available on all platforms via streams
 *
 * @example
 * ```typescript
 * // Progress callback usage
 * const request: HttpRequest = {
 *   method: 'POST',
 *   url: '/upload',
 *   body: largeFile,
 *   onUploadProgress: (progress) => {
 *     if (progress.percentage !== undefined) {
 *       progressBar.value = progress.percentage;
 *     } else {
 *       console.log(`Uploaded: ${progress.loaded} bytes`);
 *     }
 *   }
 * };
 * ```
 */
export interface HttpProgressEvent {
  /** Bytes transferred so far */
  loaded: number;

  /** Total bytes (undefined if Content-Length not available) */
  total?: number;

  /** Percentage complete 0-100 (undefined if total unknown) */
  percentage?: number;
}
