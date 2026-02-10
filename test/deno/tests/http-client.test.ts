/**
 * Deno Test Suite for HttpClient
 * Black-box tests covering all functionality
 *
 * Prerequisites: Mock server must be running on port 3002
 * Start with: bun test/mock-server-standalone.ts --port=3002
 */

import { assertEquals, assertGreaterOrEqual, assertLess, assertRejects } from "@std/assert";
import { HttpClient } from 'fetchquack';
import type { SSEEvent, HttpInterceptorContext, HttpInterceptorNext } from 'fetchquack';

// Mock server should be running on port 3002
const baseUrl = 'http://localhost:3002';

Deno.test("HttpClient - should fetch JSON data", async () => {
  const client = new HttpClient();
  const response = await client.fetch<{ message: string; timestamp: number }>({
    method: 'GET',
    url: `${baseUrl}/json`
  });

  assertEquals(typeof response.message, 'string');
  assertEquals(response.message, 'Hello, World!');
  assertGreaterOrEqual(response.timestamp, 0);
});

Deno.test("HttpClient - should fetch with POST method", async () => {
  const client = new HttpClient();
  const testData = { test: 'data', number: 42 };

  const response = await client.fetch<typeof testData>({
    method: 'POST',
    url: `${baseUrl}/echo`,
    body: testData
  });

  assertEquals(response, testData);
});

Deno.test("HttpClient - should handle delayed responses", async () => {
  const client = new HttpClient();
  const startTime = Date.now();

  const response = await client.fetch<{ message: string; delay: number }>({
    method: 'GET',
    url: `${baseUrl}/json-delayed?delay=200`
  });

  const elapsed = Date.now() - startTime;
  assertEquals(response.message, 'Delayed response');
  assertGreaterOrEqual(elapsed, 190);
});

Deno.test("HttpClient - should send and receive custom headers", async () => {
  const client = new HttpClient();

  const response = await client.fetch<Record<string, string>>({
    method: 'GET',
    url: `${baseUrl}/headers`,
    headers: {
      'X-Custom-Header': 'test-value',
      'X-Another-Header': 'another-value'
    }
  });

  assertEquals(response['x-custom-header'], 'test-value');
  assertEquals(response['x-another-header'], 'another-value');
});

Deno.test("HttpClient - should handle text responses when parseJson is false", async () => {
  const client = new HttpClient();

  const response = await client.fetch<string>({
    method: 'POST',
    url: `${baseUrl}/echo`,
    body: 'plain text content',
    parseJson: false
  });

  assertEquals(response, 'plain text content');
});

Deno.test("HttpClient - should throw HttpError on 404", async () => {
  const client = new HttpClient();

  await assertRejects(
    async () => {
      await client.fetch({
        method: 'GET',
        url: `${baseUrl}/nonexistent`
      });
    },
    Error,
    'HTTP error! status: 404'
  );
});

Deno.test("HttpClient - should throw HttpError on 500", async () => {
  const client = new HttpClient();

  await assertRejects(
    async () => {
      await client.fetch({
        method: 'GET',
        url: `${baseUrl}/status?code=500`
      });
    },
    Error,
    'HTTP error! status: 500'
  );
});

Deno.test("HttpClient - should handle different HTTP methods", async () => {
  const client = new HttpClient();

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  for (const method of methods) {
    const response = await client.fetch({
      method,
      url: `${baseUrl}/json`
    });

    assertEquals(typeof response, 'object');
  }
});

