---
title: HTTP Client
description: Learn about the HttpClient class and its configuration options
---

The `HttpClient` class is the core of FetchQuack. It provides methods for making HTTP requests, streaming responses, and handling Server-Sent Events.

## Creating a Client

### Basic Usage

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient();
```

### With Global Interceptors

```typescript
import { HttpClient } from 'fetchquack';
import { authInterceptor } from 'fetchquack/interceptors/auth';
import { loggingInterceptor } from 'fetchquack/interceptors/logging';

const client = new HttpClient({
  globalInterceptors: [
    authInterceptor({ getToken: () => localStorage.getItem('token') }),
    loggingInterceptor()
  ]
});
```

## Configuration Options

The `HttpClient` constructor accepts an optional configuration object:

### HttpClientOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `globalInterceptors` | `HttpInterceptorFn[]` | `[]` | Array of interceptors applied to all requests made with this client |

## Methods

The `HttpClient` provides three main methods:

### fetch()

Makes a standard HTTP request and returns a Promise with the response data.

```typescript
// JSON response (default)
const data = await client.fetch<User>({
  method: 'GET',
  url: '/api/users/1'
});

// Text response
const html = await client.fetch({
  method: 'GET',
  url: '/page.html',
  parseJson: false
});

// Binary response
const bytes = await client.fetch({
  method: 'GET',
  url: '/image.png',
  decodeToString: false
});
```

[Learn more about requests and responses](/core/requests-responses)

### fetchStream()

Streams response data chunk by chunk through callbacks. Returns `void` (not a Promise). Use `AbortController` to cancel the stream.

```typescript
const controller = new AbortController();

client.fetchStream({
  method: 'GET',
  url: '/api/large-file',
  signal: controller.signal,
  decodeToString: true,
  onData: (chunk) => console.log('Received:', chunk),
  onError: (error) => console.error('Error:', error),
  onComplete: () => console.log('Stream complete')
});

// Cancel the stream
// controller.abort();
```

[Learn more about streaming](/features/streaming)

### sse()

Connects to a Server-Sent Events endpoint with automatic event parsing and reconnection support. Returns `void` (not a Promise). Use `AbortController` to close the connection.

```typescript
const controller = new AbortController();

client.sse({
  method: 'GET',
  url: '/api/events',
  signal: controller.signal,
  autoReconnect: true,
  onEvent: (event) => console.log('Event:', event.data),
  onError: (error) => console.error('Error:', error),
  onComplete: () => console.log('Connection closed')
});

// Close the connection
// controller.abort();
```

[Learn more about Server-Sent Events](/features/sse)

## Multiple Clients

You can create multiple client instances with different configurations:

```typescript
import { authInterceptor } from 'fetchquack/interceptors/auth';
import { loggingInterceptor } from 'fetchquack/interceptors/logging';
import { headerInterceptor } from 'fetchquack/interceptors/header';

// Public API client
const publicClient = new HttpClient();

// Authenticated API client
const authClient = new HttpClient({
  globalInterceptors: [authInterceptor({ getToken: () => getAuthToken() })]
});

// Admin API client with additional interceptors
const adminClient = new HttpClient({
  globalInterceptors: [
    authInterceptor({ getToken: () => getAdminToken() }),
    loggingInterceptor({ prefix: '[ADMIN]' }),
    headerInterceptor({ headers: { 'X-Admin': 'true' } })
  ]
});
```

## TypeScript Support

The client is fully typed and provides excellent IntelliSense support:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Response data is typed as User
const user = await client.fetch<User>({
  method: 'GET',
  url: '/api/users/1'
});

// TypeScript knows user has id, name, and email properties
console.log(user.name);
```

## Platform Compatibility

The `HttpClient` works seamlessly across all platforms:

- **Browser** - Uses native Fetch API and XMLHttpRequest for progress tracking
- **Node.js** - Requires Node.js 18+ with native fetch support
- **Bun** - Full support with Bun's optimized runtime
- **Deno** - Works with Deno's secure runtime

No platform-specific code needed -- one client works everywhere.

## Next Steps

- Learn about [Request and Response handling](/core/requests-responses)
- Discover how to use [Interceptors](/core/interceptors)
- Explore advanced [Streaming](/features/streaming) techniques
