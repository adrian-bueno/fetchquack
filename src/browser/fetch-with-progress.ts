import { HttpError, HttpInterceptorContext, HttpProgressEvent } from '../common/types';
import { safeJsonParse } from '../common/fetch-common';
import { FetchWithProgressStrategy, StrategyResponse } from '../common/fetch-with-progress';


/**
 * Browser implementation using XMLHttpRequest
 * Supports both upload and download progress tracking
 */
export class BrowserFetchWithProgress implements FetchWithProgressStrategy {
  readonly supportsUploadProgress = true;
  readonly supportsDownloadProgress = true;

  async execute<T = any>(
    context: HttpInterceptorContext,
    parseJson: boolean,
    decodeToString: boolean,
    onUploadProgress?: (progress: HttpProgressEvent) => void,
    onDownloadProgress?: (progress: HttpProgressEvent) => void
  ): Promise<StrategyResponse<T>> {
    return new Promise<StrategyResponse<T>>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open(context.method, context.url, true);

      // Set headers
      Object.entries(context.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Upload progress
      if (onUploadProgress && xhr.upload) {
        xhr.upload.addEventListener('progress', (event) => {
          onUploadProgress(this.calculateProgress(event));
        });
      }

      // Download progress
      if (onDownloadProgress) {
        xhr.addEventListener('progress', (event) => {
          onDownloadProgress(this.calculateProgress(event));
        });
      }

      // Set response type based on decodeToString flag
      xhr.responseType = decodeToString ? 'text' : 'arraybuffer';

      xhr.addEventListener('load', () => {
        // Parse response headers (handle values containing colons)
        const headers = new Headers();
        const headerString = xhr.getAllResponseHeaders();
        headerString.split('\r\n').forEach(line => {
          const colonIndex = line.indexOf(': ');
          if (colonIndex !== -1) {
            headers.append(line.slice(0, colonIndex), line.slice(colonIndex + 2));
          }
        });

        if (xhr.status >= 200 && xhr.status < 300) {
          let data: T;
          if (decodeToString) {
            // Decode to text first
            const text = xhr.responseText;

            if (parseJson) {
              // Parse JSON from decoded text
              try {
                data = safeJsonParse<T>(text);
              } catch (error) {
                reject(error);
                return;
              }
            } else {
              // Return as string
              data = text as T;
            }
          } else {
            // Return binary data as Uint8Array
            data = new Uint8Array(xhr.response) as T;
          }

          resolve({
            data,
            status: xhr.status,
            statusText: xhr.statusText,
            headers
          });
        } else {
          reject(new HttpError(xhr.status, `HTTP error! status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new HttpError(0, 'Network error'));
      });

      xhr.addEventListener('abort', () => {
        reject(new HttpError(0, 'Request aborted'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new HttpError(0, 'Request timeout'));
      });

      // Send request
      const requestBody = context.body && typeof context.body !== 'string'
        ? JSON.stringify(context.body)
        : context.body as string | null;

      xhr.send(requestBody);
    });
  }

  private calculateProgress(event: globalThis.ProgressEvent): HttpProgressEvent {
    const progress: HttpProgressEvent = {
      loaded: event.loaded,
    };

    if (event.lengthComputable && event.total > 0) {
      progress.total = event.total;
      progress.percentage = Math.round((event.loaded / event.total) * 100);
    }

    return progress;
  }
}
