---
title: Quick Start
description: Get up and running with fetchquack in minutes
---

Learn the basics of fetchquack in just a few minutes.

## Basic Usage

### Creating a Client

First, create an instance of `HttpClient`:

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient();
```

### Making Requests

#### GET Request

```typescript
// Simple GET - response is automatically parsed as JSON
const users = await client.fetch<User[]>({
  method: 'GET',
  url: '/api/users'
});
console.log(users);

// With query parameters
const url = new URL('/users', 'https://api.example.com');
url.searchParams.set('page', '1');
url.searchParams.set('limit', '10');

const pagedUsers = await client.fetch<User[]>({
  method: 'GET',
  url: url.toString()
});
```

#### POST Request

```typescript
// Object bodies are automatically serialized to JSON
// Content-Type is auto-set to 'application/json' for object bodies
const newUser = await client.fetch<User>({
  method: 'POST',
  url: '/api/users',
  body: {
    name: 'John Doe',
    email: 'john@example.com',
  }
});
```

#### Other Methods

```typescript
// PUT
await client.fetch({ method: 'PUT', url: '/api/users/1', body: { name: 'Jane Doe' } });

// PATCH
await client.fetch({ method: 'PATCH', url: '/api/users/1', body: { email: 'jane@example.com' } });

// DELETE
await client.fetch({ method: 'DELETE', url: '/api/users/1' });
```

#### Text Response

```typescript
const html = await client.fetch({
  method: 'GET',
  url: '/api/page',
  parseJson: false
});
```

#### Binary Response

```typescript
const imageData = await client.fetch({
  method: 'GET',
  url: '/api/image.png',
  decodeToString: false  // Returns Uint8Array instead of parsing as JSON/text
});
// imageData is a Uint8Array
```

## Streaming Responses

Stream response data chunk by chunk. `fetchStream()` returns `void` and delivers data through callbacks. Use `AbortController` to cancel:

```typescript
const controller = new AbortController();

client.fetchStream({
  method: 'GET',
  url: '/api/large-file',
  signal: controller.signal,
  decodeToString: true,
  onData: (chunk) => {
    console.log('Received chunk:', chunk);
  },
  onComplete: () => {
    console.log('Stream finished!');
  },
  onError: (error) => {
    console.error('Stream error:', error);
  }
});

// Cancel at any time
// controller.abort();
```

## Server-Sent Events

Handle SSE with automatic reconnection. `sse()` also returns `void` and uses callbacks:

```typescript
const controller = new AbortController();

client.sse({
  method: 'GET',
  url: '/api/events',
  signal: controller.signal,
  autoReconnect: true,
  onEvent: (event) => {
    console.log('Event:', event.data);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
  onComplete: () => {
    console.log('Connection closed');
  }
});

// Close the connection
// controller.abort();
```

## Progress Tracking

Monitor upload and download progress:

```typescript
const response = await client.fetch({
  method: 'POST',
  url: '/api/upload',
  body: largeFile,
  onUploadProgress: (progress) => {
    console.log(`Upload: ${progress.percentage}%`);
  },
  onDownloadProgress: (progress) => {
    console.log(`Download: ${progress.percentage}%`);
  },
});
```

## Error Handling

fetchquack provides detailed error information:

```typescript
import { HttpError, HttpJsonParseError } from 'fetchquack';

try {
  await client.fetch({ method: 'GET', url: '/api/data' });
} catch (error) {
  if (error instanceof HttpJsonParseError) {
    // JSON parsing failed
    console.error('Invalid JSON:', error.responseText);
  } else if (error instanceof HttpError) {
    // HTTP error (4xx, 5xx) or network error
    console.error(`HTTP ${error.statusCode}: ${error.message}`);
    // statusCode is 0 for network errors or aborted requests
  }
}
```

## Request Cancellation

Use `AbortController` to cancel any request:

```typescript
const controller = new AbortController();

const promise = client.fetch({
  method: 'GET',
  url: '/api/slow-endpoint',
  signal: controller.signal
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const data = await promise;
} catch (error) {
  if (error instanceof HttpError && error.statusCode === 0) {
    console.log('Request was cancelled');
  }
}
```

## Using Interceptors

Add authentication or logging with interceptors globally:

```typescript
import { HttpClient } from 'fetchquack';
import { authInterceptor } from 'fetchquack/interceptors/auth';
import { loggingInterceptor } from 'fetchquack/interceptors/logging';

const client = new HttpClient({
  globalInterceptors: [
    authInterceptor({ getToken: () => 'your-auth-token' }),
    loggingInterceptor(),
  ],
});
```

## Next Steps

- Learn more about [HTTP Client configuration](/core/http-client)
- Explore [Interceptors](/core/interceptors) in depth
- Discover advanced [Streaming](/features/streaming) techniques
- Integrate with [Angular](/integrations/angular) applications