Deno.test("HttpClient - should stream text data", async () => {
  const client = new HttpClient();
  const chunks: string[] = [];
  let completed = false;
  let errorOccurred = false;

  client.fetchStream({
    method: 'GET',
    url: `${baseUrl}/stream?chunks=5&delay=50`,
    decodeToString: true,
    onData: (chunk: string) => {
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

  assertEquals(errorOccurred, false);
  assertEquals(completed, true);
  assertGreaterOrEqual(chunks.length, 1);

  const fullText = chunks.join('');
  assertEquals(fullText.includes('Chunk 1'), true);
  assertEquals(fullText.includes('Chunk 5'), true);
});

Deno.test("HttpClient - should stream binary data", async () => {
  const client = new HttpClient();
  const chunks: Uint8Array[] = [];
  let completed = false;

  client.fetchStream({
    method: 'GET',
    url: `${baseUrl}/stream-binary?chunks=5&delay=30`,
    decodeToString: false,
    onData: (chunk: Uint8Array) => {
      chunks.push(chunk);
    },
    onComplete: () => {
      completed = true;
    }
  });

  // Wait for stream to complete
  await new Promise(resolve => setTimeout(resolve, 300));

  assertEquals(completed, true);
  assertGreaterOrEqual(chunks.length, 1);

  // Verify binary data
  chunks.forEach((chunk) => {
    assertEquals(chunk instanceof Uint8Array, true);
  });
});

Deno.test("HttpClient - should allow aborting a stream", async () => {
  const client = new HttpClient();
  const chunks: string[] = [];
  let completed = false;

  const abortController = new AbortController(); client.fetchStream({ signal: abortController.signal,
    method: 'GET',
    url: `${baseUrl}/stream?chunks=10&delay=100`,
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

  assertEquals(completed, false);
  assertLess(chunks.length, 10);
});

Deno.test("HttpClient - should receive SSE events with JSON parsing", async () => {
  const client = new HttpClient();
  const events: any[] = [];
  let completed = false;
  let errorOccurred = false;

  const abortController = new AbortController(); client.sse({ signal: abortController.signal,
    method: 'GET',
    url: `${baseUrl}/sse?count=5&delay=50`,
    parseJson: true,
    onEvent: (event: SSEEvent) => {
      events.push(event);
    },
    onError: () => {
      errorOccurred = true;
    }
  });

  // Wait for events
  await new Promise(resolve => setTimeout(resolve, 500));
  abortController.abort();

  assertEquals(errorOccurred, false);
  assertEquals(events.length, 5);

  events.forEach((event, index) => {
    assertEquals(typeof event.data, 'object');
    assertEquals(event.data.index, index + 1);
    assertEquals(event.data.message, `Event ${index + 1}`);
  });
});

Deno.test("HttpClient - should receive SSE events with text data", async () => {
  const client = new HttpClient();
  const events: any[] = [];
  let completed = false;

  const abortController = new AbortController(); client.sse({ signal: abortController.signal,
    method: 'GET',
    url: `${baseUrl}/sse-text?count=5&delay=50`,
    parseJson: false,
    onEvent: (event: SSEEvent) => {
      events.push(event);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 500));
  abortController.abort();

  assertEquals(events.length, 5);

  events.forEach((event, index) => {
    assertEquals(typeof event.data, 'string');
    assertEquals(event.data, `Message ${index + 1}`);
  });
});

Deno.test("HttpClient - should handle SSE events with IDs", async () => {
  const client = new HttpClient();
  const events: any[] = [];

  const abortController = new AbortController(); client.sse({ signal: abortController.signal,
    method: 'GET',
    url: `${baseUrl}/sse?count=3&includeId=true`,
    parseJson: true,
    onEvent: (event: SSEEvent) => {
      events.push(event);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 500));
  abortController.abort();

  assertEquals(events.length, 3);
  events.forEach((event, index) => {
    assertEquals(event.id, `${index + 1}`);
  });
});

Deno.test("HttpClient - should handle SSE events with custom event types", async () => {
  const client = new HttpClient();
  const events: any[] = [];

  const abortController = new AbortController(); client.sse({ signal: abortController.signal,
    method: 'GET',
    url: `${baseUrl}/sse-custom-events`,
    parseJson: false,
    onEvent: (event: SSEEvent) => {
      events.push(event);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 600));
  abortController.abort();

  assertGreaterOrEqual(events.length, 4);
  assertEquals(events[0].event, 'start');
  assertEquals(events[1].event, 'progress');
  assertEquals(events[3].event, 'complete');
});

Deno.test("HttpClient - should handle multiline SSE data", async () => {
  const client = new HttpClient();
  const events: any[] = [];

  const abortController = new AbortController(); client.sse({ signal: abortController.signal,
    method: 'GET',
    url: `${baseUrl}/sse-multiline?count=3`,
    parseJson: false,
    onEvent: (event: SSEEvent) => {
      events.push(event);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 500));
  abortController.abort();

  assertEquals(events.length, 3);
  events.forEach((event, index) => {
    assertEquals(event.data.includes(`Line 1 for event ${index + 1}`), true);
    assertEquals(event.data.includes(`Line 2 for event ${index + 1}`), true);
    assertEquals(event.data.includes(`Line 3 for event ${index + 1}`), true);
  });
});

Deno.test("HttpClient - should handle retry field in SSE", async () => {
  const client = new HttpClient();
  const events: any[] = [];

  const abortController = new AbortController(); client.sse({ signal: abortController.signal,
    method: 'GET',
    url: `${baseUrl}/sse-retry`,
    parseJson: false,
    onEvent: (event: SSEEvent) => {
      events.push(event);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 300));
  abortController.abort();

  assertGreaterOrEqual(events.length, 1);
  const retryEvent = events.find(e => e.retry !== undefined);
  assertEquals(retryEvent !== undefined, true);
  assertEquals(retryEvent.retry, 5000);
});

Deno.test("HttpClient - should allow aborting SSE stream", async () => {
  const client = new HttpClient();
  const events: any[] = [];
  let completed = false;

  const abortController = new AbortController(); client.sse({ signal: abortController.signal,
    method: 'GET',
    url: `${baseUrl}/sse?count=10&delay=100`,
    parseJson: true,
    onEvent: (event: SSEEvent) => {
      events.push(event);
    },
    onComplete: () => {
      completed = true;
    }
  });

  await new Promise(resolve => setTimeout(resolve, 250));
  abortController.abort();

  await new Promise(resolve => setTimeout(resolve, 200));

  assertEquals(completed, false);
  assertLess(events.length, 10);
});

Deno.test("HttpClient - should apply request interceptor to modify headers", async () => {
  const client = new HttpClient({
    globalInterceptors: [
      async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
        context.headers['X-Intercepted'] = 'true';
        return next(context);
      }
    ]
  });

  const response = await client.fetch<Record<string, string>>({
    method: 'GET',
    url: `${baseUrl}/headers`
  });

  assertEquals(response['x-intercepted'], 'true');
});

Deno.test("HttpClient - should apply multiple interceptors in order", async () => {
  const client = new HttpClient({
    globalInterceptors: [
      async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
        context.headers['X-First'] = '1';
        return next(context);
      },
      async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
        context.headers['X-Second'] = '2';
        return next(context);
      }
    ]
  });

  const response = await client.fetch<Record<string, string>>({
    method: 'GET',
    url: `${baseUrl}/headers`
  });

  assertEquals(response['x-first'], '1');
  assertEquals(response['x-second'], '2');
});

Deno.test("HttpClient - should apply request-level interceptors", async () => {
  const client = new HttpClient();

  const response = await client.fetch<Record<string, string>>({
    method: 'GET',
    url: `${baseUrl}/headers`,
    interceptors: [
      async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
        context.headers['X-Request-Level'] = 'true';
        return next(context);
      }
    ]
  });

  assertEquals(response['x-request-level'], 'true');
});

Deno.test("HttpClient - should combine global and request-level interceptors", async () => {
  const client = new HttpClient({
    globalInterceptors: [
      async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
        context.headers['X-Global'] = 'global';
        return next(context);
      }
    ]
  });

  const response = await client.fetch<Record<string, string>>({
    method: 'GET',
    url: `${baseUrl}/headers`,
    interceptors: [
      async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
        context.headers['X-Local'] = 'local';
        return next(context);
      }
    ]
  });

  assertEquals(response['x-global'], 'global');
  assertEquals(response['x-local'], 'local');
});

Deno.test("HttpClient - should allow interceptor to modify URL", async () => {
  const client = new HttpClient({
    globalInterceptors: [
      async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
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

  assertEquals(typeof response.message, 'string');
});

Deno.test("HttpClient - should work with auth interceptor pattern", async () => {
  const client = new HttpClient({
    globalInterceptors: [
      async (context: HttpInterceptorContext, next: HttpInterceptorNext) => {
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

  assertEquals(response.message, 'Authenticated');
  assertEquals(response.token, 'test-token-12345');
});

Deno.test("HttpClient - should handle network errors gracefully", async () => {
  const client = new HttpClient();

  await assertRejects(
    async () => {
      await client.fetch({
        method: 'GET',
        url: 'http://localhost:9999/nonexistent'
      });
    },
    Error
  );
});

Deno.test("HttpClient - should handle stream errors", async () => {
  const client = new HttpClient();
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

  await new Promise(resolve => setTimeout(resolve, 300));

  assertEquals(errorOccurred, true);
  assertEquals(errorMessage !== '', true);
});

Deno.test("HttpClient - should handle SSE stream errors", async () => {
  const client = new HttpClient();
  let errorOccurred = false;

  const abortController = new AbortController(); client.sse({ signal: abortController.signal,
    method: 'GET',
    url: 'http://localhost:9999/sse',
    onError: () => {
      errorOccurred = true;
    }
  });

  await new Promise(resolve => setTimeout(resolve, 300));
  abortController.abort();

  assertEquals(errorOccurred, true);
});

Deno.test("HttpClient - should handle 401 unauthorized errors", async () => {
  const client = new HttpClient();

  await assertRejects(
    async () => {
      await client.fetch({
        method: 'GET',
        url: `${baseUrl}/auth`
      });
    },
    Error,
    'HTTP error! status: 401'
  );
});

Deno.test("HttpClient - should track upload progress", async () => {
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

  assertEquals(response.received, 50000);
  assertGreaterOrEqual(progressEvents.length, 1);

  // Verify progress events have correct structure
  progressEvents.forEach(event => {
    assertGreaterOrEqual(event.loaded, 1);
    assertEquals(typeof event.loaded, 'number');
    if (event.total !== undefined) {
      assertGreaterOrEqual(event.total, 1);
      assertGreaterOrEqual(event.percentage!, 0);
      assertLess(event.percentage!, 101);
    }
  });

  // Last event should have full data
  const lastEvent = progressEvents[progressEvents.length - 1];
  if (lastEvent.total !== undefined) {
    assertEquals(lastEvent.loaded, lastEvent.total);
    assertEquals(lastEvent.percentage, 100);
  }
});

Deno.test("HttpClient - should track download progress", async () => {
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

  assertEquals(response.length, 50000);
  assertGreaterOrEqual(progressEvents.length, 1);

  // Verify progress events have correct structure
  progressEvents.forEach(event => {
    assertGreaterOrEqual(event.loaded, 1);
    assertEquals(typeof event.loaded, 'number');
    if (event.total !== undefined) {
      assertGreaterOrEqual(event.total, 1);
      assertGreaterOrEqual(event.percentage!, 0);
      assertLess(event.percentage!, 101);
    }
  });

  // Progress should increase over time
  if (progressEvents.length > 1) {
    for (let i = 1; i < progressEvents.length; i++) {
      assertGreaterOrEqual(progressEvents[i].loaded, progressEvents[i - 1].loaded);
    }
  }
});

Deno.test("HttpClient - should handle empty response body", async () => {
  const client = new HttpClient();

  const response = await client.fetch<string>({
    method: 'POST',
    url: `${baseUrl}/echo`,
    body: '',
    parseJson: false
  });

  assertEquals(response, '');
});

Deno.test("HttpClient - should handle large payloads", async () => {
  const client = new HttpClient();
  const largeData = 'x'.repeat(10000);

  const response = await client.fetch<{ received: number }>({
    method: 'POST',
    url: `${baseUrl}/upload`,
    body: largeData,
    parseJson: true
  });

  assertEquals(response.received, 10000);
});

Deno.test("HttpClient - should handle concurrent requests", async () => {
  const client = new HttpClient();

  const requests = Array.from({ length: 10 }, (_, i) =>
    client.fetch({
      method: 'GET',
      url: `${baseUrl}/json`
    })
  );

  const results = await Promise.all(requests);

  assertEquals(results.length, 10);
  results.forEach((result: any) => {
    assertEquals(result.message, 'Hello, World!');
  });
});

Deno.test("HttpClient - should handle URL with query parameters", async () => {
  const client = new HttpClient();

  const response = await client.fetch({
    method: 'GET',
    url: `${baseUrl}/json-delayed?delay=50&test=value`
  });

  assertEquals(typeof response, 'object');
});

Deno.test("HttpClient - should auto-set Content-Type for JSON body", async () => {
  const client = new HttpClient();

  const response = await client.fetch<Record<string, string>>({
    method: 'POST',
    url: `${baseUrl}/headers`,
    body: { test: 'data' }
  });

  assertEquals(response['content-type'].includes('application/json'), true);
});

Deno.test("HttpClient - should auto-set Content-Type for string body", async () => {
  const client = new HttpClient();

  const response = await client.fetch<Record<string, string>>({
    method: 'POST',
    url: `${baseUrl}/headers`,
    body: 'plain text'
  });

  assertEquals(response['content-type'].includes('text/plain'), true);
});

Deno.test("HttpClient - should not override explicitly set Content-Type", async () => {
  const client = new HttpClient();

  const response = await client.fetch<Record<string, string>>({
    method: 'POST',
    url: `${baseUrl}/headers`,
    body: { test: 'data' },
    headers: {
      'Content-Type': 'application/x-custom'
    }
  });

  assertEquals(response['content-type'], 'application/x-custom');
});
