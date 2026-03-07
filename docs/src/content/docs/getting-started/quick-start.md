---
title: Quick Start
description: Get up and running with FetchQuack in minutes
---

Learn the basics of FetchQuack in just a few minutes.

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
// Simple GET
const response = await client.fetch({
  method: 'GET',
  url: '/users'
});
console.log(response);

// With query parameters (append manually or handle via URL constructor)
const url = new URL('/users', 'https://api.example.com');
url.searchParams.set('page', '1');
url.searchParams.set('limit', '10');

const responseWithParams = await client.fetch({
  method: 'GET',
  url: url.toString()
});
```

#### POST Request

```typescript
const response = await client.fetch({
  method: 'POST',
  url: '/users',
  body: {
    name: 'John Doe',
    email: 'john@example.com',
  },
  headers: {
    'Content-Type': 'application/json'
  }
});
```

#### Other Methods

```typescript
// PUT
await client.fetch({ method: 'PUT', url: '/users/1', body: { name: 'Jane Doe' } });

// PATCH
await client.fetch({ method: 'PATCH', url: '/users/1', body: { email: 'jane@example.com' } });

// DELETE
await client.fetch({ method: 'DELETE', url: '/users/1' });
```

## Streaming Responses

FetchQuack makes streaming incredibly easy:

```typescript
await client.fetchStream({
  method: 'GET',
  url: '/large-file',
  decodeToString: true,
  onData: (chunk) => {
    console.log('Received chunk:', chunk);
  },
  onComplete: () => {
    console.log('Stream finished!');
  }
});
```

## Server-Sent Events

Handle SSE with automatic reconnection:

```typescript
await client.sse({
  method: 'GET',
  url: '/events',
  autoReconnect: true,
  onEvent: (event) => {
    console.log('Event:', event.data);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});
```

## Progress Tracking

Monitor upload and download progress:

```typescript
const response = await client.fetch({
  method: 'POST',
  url: '/upload',
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

FetchQuack provides detailed error information:

```typescript
import { HttpError } from 'fetchquack';

try {
  await client.fetch({ method: 'GET', url: '/api/data' });
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP ${error.statusCode}: ${error.statusText}`);
    console.error('Response:', error.response);
  } else {
    console.error('Network error:', error);
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
