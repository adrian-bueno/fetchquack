---
title: Requests & Responses
description: Understanding HTTP requests and responses in fetchquack
---

Learn how to make different types of HTTP requests and handle their responses.

## Making Requests

### HTTP Methods

fetchquack supports all standard HTTP methods:

```typescript
// GET request
await client.fetch({ method: 'GET', url: '/api/users' });

// POST request
await client.fetch({ method: 'POST', url: '/api/users', body: { name: 'John' } });

// PUT request
await client.fetch({ method: 'PUT', url: '/api/users/1', body: { name: 'Jane' } });

// PATCH request
await client.fetch({ method: 'PATCH', url: '/api/users/1', body: { email: 'new@email.com' } });

// DELETE request
await client.fetch({ method: 'DELETE', url: '/api/users/1' });

// HEAD request
await client.fetch({ method: 'HEAD', url: '/api/health', parseJson: false });

// OPTIONS request
await client.fetch({ method: 'OPTIONS', url: '/api/users', parseJson: false });
```

### Request Body

#### JSON Body (Automatic)

Object bodies are automatically serialized to JSON. The `Content-Type` header is auto-set to `application/json` if not provided:

```typescript
// Content-Type: application/json is set automatically
await client.fetch({
  method: 'POST',
  url: '/api/users',
  body: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  }
});
```

#### Text Body

String bodies get `Content-Type: text/plain` automatically if not set:

```typescript
await client.fetch({
  method: 'POST',
  url: '/api/log',
  body: 'Plain text log message'
});
```

#### Form Data

```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('description', 'My file');

await client.fetch({
  method: 'POST',
  url: '/api/upload',
  body: formData
  // Don't set Content-Type - browser sets it automatically with the boundary
});
```

#### Binary Data

```typescript
const fileBuffer = await file.arrayBuffer();

await client.fetch({
  method: 'POST',
  url: '/api/upload',
  body: fileBuffer,
  headers: {
    'Content-Type': 'application/octet-stream'
  }
});
```

### Request Headers

```typescript
await client.fetch({
  method: 'GET',
  url: '/api/data',
  headers: {
    'Authorization': 'Bearer token123',
    'Accept': 'application/json',
    'X-Custom-Header': 'value'
  }
});
```

## Handling Responses

### JSON Response (Default)

By default, responses are parsed as JSON:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user = await client.fetch<User>({
  method: 'GET',
  url: '/api/users/1'
});

console.log(user.name); // TypeScript knows about the name property
```

### Text Response

Get raw text instead of parsed JSON:

```typescript
const html = await client.fetch({
  method: 'GET',
  url: '/api/template',
  parseJson: false
});

console.log(html); // Raw HTML string
```

### Binary Response

Get binary data as `Uint8Array`:

```typescript
const imageBytes = await client.fetch({
  method: 'GET',
  url: '/api/images/photo.png',
  decodeToString: false
});

// Create a blob and object URL
const blob = new Blob([imageBytes], { type: 'image/png' });
const url = URL.createObjectURL(blob);
imageElement.src = url;
```

## Request Options

### Full Request Configuration

```typescript
interface HttpRequest {
  method: string;                           // Required: HTTP method
  url: string;                              // Required: Request URL
  body?: any;                               // Optional: Request body
  headers?: Record<string, string>;         // Optional: HTTP headers
  parseJson?: boolean;                      // Default: true - parse response as JSON
  decodeToString?: boolean;                 // Default: true - false returns Uint8Array
  signal?: AbortSignal;                     // Optional: Cancellation signal
  interceptors?: HttpInterceptorFn[];       // Optional: Request-specific interceptors
  onUploadProgress?: (progress: HttpProgressEvent) => void;    // Optional
  onDownloadProgress?: (progress: HttpProgressEvent) => void;  // Optional
}
```

### Cancellation

Use `AbortController` to cancel requests:

```typescript
const controller = new AbortController();

