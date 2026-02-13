---
title: Quick Start
description: Get up and running with FetchQuack in minutes
---

# Quick Start

Learn the basics of FetchQuack in just a few minutes.

## Basic Usage

### Creating a Client

First, create an instance of `HttpClient`:

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient({
  baseURL: 'https://api.example.com',
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Making Requests

#### GET Request

```typescript
// Simple GET
const response = await client.get('/users');
console.log(response.data);

// With query parameters
const response = await client.get('/users', {
  params: { page: 1, limit: 10 },
});
```

#### POST Request

```typescript
const response = await client.post('/users', {
  body: {
    name: 'John Doe',
    email: 'john@example.com',
  },
});
```

#### Other Methods

```typescript
// PUT
await client.put('/users/1', { body: { name: 'Jane Doe' } });

// PATCH
await client.patch('/users/1', { body: { email: 'jane@example.com' } });

// DELETE
await client.delete('/users/1');
```

## Streaming Responses

FetchQuack makes streaming incredibly easy:

```typescript
await client.stream('/large-file', {
  onChunk: (chunk) => {
    console.log('Received chunk:', chunk);
  },
});
```

## Server-Sent Events

Handle SSE with automatic reconnection:

```typescript
await client.sse('/events', {
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
const response = await client.post('/upload', {
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
try {
  await client.get('/api/data');
} catch (error) {
  if (error.isHttpError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.error('Response:', error.response);
  } else {
    console.error('Network error:', error);
  }
}
```

## Using Interceptors

Add authentication or logging with interceptors:

```typescript
import { HttpClient } from 'fetchquack';
import { authInterceptor, loggingInterceptor } from 'fetchquack/interceptors';

const client = new HttpClient({
  baseURL: 'https://api.example.com',
  interceptors: [
    authInterceptor({ token: 'your-auth-token' }),
    loggingInterceptor(),
  ],
});
```

## Next Steps

- Learn more about [HTTP Client configuration](/core/http-client)
- Explore [Interceptors](/core/interceptors) in depth
- Discover advanced [Streaming](/features/streaming) techniques
- Integrate with [Angular](/integrations/angular) applications
