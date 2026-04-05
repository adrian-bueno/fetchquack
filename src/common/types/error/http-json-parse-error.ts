import { HttpError } from "./http-error";

/**
 * Error thrown when JSON response parsing fails.
 *
 * Extends HttpError with the raw response text that failed to parse,
 * useful for debugging malformed JSON responses.
 *
 * @example
 * ```typescript
 * try {
 *   await client.fetch<User>({ method: 'GET', url: '/api/user' });
 * } catch (error) {
 *   if (error instanceof HttpJsonParseError) {
 *     console.error('Invalid JSON received:', error.responseText);
 *   }
 * }
 * ```
 */
export class HttpJsonParseError extends HttpError {

  /**
   * Creates a new HttpJsonParseError.
   *
   * @param message - Error description
    * @param responseText - Raw response text that failed to parse
   * @param error - Original JSON parse error
   */
  constructor(
    message: string,
    public readonly responseText: string,
    error?: Error
  ) {
    super(0, message, error);
    this.name = 'HttpJsonParseError';
  }

}
