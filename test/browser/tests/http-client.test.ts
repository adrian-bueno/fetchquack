import { test, expect } from '@playwright/test';

const baseUrl = 'http://localhost:3004';
const testPageUrl = 'http://localhost:3004/test-page.esm.html';
// const testPageUrl = 'http://localhost:3004/test-page.iife.html';

test.beforeEach(async ({ page }) => {
  // Load the test page which imports the module properly
  await page.goto(testPageUrl);

  // Wait for the module to load and expose HttpClient
  await page.waitForFunction(() => (window as any).testReady === true, { timeout: 10000 });
}); test.describe('HttpClient - Basic Requests (Browser)', () => {
  test('should fetch JSON data', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      return await client.fetch({
        method: 'GET',
        url: `${url}/json`
      });
    }, baseUrl);

    expect(result).toHaveProperty('message', 'Hello, World!');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  test('should fetch with POST method', async ({ page }) => {
    const testData = { test: 'data', number: 42 };
    const result = await page.evaluate(async ({ url, data }) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      return await client.fetch({
        method: 'POST',
        url: `${url}/echo`,
        body: data
      });
    }, { url: baseUrl, data: testData });

    expect(result).toEqual(testData);
  });

  test('should handle delayed responses', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const startTime = Date.now();

      const response = await client.fetch({
        method: 'GET',
        url: `${url}/json-delayed?delay=200`
      });

      const elapsed = Date.now() - startTime;
      return { response, elapsed };
    }, baseUrl);

    expect(result.response.message).toBe('Delayed response');
    expect(result.elapsed).toBeGreaterThanOrEqual(190);
  });

  test('should send and receive custom headers', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      return await client.fetch({
        method: 'GET',
        url: `${url}/headers`,
        headers: {
          'X-Custom-Header': 'test-value',
          'X-Another': 'another-value'
        }
      });
    }, baseUrl);

    expect(result['x-custom-header']).toBe('test-value');
    expect(result['x-another']).toBe('another-value');
  });

  test('should handle text responses when parseJson is false', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      return await client.fetch({
        method: 'POST',
        url: `${url}/echo`,
        body: 'plain text content',
        parseJson: false
      });
    }, baseUrl);

    expect(result).toBe('plain text content');
  });

  test('should throw HttpError on 404', async ({ page }) => {
    const error = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      try {
        await client.fetch({
          method: 'GET',
          url: `${url}/status?code=404`
        });
        return null;
      } catch (err: any) {
        return {
          name: err.name,
          message: err.message,
          statusCode: err.statusCode
        };
      }
    }, baseUrl);

    expect(error).not.toBeNull();
    expect(error?.statusCode).toBe(404);
  });

  test('should throw HttpError on 500', async ({ page }) => {
    const error = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      try {
        await client.fetch({
          method: 'GET',
          url: `${url}/status?code=500`
        });
        return null;
      } catch (err: any) {
        return {
          name: err.name,
          message: err.message,
          statusCode: err.statusCode
        };
      }
    }, baseUrl);

    expect(error).not.toBeNull();
    expect(error?.statusCode).toBe(500);
  });

  test('should handle different HTTP methods', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      const results = [];

      for (const method of methods) {
        try {
          const response = await client.fetch({
            method,
            url: `${url}/json`
          });
          results.push({ method, success: true, data: response });
        } catch (error: any) {
          results.push({ method, success: false, error: error.message });
        }
      }

      return results;
    }, baseUrl);

    expect(result.length).toBe(5);
    // Check that at least GET and POST worked
    const getResult = result.find(r => r.method === 'GET');
    const postResult = result.find(r => r.method === 'POST');
    expect(getResult?.success).toBe(true);
    expect(postResult?.success).toBe(true);
  });
});

