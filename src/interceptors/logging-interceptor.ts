import { HttpInterceptorFn, HttpInterceptorContext, HttpInterceptorNext } from '../common';

/**
 * ANSI color codes for terminal output.
 * Used to colorize request IDs for easier visual tracking.
 * @internal
 */
const COLORS = [
  '\x1b[36m',   // Cyan
  '\x1b[35m',   // Magenta
  '\x1b[33m',   // Yellow
  '\x1b[32m',   // Green
  '\x1b[34m',   // Blue
  '\x1b[91m',   // Bright Red
  '\x1b[92m',   // Bright Green
  '\x1b[93m',   // Bright Yellow
  '\x1b[94m',   // Bright Blue
  '\x1b[95m',   // Bright Magenta
  '\x1b[96m',   // Bright Cyan
  '\x1b[31m',   // Red
  '\x1b[90m',   // Bright Black (Gray)
  '\x1b[97m',   // Bright White
  '\x1b[36;1m', // Bold Cyan
  '\x1b[35;1m', // Bold Magenta
  '\x1b[33;1m', // Bold Yellow
  '\x1b[32;1m', // Bold Green
  '\x1b[34;1m', // Bold Blue
  '\x1b[91;1m', // Bold Bright Red
];
const RESET = '\x1b[0m';

let colorIndex = 0;

/** @internal */
function getNextColor(): string {
  const color = COLORS[colorIndex];
  colorIndex = (colorIndex + 1) % COLORS.length;
  return color;
}

/**
 * Configuration for the logging interceptor.
 */
export interface LoggingInterceptorOptions {
  /** Log message prefix. @default '[HTTP]' */
  prefix?: string;

  /** Headers to mask in logs (values shown as '<secret>'). @default ['Authorization'] */
  secretHeaders?: string[];

  /** Filter to skip logging for certain requests */
  shouldSkipLogging?: (context: HttpInterceptorContext) => boolean;

  /**
   * Whether to colorize request IDs for easier visual identification
   * @default true
   */
  colorizeRequestId?: boolean;

  /**
   * Whether to sanitize/hide request and response bodies in logs.
   * When true, bodies will be logged as '<sanitized>' to prevent
   * sensitive data (passwords, PII, tokens) from appearing in logs.
   * @default false
   */
  sanitizeBody?: boolean;
}

/**
 * Creates a logging interceptor for debugging and monitoring HTTP traffic.
 *
 * Features:
 * - Unique colorized request IDs for easy tracking
 * - Automatic masking of sensitive headers
 * - Request/response timing
 * - Body sanitization option for security
 * - Smart handling of streaming responses
 *
 * @param options - Configuration for logging behavior
 * @returns Configured interceptor function
 *
 * @example
 * ```typescript
 * // Basic logging
 * const client = new HttpClient({
 *   globalInterceptors: [loggingInterceptor()]
 * });
 *
 * // Production-safe logging (sanitized bodies)
 * const client = new HttpClient({
 *   globalInterceptors: [
 *     loggingInterceptor({
 *       prefix: '[API]',
 *       secretHeaders: ['Authorization', 'X-API-Key', 'Cookie'],
 *       sanitizeBody: true,
 *       shouldSkipLogging: (ctx) => ctx.url.includes('/health')
 *     })
 *   ]
 * });
 * ```
 *
 * **Log output example:**
 * ```
 * [HTTP] [abc123] [REQ] { method: 'POST', url: '/api/users', ... }
 * [HTTP] [abc123] [RES] { status: 201, duration: '45ms', ... }
 * ```
 */
export function loggingInterceptor(options: LoggingInterceptorOptions = {}): HttpInterceptorFn {
  const prefix = options.prefix || '[HTTP]';
  const secretHeaders = options.secretHeaders || ['Authorization'];
  const shouldSkipLogging = options.shouldSkipLogging || (() => false);
  const colorizeRequestId = options.colorizeRequestId ?? true;
  const sanitizeBody = options.sanitizeBody ?? false;

  // Normalize secret headers to lowercase for case-insensitive comparison
  const normalizedSecretHeaders = secretHeaders.map(h => h.toLowerCase());

  return async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
    if (shouldSkipLogging(context)) {
      return next(context);
    }

    // Generate a unique request ID for tracking and assign a color
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const color = colorizeRequestId ? getNextColor() : '';
    const reset = colorizeRequestId ? RESET : '';
    const coloredRequestId = `${color}[${requestId}]${reset}`;
    const startTime = Date.now();

    // Create a sanitized copy of headers for logging
    const sanitizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(context.headers)) {
      if (normalizedSecretHeaders.includes(key.toLowerCase())) {
        sanitizedHeaders[key] = '<secret>';
      } else {
        sanitizedHeaders[key] = value;
      }
    }

    console.log(`${prefix} ${coloredRequestId} [REQ]`, {
      method: context.method,
      url: context.url,
      headers: sanitizedHeaders,
      body: sanitizeBody ? '<sanitized>' : context.body
    });

    try {
      const response = await next(context);
      const duration = Date.now() - startTime;

      // Check if this is a streaming request (fetchStream/sse)
      const isStreaming = context.metadata?.streaming === true;

      let responseBody: any = undefined;
      if (response.response && response.response.body) {
        if (sanitizeBody) {
          responseBody = '<sanitized>';
        } else if (isStreaming) {
          // Don't read streaming responses to avoid consuming the stream
          responseBody = '<stream>';
        } else {
          // For regular fetch requests, try to read and log the body
          try {
            const clonedResponse = response.response.clone();
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
              responseBody = await clonedResponse.json();
            } else if (contentType.includes('text/')) {
              responseBody = await clonedResponse.text();
            } else {
              responseBody = '<binary>';
            }
          } catch (err) {
            // If we can't read the body, that's okay
            responseBody = '<unreadable>';
          }
        }
      }

      console.log(`${prefix} ${coloredRequestId} [RES]`, {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`${prefix} ${coloredRequestId} [ERR]`, {
        duration: `${duration}ms`,
        error
      });
      throw error;
    }
  };
}
