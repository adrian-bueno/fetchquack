import {
  HttpInterceptorContext,
  HttpInterceptorFn,
  HttpInterceptorNext,
  HttpInterceptorResponse,
  HttpJsonParseError
} from "./types";

/**
 * Maximum response text length to include in error messages.
 * Prevents large responses from bloating error logs.
 * @internal
 */
const MAX_ERROR_TEXT_LENGTH = 500;

/**
 * Truncates text for safe inclusion in error messages.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated text with '...' suffix if needed
 * @internal
 */
export function truncateText(text: string, maxLength: number = MAX_ERROR_TEXT_LENGTH): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Safely parses JSON with enhanced error reporting.
 *
 * On parse failure, throws HttpJsonParseError with truncated response text
 * for debugging without exposing full potentially-large responses.
 *
 * @typeParam T - Expected parsed type
 * @param text - JSON string to parse
 * @returns Parsed value
 * @throws {HttpJsonParseError} If JSON parsing fails
 * @internal
 */
export function safeJsonParse<T>(text: string): T {
    try {
        return JSON.parse(text) as T;
    } catch (error) {
        const truncatedText = truncateText(text);
        throw new HttpJsonParseError(
            `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`,
            truncatedText,
            error instanceof Error ? error : undefined
        );
    }
}

/**
 * Executes the actual fetch request with normalized parameters.
 *
 * Handles body serialization (objects → JSON) and signal extraction
 * from either AbortSignal or AbortController.
 *
 * @param context - Request context with URL, method, headers, body
 * @param signalOrController - Abort mechanism (Signal or Controller)
 * @returns Promise resolving to interceptor response wrapper
 * @internal
 */
export function executeFetch(
    context: HttpInterceptorContext,
    signalOrController: AbortSignal | AbortController
): Promise<HttpInterceptorResponse> {
    // Serialize object bodies to JSON string
    const requestBody = context.body && typeof context.body !== 'string'
        ? JSON.stringify(context.body)
        : context.body as string | null;

    // Extract signal from controller if needed
    const signal = signalOrController instanceof AbortController
        ? signalOrController.signal
        : signalOrController;

    return fetch(context.url, {
        method: context.method,
        headers: context.headers,
        body: requestBody,
        signal
    }).then(response => ({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        ok: response.ok,
        response
    }));
}

/**
 * Executes interceptor chain in order, then calls final handler.
 *
 * Implements middleware pattern where each interceptor can:
 * 1. Modify request context before calling next()
 * 2. Process/transform response after next() returns
 * 3. Handle errors from downstream handlers
 *
 * @param context - Initial request context
 * @param interceptors - Array of interceptor functions
 * @param finalHandler - Handler called after all interceptors (makes actual request)
 * @returns Promise resolving to final response
 * @internal
 */
export function executeInterceptorChain(
  context: HttpInterceptorContext,
  interceptors: HttpInterceptorFn[],
  finalHandler: (ctx: HttpInterceptorContext) => Promise<HttpInterceptorResponse>
): Promise<HttpInterceptorResponse> {
  let index = 0;

  // Recursive next() function that advances through interceptor chain
  const next: HttpInterceptorNext = (ctx: HttpInterceptorContext): Promise<HttpInterceptorResponse> => {
    if (index < interceptors.length) {
      // Call next interceptor, incrementing index
      const interceptorFn = interceptors[index++];
      return interceptorFn(ctx, next);
    } else {
      // End of chain: execute the actual request
      return finalHandler(ctx);
    }
  };

  return next(context);
}

/**
 * Adds Content-Type header if missing and body is present.
 *
 * Auto-detects type:
 * - String body → 'text/plain'
 * - Object body → 'application/json'
 *
 * @param headers - Headers object to modify
 * @param body - Request body
 * @internal
 */
export function ensureContentType(headers: Record<string, string>, body: any): void {
    if (body && !headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = typeof body === 'string' ? 'text/plain' : 'application/json';
    }
}