test.describe('HttpClient - Streaming (Browser)', () => {
  test('should stream text data', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const chunks: string[] = [];
      let completed = false;

      client.fetchStream({
        method: 'GET',
        url: `${url}/stream?chunks=5&delay=50`,
        decodeToString: true,
        onData: (chunk: string) => {
          chunks.push(chunk);
        },
        onComplete: () => {
          completed = true;
        }
      });

      // Wait for stream to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      return { chunks, completed };
    }, baseUrl);

    expect(result.completed).toBe(true);
    expect(result.chunks.length).toBe(5);
  });

  test('should stream binary data', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const chunks: any[] = [];
      let completed = false;

      client.fetchStream({
        method: 'GET',
        url: `${url}/stream-binary?chunks=5&delay=30`,
        decodeToString: false,
        onData: (chunk: Uint8Array) => {
          chunks.push(Array.from(chunk));
        },
        onComplete: () => {
          completed = true;
        }
      });

      // Wait for stream to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      return { chunks, completed };
    }, baseUrl);

    expect(result.completed).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  test('should allow aborting a stream', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const chunks: string[] = [];
      let completed = false;

      const abortController = new AbortController(); client.fetchStream({ signal: abortController.signal,
        method: 'GET',
        url: `${url}/stream?chunks=10&delay=100`,
        decodeToString: true,
        onData: (chunk: string) => {
          chunks.push(chunk);
        },
        onComplete: () => {
          completed = true;
        }
      });

      // Abort after short delay
      await new Promise(resolve => setTimeout(resolve, 150));
      abortController.abort();

      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 200));

      return { chunks: chunks.length, completed };
    }, baseUrl);

    expect(result.completed).toBe(false);
    expect(result.chunks).toBeLessThan(10);
  });
});

test.describe('HttpClient - SSE (Browser)', () => {
  test('should receive SSE events with JSON parsing', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const events: any[] = [];

      const abortController = new AbortController(); client.sse({ signal: abortController.signal,
        method: 'GET',
        url: `${url}/sse?count=5&delay=50`,
        parseJson: true,
        onEvent: (event: any) => {
          events.push(event);
        }
      });

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 500));
      abortController.abort();

      return { events };
    }, baseUrl);

    expect(result.events.length).toBe(5);
  });

  test('should receive SSE events with text data', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const events: any[] = [];

      const abortController = new AbortController(); client.sse({ signal: abortController.signal,
        method: 'GET',
        url: `${url}/sse-text?count=5&delay=50`,
        parseJson: false,
        onEvent: (event: any) => {
          events.push(event);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      abortController.abort();

      return { events };
    }, baseUrl);

    expect(result.events.length).toBe(5);
  });

  test('should handle SSE events with IDs', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const events: any[] = [];

      client.sse({
        method: 'GET',
        url: `${url}/sse?count=3&includeId=true`,
        parseJson: true,
        onEvent: (event: any) => {
          events.push(event);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      return { events };
    }, baseUrl);

    expect(result.events.length).toBe(3);
    result.events.forEach((event, index) => {
      expect(event.id).toBe(`${index + 1}`);
    });
  });

  test('should handle SSE events with custom event types', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const events: any[] = [];

      client.sse({
        method: 'GET',
        url: `${url}/sse-custom-events`,
        parseJson: false,
        onEvent: (event: any) => {
          events.push(event);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      return { events };
    }, baseUrl);

    expect(result.events.length).toBeGreaterThanOrEqual(4);
    expect(result.events[0].event).toBe('start');
    expect(result.events[1].event).toBe('progress');
    expect(result.events[3].event).toBe('complete');
  });

  test('should handle multiline SSE data', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const events: any[] = [];

      client.sse({
        method: 'GET',
        url: `${url}/sse-multiline?count=3`,
        parseJson: false,
        onEvent: (event: any) => {
          events.push(event);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      return { events };
    }, baseUrl);

    expect(result.events.length).toBe(3);
  });

  test('should handle retry field in SSE', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const events: any[] = [];

      client.sse({
        method: 'GET',
        url: `${url}/sse-retry`,
        parseJson: false,
        onEvent: (event: any) => {
          events.push(event);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      return { events };
    }, baseUrl);

    expect(result.events.length).toBeGreaterThanOrEqual(1);
    const retryEvent = result.events.find(e => e.retry !== undefined);
    expect(retryEvent).toBeDefined();
    expect(retryEvent.retry).toBe(5000);
  });

  test('should allow aborting SSE stream', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const events: any[] = [];
      let completed = false;

      const abortController = new AbortController(); client.sse({ signal: abortController.signal,
        method: 'GET',
        url: `${url}/sse?count=10&delay=100`,
        parseJson: true,
        onEvent: (event: any) => {
          events.push(event);
        },
        onComplete: () => {
          completed = true;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 250));
      abortController.abort();

      await new Promise(resolve => setTimeout(resolve, 200));

      return { events: events.length, completed };
    }, baseUrl);

    expect(result.completed).toBe(false);
    expect(result.events).toBeLessThan(10);
  });
});

