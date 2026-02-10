/**
 * Node.js Test Suite for HttpClient
 * Black-box tests covering all functionality
 *
 * Prerequisites: Mock server must be running on port 3001
 * Start with: bun ../mock-server/server.ts --port=3001
 */

import { describe, it, expect } from 'vitest';
import { HttpClient } from 'fetchquack';

// Mock server should be running on port 3001
const baseUrl = 'http://localhost:3001';

describe('HttpClient - Basic Requests (Node.js)', () => {
  it('should fetch JSON data', async () => {
    const client = new HttpClient();
    const response = await client.fetch<{ message: string; timestamp: number }>({
      method: 'GET',
      url: `${baseUrl}/json`
    });

    expect(response).toBeDefined();
    expect(response.message).toBe('Hello, World!');
    expect(response.timestamp).toBeGreaterThan(0);
  });

  it('should fetch with POST method', async () => {
    const client = new HttpClient();
    const testData = { test: 'data', number: 42 };

    const response = await client.fetch<typeof testData>({
      method: 'POST',
      url: `${baseUrl}/echo`,
      body: testData
    });

    expect(response).toEqual(testData);
  });

  it('should handle delayed responses', async () => {
    const client = new HttpClient();
    const startTime = Date.now();

    const response = await client.fetch<{ message: string; delay: number }>({
      method: 'GET',
      url: `${baseUrl}/json-delayed?delay=200`
    });

    const elapsed = Date.now() - startTime;
    expect(response.message).toBe('Delayed response');
    expect(elapsed).toBeGreaterThanOrEqual(190);
  });

  it('should send and receive custom headers', async () => {
    const client = new HttpClient();

    const response = await client.fetch<Record<string, string>>({
      method: 'GET',
      url: `${baseUrl}/headers`,
      headers: {
        'X-Custom-Header': 'test-value',
        'X-Another-Header': 'another-value'
      }
    });

    expect(response['x-custom-header']).toBe('test-value');
    expect(response['x-another-header']).toBe('another-value');
  });

  it('should handle text responses when parseJson is false', async () => {
    const client = new HttpClient();

    const response = await client.fetch<string>({
      method: 'POST',
      url: `${baseUrl}/echo`,
      body: 'plain text content',
      parseJson: false
    });

    expect(response).toBe('plain text content');
  });

  it('should throw HttpError on 404', async () => {
    const client = new HttpClient();

    await expect(
      client.fetch({
        method: 'GET',
        url: `${baseUrl}/nonexistent`
      })
    ).rejects.toThrow('HTTP error! status: 404');
  });

  it('should throw HttpError on 500', async () => {
    const client = new HttpClient();

    await expect(
      client.fetch({
        method: 'GET',
        url: `${baseUrl}/status?code=500`
      })
    ).rejects.toThrow('HTTP error! status: 500');
  });

  it('should handle different HTTP methods', async () => {
    const client = new HttpClient();

    // Test with different methods
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    for (const method of methods) {
      const response = await client.fetch({
        method,
        url: `${baseUrl}/json`
      });

      expect(response).toBeDefined();
    }
  });
});

