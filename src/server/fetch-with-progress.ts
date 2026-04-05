import { HttpInterceptorContext, HttpError, HttpProgressEvent } from '../common/types';
import { FetchWithProgressStrategy, StrategyResponse } from '../common/fetch-with-progress';
import { safeJsonParse } from '../common/fetch-common';

/**
 * Server implementation using Fetch API with ReadableStream
 * Works for Node.js, Deno, and Bun
 * Supports both upload and download progress tracking
 */
export class ServerFetchWithProgress implements FetchWithProgressStrategy {
  readonly supportsUploadProgress = true;
  readonly supportsDownloadProgress = true;

  /** Executes a fetch request using the Fetch API with ReadableStream for progress tracking on server runtimes. */
  async execute<T = any>(
    context: HttpInterceptorContext,
    parseJson: boolean,
    decodeToString: boolean,
    onUploadProgress?: (progress: HttpProgressEvent) => void,
    onDownloadProgress?: (progress: HttpProgressEvent) => void
  ): Promise<StrategyResponse<T>> {
    let requestBody: string | ReadableStream | null = null;
    let usedStreamForUpload = false;

    if (context.body) {
      const bodyString = typeof context.body !== 'string'
        ? JSON.stringify(context.body)
        : context.body;

      // Try to wrap body in a ReadableStream to track upload progress
      if (onUploadProgress) {
        try {
          requestBody = this.createProgressStream(bodyString, onUploadProgress);
          usedStreamForUpload = true;
        } catch (error) {
          // If streaming is not supported, fall back to regular body
          // Fire progress events manually: 0% at start, 100% after request
          requestBody = bodyString;
          onUploadProgress({ loaded: 0, total: bodyString.length, percentage: 0 });
        }
      } else {
        requestBody = bodyString;
      }
    }

    const fetchOptions: RequestInit & { duplex?: string } = {
      method: context.method,
      headers: context.headers,
      body: requestBody as any,
    };

    // Required for streaming request bodies in Node.js
    // Deno and Bun ignore this option, so it's safe to always set it
    if (requestBody instanceof ReadableStream) {
      (fetchOptions as any).duplex = 'half';
    }

    let response: Response;
    try {
      response = await fetch(context.url, fetchOptions);
    } catch (error) {
      // If fetch failed and we used ReadableStream, retry with string body
      if (usedStreamForUpload && context.body) {
        const bodyString = typeof context.body !== 'string'
          ? JSON.stringify(context.body)
          : context.body;
        requestBody = bodyString;
        fetchOptions.body = requestBody as any;
        delete (fetchOptions as any).duplex;

        if (onUploadProgress) {
          onUploadProgress({ loaded: 0, total: bodyString.length, percentage: 0 });
        }

        response = await fetch(context.url, fetchOptions);
        usedStreamForUpload = false;
      } else {
        throw error;
      }
    }

    // If we used fallback upload progress, fire 100% completion now
    if (context.body && onUploadProgress && typeof requestBody === 'string') {
      const bodyString = typeof context.body !== 'string'
        ? JSON.stringify(context.body)
        : context.body;
      onUploadProgress({ loaded: bodyString.length, total: bodyString.length, percentage: 100 });
    }

    if (!response.ok) {
      throw new HttpError(response.status, `HTTP error! status: ${response.status}`);
    }

    let data: T;

    // Handle download progress if callback provided
    if (onDownloadProgress) {
      if (response.body) {
        try {
          data = await this.readWithProgress<T>(response, parseJson, decodeToString, onDownloadProgress);
        } catch (error) {
          // If streaming is not supported, fall back to regular read
          // Fire progress events manually: 0% at start, 100% after response
          onDownloadProgress({ loaded: 0, total: undefined, percentage: 0 });
          data = await this.readResponseData<T>(response, parseJson, decodeToString);
          onDownloadProgress({ loaded: 1, total: 1, percentage: 100 });
        }
      } else {
        // No response body, just fire completion event
        onDownloadProgress({ loaded: 0, total: 0, percentage: 100 });
        data = (parseJson ? null : '') as T;
      }
    } else {
      // No progress tracking, just return response
      data = await this.readResponseData<T>(response, parseJson, decodeToString);
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    };
  }

  /** Creates a ReadableStream that wraps the request body and reports upload progress in chunks. */
  private createProgressStream(body: string, onUploadProgress: (progress: HttpProgressEvent) => void): ReadableStream {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(body);
    const total = encoded.length;
    let loaded = 0;

    return new ReadableStream({
      start(controller) {
        const chunkSize = 1024 * 64; // 64KB chunks
        let offset = 0;

        function push() {
          if (offset >= encoded.length) {
            controller.close();
            return;
          }

          const end = Math.min(offset + chunkSize, encoded.length);
          const chunk = encoded.slice(offset, end);
          controller.enqueue(chunk);

          loaded += chunk.length;
          onUploadProgress({
            loaded,
            total,
            percentage: Math.round((loaded / total) * 100)
          });

          offset = end;
          push();
        }

        push();
      }
    });
  }

  /** Reads the response body via ReadableStream, reporting download progress, then parses the result. */
  private async readWithProgress<T>(
    response: Response,
    parseJson: boolean,
    decodeToString: boolean,
    onDownloadProgress: (progress: HttpProgressEvent) => void
  ): Promise<T> {
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : undefined;
    let loaded = 0;

    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      loaded += value.length;

      onDownloadProgress({
        loaded,
        total,
        percentage: total ? Math.round((loaded / total) * 100) : undefined
      });
    }

    // Reconstruct the response - merge all chunks into single Uint8Array first
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return this.parseResponseData<T>(merged, response.headers, parseJson, decodeToString);
  }

  /** Reads and parses the full response body without progress tracking. */
  private async readResponseData<T>(
    response: Response,
    parseJson: boolean,
    decodeToString: boolean
  ): Promise<T> {
    if (decodeToString) {
      const text = await response.text();
      return parseJson ? safeJsonParse<T>(text) : text as T;
    } else {
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer) as T;
    }
  }

  /** Parses a raw Uint8Array into the target type based on parseJson and decodeToString flags. */
  private parseResponseData<T>(
    data: Uint8Array,
    headers: Headers,
    parseJson: boolean,
    decodeToString: boolean
  ): T {
    if (decodeToString) {
      const text = new TextDecoder().decode(data);
      return parseJson ? safeJsonParse<T>(text) : text as T;
    } else {
      return data as T;
    }
  }
}