test.describe('HttpClient - Interceptors (Browser)', () => {
  test('should apply request interceptor', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient({
        globalInterceptors: [
          async (context: any, next: any) => {
            context.headers['X-Intercepted'] = 'true';
            return await next(context);
          }
        ]
      });

      return await client.fetch({
        method: 'GET',
        url: `${url}/headers`
      });
    }, baseUrl);

    expect(result['x-intercepted']).toBe('true');
  });

  test('should apply multiple interceptors in order', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient({
        globalInterceptors: [
          async (context: any, next: any) => {
            context.headers['X-First'] = '1';
            return await next(context);
          },
          async (context: any, next: any) => {
            context.headers['X-Second'] = '2';
            return await next(context);
          }
        ]
      });

      return await client.fetch({
        method: 'GET',
        url: `${url}/headers`
      });
    }, baseUrl);

    expect(result['x-first']).toBe('1');
    expect(result['x-second']).toBe('2');
  });

  test('should apply request-level interceptors', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();

      return await client.fetch({
        method: 'GET',
        url: `${url}/headers`,
        interceptors: [
          async (context: any, next: any) => {
            context.headers['X-Request-Level'] = 'true';
            return await next(context);
          }
        ]
      });
    }, baseUrl);

    expect(result['x-request-level']).toBe('true');
  });

  test('should combine global and request-level interceptors', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient({
        globalInterceptors: [
          async (context: any, next: any) => {
            context.headers['X-Global'] = 'global';
            return await next(context);
          }
        ]
      });

      return await client.fetch({
        method: 'GET',
        url: `${url}/headers`,
        interceptors: [
          async (context: any, next: any) => {
            context.headers['X-Local'] = 'local';
            return await next(context);
          }
        ]
      });
    }, baseUrl);

    expect(result['x-global']).toBe('global');
    expect(result['x-local']).toBe('local');
  });

  test('should allow interceptor to modify URL', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient({
        globalInterceptors: [
          async (context: any, next: any) => {
            // Add query parameter
            context.url = context.url.includes('?')
              ? `${context.url}&modified=true`
              : `${context.url}?modified=true`;
            return await next(context);
          }
        ]
      });

      return await client.fetch({
        method: 'GET',
        url: `${url}/json`
      });
    }, baseUrl);

    expect(result).toBeDefined();
    expect(result.message).toBe('Hello, World!');
  });

  test('should work with auth interceptor pattern', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient({
        globalInterceptors: [
          async (context: any, next: any) => {
            const token = 'test-token-12345';
            context.headers['Authorization'] = `Bearer ${token}`;
            return await next(context);
          }
        ]
      });

      return await client.fetch({
        method: 'GET',
        url: `${url}/auth`
      });
    }, baseUrl);

    expect(result.message).toBe('Authenticated');
    expect(result.token).toBe('test-token-12345');
  });
});

test.describe('HttpClient - Error Handling (Browser)', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    const error = await page.evaluate(async () => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      try {
        await client.fetch({
          method: 'GET',
          url: 'http://localhost:9999/nonexistent'
        });
        return null;
      } catch (err: any) {
        return {
          message: err.message
        };
      }
    });

    expect(error).not.toBeNull();
    expect(error?.message).toBeTruthy();
  });

  test('should handle stream errors', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      let errorOccurred = false;
      let errorMessage = '';

      client.fetchStream({
        method: 'GET',
        url: 'http://localhost:9999/stream',
        decodeToString: true,
        onError: (error: Error) => {
          errorOccurred = true;
          errorMessage = error.message;
        }
      });

      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 300));

      return { errorOccurred, errorMessage };
    });

    expect(result.errorOccurred).toBe(true);
    expect(result.errorMessage).toBeTruthy();
  });

  test('should handle SSE stream errors', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      let errorOccurred = false;

      client.sse({
        method: 'GET',
        url: 'http://localhost:9999/sse',
        onError: () => {
          errorOccurred = true;
        }
      });

      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 300));

      return { errorOccurred };
    });

    expect(result.errorOccurred).toBe(true);
  });

  test('should handle 401 unauthorized errors', async ({ page }) => {
    const error = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      try {
        await client.fetch({
          method: 'GET',
          url: `${url}/auth`
        });
        return null;
      } catch (err: any) {
        return {
          statusCode: err.statusCode
        };
      }
    }, baseUrl);

    expect(error).not.toBeNull();
    expect(error?.statusCode).toBe(401);
  });
});