const requestPromise = client.fetch({
  method: 'GET',
  url: '/api/slow-endpoint',
  signal: controller.signal
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const data = await requestPromise;
} catch (error) {
  if (error instanceof HttpError && error.statusCode === 0) {
    console.log('Request was cancelled');
  }
}
```

### Request-Specific Interceptors

Add interceptors to individual requests. These run after global interceptors:

```typescript
await client.fetch({
  method: 'GET',
  url: '/api/special',
  interceptors: [
    customAuthInterceptor,
    retryInterceptor
  ]
});
```

## Error Handling

### HttpError

Thrown when a request fails (non-2xx status) or a network error occurs:

```typescript
import { HttpError } from 'fetchquack';

try {
  await client.fetch({ method: 'GET', url: '/api/users/999' });
} catch (error) {
  if (error instanceof HttpError) {
    console.log('Status code:', error.statusCode);  // e.g., 404, 500
    console.log('Message:', error.message);          // Error description
    console.log('Original error:', error.error);     // Underlying Error, if any

    if (error.statusCode === 404) {
      console.log('User not found');
    } else if (error.statusCode >= 500) {
      console.log('Server error');
    } else if (error.statusCode === 0) {
      console.log('Network error or request aborted');
    }
  }
}
```

### HttpJsonParseError

Thrown when the response body cannot be parsed as JSON (extends `HttpError`):

```typescript
import { HttpJsonParseError } from 'fetchquack';

try {
  await client.fetch({ method: 'GET', url: '/api/data' });
} catch (error) {
  if (error instanceof HttpJsonParseError) {
    console.log('Invalid JSON response');
    console.log('Raw text:', error.responseText); // Truncated to ~500 chars
  }
}
```

### Error Properties Reference

```typescript
class HttpError extends Error {
  readonly statusCode: number;  // HTTP status code (0 for network/abort errors)
  readonly message: string;     // Error description
  readonly error?: Error;       // Original error (for chaining)
}

class HttpJsonParseError extends HttpError {
  readonly responseText: string; // Raw response text (truncated to ~500 chars)
  // statusCode is always 0
}
```

## Best Practices

### Type Safety

Always specify response types:

```typescript
// Good - typed response
const user = await client.fetch<User>({ method: 'GET', url: '/api/user' });

// Avoid - untyped response
const user = await client.fetch({ method: 'GET', url: '/api/user' });
```

### Error Handling

Always handle errors appropriately:

```typescript
import { HttpError, HttpJsonParseError } from 'fetchquack';

try {
  const data = await client.fetch<DataType>({
    method: 'GET',
    url: '/api/data'
  });
  processData(data);
} catch (error) {
  if (error instanceof HttpJsonParseError) {
    handleJsonError(error);
  } else if (error instanceof HttpError) {
    handleHttpError(error);
  } else {
    handleUnexpectedError(error);
  }
}
```

### Reusable Request Functions

Create typed request functions for your API:

```typescript
async function getUser(id: number): Promise<User> {
  return client.fetch<User>({
    method: 'GET',
    url: `/api/users/${id}`
  });
}

async function createUser(userData: CreateUserDto): Promise<User> {
  return client.fetch<User>({
    method: 'POST',
    url: '/api/users',
    body: userData
  });
}

async function deleteUser(id: number): Promise<void> {
  await client.fetch({
    method: 'DELETE',
    url: `/api/users/${id}`,
    parseJson: false
  });
}
```

### Automatic Content-Type

fetchquack automatically sets `Content-Type` when not provided:

- **Object body** → `application/json` (body is JSON-stringified)
- **String body** → `text/plain`
- **FormData** → Set automatically by the browser (with boundary)

```typescript
// These are equivalent:
await client.fetch({ method: 'POST', url: '/api', body: { key: 'value' } });
await client.fetch({
  method: 'POST',
  url: '/api',
  body: { key: 'value' },
  headers: { 'Content-Type': 'application/json' }
});
```

## Next Steps

- Learn about [Interceptors](/core/interceptors) for request/response modification
- Explore [Progress Tracking](/features/progress) for uploads and downloads
- Discover [Streaming](/features/streaming) for large responses
