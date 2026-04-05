import { HttpInterceptorContext, HttpInterceptorFn, HttpInterceptorResponse, HttpError } from './types';
import type { HttpProgressEvent } from './types';
import { getStrategy } from './fetch-with-progress-registry';
import { safeJsonParse } from './fetch-common';

/**
 * Response from strategy execution including metadata
 */
export interface StrategyResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

/**
 * Interface for runtime-specific fetch implementations with progress tracking
 */
export interface FetchWithProgressStrategy {
  /**
   * Executes a fetch request with progress tracking
   * @param context The HTTP request context after interceptor processing
   * @param parseJson Whether to parse response as JSON (requires decodeToString=true)
   * @param decodeToString Whether to decode response to string (true=text, false=binary)
   * @param onUploadProgress Callback for upload progress updates
   * @param onDownloadProgress Callback for download progress updates
   * @returns Promise resolving to the response with metadata
   */
  execute<T = any>(
    context: HttpInterceptorContext,
    parseJson: boolean,
    decodeToString: boolean,
    onUploadProgress?: (progress: HttpProgressEvent) => void,
    onDownloadProgress?: (progress: HttpProgressEvent) => void
  ): Promise<StrategyResponse<T>>;

  /**
   * Indicates whether this strategy supports upload progress tracking
   */
  readonly supportsUploadProgress: boolean;

  /**
   * Indicates whether this strategy supports download progress tracking
   */
  readonly supportsDownloadProgress: boolean;
}

/**
 * Gets the fetch with progress strategy for the current runtime
 * @deprecated Use internal registry instead
 */
export function getFetchWithProgressStrategy(): FetchWithProgressStrategy {
  return getStrategy();
}

/**
 * Executes a fetch request with upload/download progress tracking.
 *
 * Delegates to the platform-specific strategy (XHR in browsers, ReadableStream in
 * Node.js/Deno/Bun) after running the request through the interceptor chain.
 *
 * @typeParam T - Expected type of the parsed response
 * @param context - The HTTP request context (method, url, body, headers, metadata)
 * @param interceptors - Interceptor chain to execute before the request
 * @param parseJson - Whether to parse the response body as JSON
 * @param decodeToString - Whether to decode the response as text (`true`) or binary (`false`). Defaults to `true` if `undefined`.
 * @param onUploadProgress - Callback for upload progress updates
 * @param onDownloadProgress - Callback for download progress updates
 * @returns Promise resolving to the parsed response data
 * @throws {HttpError} On HTTP errors (non-2xx status)
 * @throws {HttpJsonParseError} When JSON parsing fails and `parseJson` is `true`
 */
export async function fetchWithProgress<T = any>(
  context: HttpInterceptorContext,
  interceptors: Array<HttpInterceptorFn>,
  parseJson: boolean,
  decodeToString: boolean | undefined,
  onUploadProgress?: (progress: HttpProgressEvent) => void,
  onDownloadProgress?: (progress: HttpProgressEvent) => void
): Promise<T> {
  // Default decodeToString to true if not explicitly set
  const shouldDecodeToString = decodeToString !== false;

  let index = 0;

  const next = async (ctx: HttpInterceptorContext): Promise<HttpInterceptorResponse> => {
    if (index < interceptors.length) {
      const interceptorFn = interceptors[index++];
      return interceptorFn(ctx, next);
    } else {
      // Last in chain: execute the actual request with progress tracking
      const strategy = getStrategy();
      const strategyResponse = await strategy.execute<T>(ctx, parseJson, shouldDecodeToString, onUploadProgress, onDownloadProgress);

      // Prepare response body based on data type
      let responseBody: any;
      if (strategyResponse.data instanceof Uint8Array) {
        // Binary data - pass through as-is
        responseBody = strategyResponse.data as Uint8Array;
      } else if (typeof strategyResponse.data === 'string') {
        // Text data - pass through as-is
        responseBody = strategyResponse.data as string;
      } else {
        // Object/JSON - stringify it
        responseBody = JSON.stringify(strategyResponse.data);
      }

      return {
        status: strategyResponse.status,
        statusText: strategyResponse.statusText,
        headers: strategyResponse.headers,
        ok: strategyResponse.status >= 200 && strategyResponse.status < 300,
        response: new Response(responseBody, {
          status: strategyResponse.status,
          statusText: strategyResponse.statusText,
          headers: strategyResponse.headers
        })
      };
    }
  };

  const response = await next(context);

  if (!response.ok) {
    throw new HttpError(response.status, `HTTP error! status: ${response.status}`);
  }

  // Validate Content-Type header
  const contentType = response.headers.get('Content-Type') || '';
  const isJsonContentType = contentType.toLowerCase().includes('application/json');

  // Warn about Content-Type mismatch (non-fatal, but helpful for debugging)
  if (parseJson && !isJsonContentType && contentType) {
    console.warn(`Expected application/json but received Content-Type: ${contentType}`);
  } else if (!shouldDecodeToString && contentType && !contentType.toLowerCase().includes('application/octet-stream') && !contentType.toLowerCase().includes('application/')) {
    console.warn(`Expected binary content but received Content-Type: ${contentType}`);
  }

  if (shouldDecodeToString) {
    const text = await response.response.text();
    return parseJson ? safeJsonParse<T>(text) : text as T;
  } else {
    const buffer = await response.response.arrayBuffer();
    return new Uint8Array(buffer) as T;
  }
}