describe('HttpClient - Streaming (Node.js)', () => {
  it('should stream text data', async () => {
    const client = new HttpClient();
    const chunks: string[] = [];
    let completed = false;
    let errorOccurred = false;

    const abortController = new AbortController(); client.fetchStream({ signal: abortController.signal,
      method: 'GET',
      url: `${baseUrl}/stream?chunks=5&delay=50`,
      decodeToString: true,
      onData: (chunk) => {
        chunks.push(chunk);
      },
      onError: () => {
        errorOccurred = true;
      },
      onComplete: () => {
        completed = true;
      }
    });

    // Wait for stream to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(errorOccurred).toBe(false);
    expect(completed).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);

    const fullText = chunks.join('');
    expect(fullText).toContain('Chunk 1');
    expect(fullText).toContain('Chunk 5');
  });

  it('should stream binary data', async () => {
    const client = new HttpClient();
    const chunks: Uint8Array[] = [];
    let completed = false;

    client.fetchStream({
      method: 'GET',
      url: `${baseUrl}/stream-binary?chunks=5&delay=30`,
      decodeToString: false,
      onData: (chunk) => {
        chunks.push(chunk);
      },
      onComplete: () => {
        completed = true;
      }
    });

    // Wait for stream to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(completed).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);

    // Verify binary data
    chunks.forEach((chunk) => {
      expect(chunk instanceof Uint8Array).toBe(true);
    });
  });

  it('should allow aborting a stream', async () => {
    const client = new HttpClient();
    const chunks: string[] = [];
    let completed = false;

    const abortController = new AbortController(); client.fetchStream({ signal: abortController.signal,
      method: 'GET',
      url: `${baseUrl}/stream?chunks=10&delay=100`,
      decodeToString: true,
      onData: (chunk) => {
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

    expect(completed).toBe(false);
    expect(chunks.length).toBeLessThan(10);
  });
});

describe('HttpClient - SSE (Node.js)', () => {
  it('should receive SSE events with JSON parsing', async () => {
    const client = new HttpClient();
    const events: any[] = [];
    let completed = false;
    let errorOccurred = false;

    const abortController = new AbortController(); client.sse({ signal: abortController.signal,
      method: 'GET',
      url: `${baseUrl}/sse?count=5&delay=50`,
      parseJson: true,
      onEvent: (event) => {
        events.push(event);
      },
      onError: () => {
        errorOccurred = true;
      }
    });

    // Wait for events
    await new Promise(resolve => setTimeout(resolve, 500));
    abortController.abort();

    expect(errorOccurred).toBe(false);
    expect(events.length).toBe(5);

    events.forEach((event, index) => {
      expect(event.data).toBeDefined();
      expect(event.data.index).toBe(index + 1);
      expect(event.data.message).toBe(`Event ${index + 1}`);
    });
  });

  it('should receive SSE events with text data', async () => {
    const client = new HttpClient();
    const events: any[] = [];
    let completed = false;

    const abortController = new AbortController(); client.sse({ signal: abortController.signal,
      method: 'GET',
      url: `${baseUrl}/sse-text?count=5&delay=50`,
      parseJson: false,
      onEvent: (event) => {
        events.push(event);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 500));
    abortController.abort();

    expect(events.length).toBe(5);

    events.forEach((event, index) => {
      expect(typeof event.data).toBe('string');
      expect(event.data).toBe(`Message ${index + 1}`);
    });
  });

  it('should handle SSE events with IDs', async () => {
    const client = new HttpClient();
    const events: any[] = [];

    client.sse({
      method: 'GET',
      url: `${baseUrl}/sse?count=3&includeId=true`,
      parseJson: true,
      onEvent: (event) => {
        events.push(event);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    expect(events.length).toBe(3);
    events.forEach((event, index) => {
      expect(event.id).toBe(`${index + 1}`);
    });
  });

  it('should handle SSE events with custom event types', async () => {
    const client = new HttpClient();
    const events: any[] = [];

    client.sse({
      method: 'GET',
      url: `${baseUrl}/sse-custom-events`,
      parseJson: false,
      onEvent: (event) => {
        events.push(event);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 600));

    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events[0].event).toBe('start');
    expect(events[1].event).toBe('progress');
    expect(events[3].event).toBe('complete');
  });

  it('should handle multiline SSE data', async () => {
    const client = new HttpClient();
    const events: any[] = [];

    client.sse({
      method: 'GET',
      url: `${baseUrl}/sse-multiline?count=3`,
      parseJson: false,
      onEvent: (event) => {
        events.push(event);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    expect(events.length).toBe(3);
    events.forEach((event, index) => {
      expect(event.data).toContain(`Line 1 for event ${index + 1}`);
      expect(event.data).toContain(`Line 2 for event ${index + 1}`);
      expect(event.data).toContain(`Line 3 for event ${index + 1}`);
    });
  });

  it('should handle retry field in SSE', async () => {
    const client = new HttpClient();
    const events: any[] = [];

    client.sse({
      method: 'GET',
      url: `${baseUrl}/sse-retry`,
      parseJson: false,
      onEvent: (event) => {
        events.push(event);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBeGreaterThanOrEqual(1);
    const retryEvent = events.find(e => e.retry !== undefined);
    expect(retryEvent).toBeDefined();
    expect(retryEvent.retry).toBe(5000);
  });

  it('should allow aborting SSE stream', async () => {
    const client = new HttpClient();
    const events: any[] = [];
    let completed = false;

    const abortController = new AbortController(); client.sse({ signal: abortController.signal,
      method: 'GET',
      url: `${baseUrl}/sse?count=10&delay=100`,
      parseJson: true,
      onEvent: (event) => {
        events.push(event);
      },
      onComplete: () => {
        completed = true;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 250));
    abortController.abort();

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(completed).toBe(false);
    expect(events.length).toBeLessThan(10);
  });
});

describe('HttpClient - Interceptors (Node.js)', () => {
  it('should apply request interceptor to modify headers', async () => {
    const client = new HttpClient({
      globalInterceptors: [
        async (context, next) => {
          context.headers['X-Intercepted'] = 'true';
          return next(context);
        }
      ]
    });

    const response = await client.fetch<Record<string, string>>({
      method: 'GET',
      url: `${baseUrl}/headers`
    });

    expect(response['x-intercepted']).toBe('true');
  });

  it('should apply multiple interceptors in order', async () => {
    const client = new HttpClient({
      globalInterceptors: [
        async (context, next) => {
          context.headers['X-First'] = '1';
          return next(context);
        },
        async (context, next) => {
          context.headers['X-Second'] = '2';
          return next(context);
        }
      ]
    });

    const response = await client.fetch<Record<string, string>>({
      method: 'GET',
      url: `${baseUrl}/headers`
    });

    expect(response['x-first']).toBe('1');
    expect(response['x-second']).toBe('2');
  });

  it('should apply request-level interceptors', async () => {
    const client = new HttpClient();

    const response = await client.fetch<Record<string, string>>({
      method: 'GET',
      url: `${baseUrl}/headers`,
      interceptors: [
        async (context, next) => {
          context.headers['X-Request-Level'] = 'true';
          return next(context);
        }
      ]
    });

    expect(response['x-request-level']).toBe('true');
  });

  it('should combine global and request-level interceptors', async () => {
    const client = new HttpClient({
      globalInterceptors: [
        async (context, next) => {
          context.headers['X-Global'] = 'global';
          return next(context);
        }
      ]
    });

    const response = await client.fetch<Record<string, string>>({
      method: 'GET',
      url: `${baseUrl}/headers`,
      interceptors: [
        async (context, next) => {
          context.headers['X-Local'] = 'local';
          return next(context);
        }
      ]
    });

    expect(response['x-global']).toBe('global');
    expect(response['x-local']).toBe('local');
  });

  it('should allow interceptor to modify URL', async () => {
    const client = new HttpClient({
      globalInterceptors: [
        async (context, next) => {
          // Add query parameter
          context.url = context.url.includes('?')
            ? `${context.url}&modified=true`
            : `${context.url}?modified=true`;
          return next(context);
        }
      ]
    });

    const response = await client.fetch<{ message: string }>({
      method: 'GET',
      url: `${baseUrl}/json`
    });

    expect(response).toBeDefined();
  });

  it('should work with auth interceptor pattern', async () => {
    const client = new HttpClient({
      globalInterceptors: [
        async (context, next) => {
          // Simulate auth interceptor
          const token = 'test-token-12345';
          context.headers['Authorization'] = `Bearer ${token}`;
          return next(context);
        }
      ]
    });

    const response = await client.fetch<{ message: string; token: string }>({
      method: 'GET',
      url: `${baseUrl}/auth`
    });

    expect(response.message).toBe('Authenticated');
    expect(response.token).toBe('test-token-12345');
  });
});

describe('HttpClient - Error Handling (Node.js)', () => {
  it('should handle network errors gracefully', async () => {
    const client = new HttpClient();

    await expect(
      client.fetch({
        method: 'GET',
        url: 'http://localhost:9999/nonexistent'
      })
    ).rejects.toThrow();
  });

  it('should handle stream errors', async () => {
    const client = new HttpClient();
    let errorOccurred = false;
    let errorMessage = '';

    client.fetchStream({
      method: 'GET',
      url: 'http://localhost:9999/stream',
      decodeToString: true,
      onError: (error) => {
        errorOccurred = true;
        errorMessage = error.message;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(errorOccurred).toBe(true);
    expect(errorMessage).toBeTruthy();
  });

  it('should handle SSE stream errors', async () => {
    const client = new HttpClient();
    let errorOccurred = false;

    client.sse({
      method: 'GET',
      url: 'http://localhost:9999/sse',
      onError: () => {
        errorOccurred = true;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(errorOccurred).toBe(true);
  });

  it('should handle 401 unauthorized errors', async () => {
    const client = new HttpClient();

    await expect(
      client.fetch({
        method: 'GET',
        url: `${baseUrl}/auth`
      })
    ).rejects.toThrow('HTTP error! status: 401');
  });
});

describe('HttpClient - Progress Tracking (Node.js)', () => {
  it('should track upload progress', async () => {
    const client = new HttpClient();
    const progressEvents: any[] = [];
    const largeData = 'x'.repeat(50000);

    const response = await client.fetch<{ received: number }>({
      method: 'POST',
      url: `${baseUrl}/upload`,
      body: largeData,
      parseJson: true,
      onUploadProgress: (progress) => {
        progressEvents.push(progress);
      }
    });

    expect(response.received).toBe(50000);
    expect(progressEvents.length).toBeGreaterThan(0);

    // Verify progress events have correct structure
    progressEvents.forEach(event => {
      expect(event.loaded).toBeGreaterThan(0);
      expect(typeof event.loaded).toBe('number');
      if (event.total !== undefined) {
        expect(event.total).toBeGreaterThan(0);
        expect(event.percentage).toBeGreaterThanOrEqual(0);
        expect(event.percentage).toBeLessThanOrEqual(100);
      }
    });

    // Last event should have full data
    const lastEvent = progressEvents[progressEvents.length - 1];
    if (lastEvent.total !== undefined) {
      expect(lastEvent.loaded).toBe(lastEvent.total);
      expect(lastEvent.percentage).toBe(100);
    }
  });

  it('should track download progress', async () => {
    const client = new HttpClient();
    const progressEvents: any[] = [];

    const response = await client.fetch<string>({
      method: 'GET',
      url: `${baseUrl}/download?size=50000`,
      parseJson: false,
      onDownloadProgress: (progress) => {
        progressEvents.push(progress);
      }
    });

    expect(response.length).toBe(50000);
    expect(progressEvents.length).toBeGreaterThan(0);

    // Verify progress events have correct structure
    progressEvents.forEach(event => {
      expect(event.loaded).toBeGreaterThan(0);
      expect(typeof event.loaded).toBe('number');
      if (event.total !== undefined) {
        expect(event.total).toBeGreaterThan(0);
        expect(event.percentage).toBeGreaterThanOrEqual(0);
        expect(event.percentage).toBeLessThanOrEqual(100);
      }
    });

    // Progress should increase over time
    if (progressEvents.length > 1) {
      for (let i = 1; i < progressEvents.length; i++) {
        expect(progressEvents[i].loaded).toBeGreaterThanOrEqual(progressEvents[i - 1].loaded);
      }
    }
  });
});

describe('HttpClient - Edge Cases (Node.js)', () => {
  it('should handle empty response body', async () => {
    const client = new HttpClient();

    const response = await client.fetch<string>({
      method: 'POST',
      url: `${baseUrl}/echo`,
      body: '',
      parseJson: false
    });

    expect(response).toBe('');
  });

  it('should handle large payloads', async () => {
    const client = new HttpClient();
    const largeData = 'x'.repeat(10000);

    const response = await client.fetch<{ received: number }>({
      method: 'POST',
      url: `${baseUrl}/upload`,
      body: largeData,
      parseJson: true
    });

    expect(response.received).toBe(10000);
  });

  it('should handle concurrent requests', async () => {
    const client = new HttpClient();

    const requests = Array.from({ length: 10 }, (_, i) =>
      client.fetch({
        method: 'GET',
        url: `${baseUrl}/json`
      })
    );

    const results = await Promise.all(requests);

    expect(results.length).toBe(10);
    results.forEach(result => {
      expect(result.message).toBe('Hello, World!');
    });
  });

  it('should handle URL with query parameters', async () => {
    const client = new HttpClient();

    const response = await client.fetch({
      method: 'GET',
      url: `${baseUrl}/json-delayed?delay=50&test=value`
    });

    expect(response).toBeDefined();
  });

  it('should auto-set Content-Type for JSON body', async () => {
    const client = new HttpClient();

    const response = await client.fetch<Record<string, string>>({
      method: 'POST',
      url: `${baseUrl}/headers`,
      body: { test: 'data' }
    });

    expect(response['content-type']).toContain('application/json');
  });

  it('should auto-set Content-Type for string body', async () => {
    const client = new HttpClient();

    const response = await client.fetch<Record<string, string>>({
      method: 'POST',
      url: `${baseUrl}/headers`,
      body: 'plain text'
    });

    expect(response['content-type']).toContain('text/plain');
  });

  it('should not override explicitly set Content-Type', async () => {
    const client = new HttpClient();

    const response = await client.fetch<Record<string, string>>({
      method: 'POST',
      url: `${baseUrl}/headers`,
      body: { test: 'data' },
      headers: {
        'Content-Type': 'application/x-custom'
      }
    });

    expect(response['content-type']).toBe('application/x-custom');
  });
});