test.describe('HttpClient - Progress Tracking (Browser)', () => {
  test('should track upload progress', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const progressEvents: any[] = [];
      const largeData = 'x'.repeat(50000);

      const response = await client.fetch({
        method: 'POST',
        url: `${url}/upload`,
        body: largeData,
        parseJson: true,
        onUploadProgress: (progress: any) => {
          progressEvents.push({
            loaded: progress.loaded,
            total: progress.total,
            percentage: progress.percentage
          });
        }
      });

      return {
        received: response.received,
        progressCount: progressEvents.length,
        firstEvent: progressEvents[0],
        lastEvent: progressEvents[progressEvents.length - 1]
      };
    }, baseUrl);

    expect(result.received).toBe(50000);
    expect(result.progressCount).toBeGreaterThan(0);
    expect(result.firstEvent.loaded).toBeGreaterThan(0);
    expect(typeof result.firstEvent.loaded).toBe('number');

    if (result.lastEvent.total !== undefined) {
      expect(result.lastEvent.loaded).toBe(result.lastEvent.total);
      expect(result.lastEvent.percentage).toBe(100);
    }
  });

  test('should track download progress', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const progressEvents: any[] = [];

      const response = await client.fetch({
        method: 'GET',
        url: `${url}/download?size=50000`,
        parseJson: false,
        onDownloadProgress: (progress: any) => {
          progressEvents.push({
            loaded: progress.loaded,
            total: progress.total,
            percentage: progress.percentage
          });
        }
      });

      return {
        responseLength: response.length,
        progressCount: progressEvents.length,
        firstEvent: progressEvents[0],
        lastEvent: progressEvents[progressEvents.length - 1],
        isIncreasing: progressEvents.length > 1
          ? progressEvents.every((event: any, i: number) =>
            i === 0 || event.loaded >= progressEvents[i - 1].loaded)
          : true
      };
    }, baseUrl);

    expect(result.responseLength).toBe(50000);
    expect(result.progressCount).toBeGreaterThan(0);
    expect(result.firstEvent.loaded).toBeGreaterThan(0);
    expect(typeof result.firstEvent.loaded).toBe('number');
    expect(result.isIncreasing).toBe(true);
  });
});

test.describe('HttpClient - Edge Cases (Browser)', () => {
  test('should handle empty response body', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();

      return await client.fetch({
        method: 'POST',
        url: `${url}/echo`,
        body: '',
        parseJson: false
      });
    }, baseUrl);

    expect(result).toBe('');
  });

  test('should handle large payloads', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();
      const largeData = 'x'.repeat(10000);

      return await client.fetch({
        method: 'POST',
        url: `${url}/upload`,
        body: largeData,
        parseJson: true
      });
    }, baseUrl);

    expect(result.received).toBe(10000);
  });

  test('should handle concurrent requests', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();

      const requests = Array.from({ length: 10 }, (_, i) =>
        client.fetch({
          method: 'GET',
          url: `${url}/json`
        })
      );

      const results = await Promise.all(requests);
      return results;
    }, baseUrl);

    expect(result.length).toBe(10);
    result.forEach(res => {
      expect(res.message).toBe('Hello, World!');
    });
  });

  test('should handle URL with query parameters', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();

      return await client.fetch({
        method: 'GET',
        url: `${url}/json-delayed?delay=50&test=value`
      });
    }, baseUrl);

    expect(result).toBeDefined();
  });

  test('should auto-set Content-Type for JSON body', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();

      return await client.fetch({
        method: 'POST',
        url: `${url}/headers`,
        body: { test: 'data' }
      });
    }, baseUrl);

    expect(result['content-type']).toContain('application/json');
  });

  test('should auto-set Content-Type for string body', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();

      return await client.fetch({
        method: 'POST',
        url: `${url}/headers`,
        body: 'plain text'
      });
    }, baseUrl);

    expect(result['content-type']).toContain('text/plain');
  });

  test('should not override explicitly set Content-Type', async ({ page }) => {
    const result = await page.evaluate(async (url) => {
      const client = new (window as any).FetchStreamSSE.HttpClient();

      return await client.fetch({
        method: 'POST',
        url: `${url}/headers`,
        body: { test: 'data' },
        headers: {
          'Content-Type': 'application/x-custom'
        }
      });
    }, baseUrl);

    expect(result['content-type']).toBe('application/x-custom');
  });
});
