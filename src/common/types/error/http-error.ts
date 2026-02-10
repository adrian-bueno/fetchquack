/**
 * Error class for HTTP-related failures.
 *
 * This error is thrown for:
 * - HTTP status errors (4xx, 5xx responses)
 * - Network failures
 * - Stream read errors
 * - Request aborts
 *
 * The `statusCode` indicates the type of error:
 * - `0` - Non-HTTP error (network failure, abort, parse error)
 * - `4xx` - Client error
 * - `5xx` - Server error
 *
 * @example
 * ```typescript
 * try {
 *   await client.fetch({ method: 'GET', url: '/api/data' });
 * } catch (error) {
 *   if (error instanceof HttpError) {
 *     if (error.statusCode === 401) {
 *       // Handle unauthorized
 *     } else if (error.statusCode === 0) {
 *       // Network error or other non-HTTP error
 *       console.error('Network error:', error.message);
 *     }
 *   }
 * }
 * ```
 */
export class HttpError extends Error {

  /**
   * Creates a new HttpError.
   *
   * @param statusCode - HTTP status code (0 for non-HTTP errors)
   * @param message - Human-readable error description
   * @param error - Original error that caused this error (for error chaining)
   */
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly error?: Error | undefined
  ) {
    super(message);
    this.name = 'HttpError';
  }

}
