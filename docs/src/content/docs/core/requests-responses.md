---
title: Requests & Responses
description: Understanding HTTP requests and responses in FetchQuack
---

# Requests & Responses

Learn how to make different types of HTTP requests and handle their responses.

## Making Requests

### HTTP Methods

FetchQuack supports all standard HTTP methods:

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
await client.fetch({ method: 'HEAD', url: '/api/health' });

// OPTIONS request
await client.fetch({ method: 'OPTIONS', url: '/api/users' });
```

### Request Body

#### JSON Body (Automatic)

The most common use case - automatically serialized to JSON:

```typescript
await client.fetch({
  method: 'POST',
  url: '/api/users',
  body: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  },
  headers: {
    'Content-Type': 'application/json'
  }
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
  // Don't set Content-Type - browser will set it automatically with boundary
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

#### Text Body

```typescript
await client.fetch({
  method: 'POST',
  url: '/api/log',
  body: 'Plain text log message',
  headers: {
    'Content-Type': 'text/plain'
  }
});
```

### Request Headers

#### Setting Headers

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

#### Common Header Patterns

```typescript
// JSON request
headers: {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

// Authentication
headers: {
  'Authorization': 'Bearer ' + token
}

// API Key
headers: {
  'X-API-Key': apiKey
}

// CORS
headers: {
  'Origin': 'https://example.com'
}
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

To get raw text instead of parsing JSON:

```typescript
const html = await client.fetch<string>({
  method: 'GET',
  url: '/api/template',
  parseJson: false
});

console.log(html); // Raw HTML string
```

### Binary Response

To get binary data as `Uint8Array`:

```typescript
const imageBytes = await client.fetch<Uint8Array>({
  method: 'GET',
  url: '/api/images/photo.png',
  decodeToString: false
});

// Create a blob and object URL
const blob = new Blob([imageBytes], { type: 'image/png' });
const url = URL.createObjectURL(blob);

// Use in an img tag
imageElement.src = url;
```

### Response Metadata

Access response metadata through error handling:

```typescript
try {
  const data = await client.fetch({
    method: 'GET',
    url: '/api/data'
  });
} catch (error) {
  if (error instanceof HttpError) {
    console.log('Status Code:', error.statusCode);
    console.log('Status Text:', error.statusText);
    console.log('Response:', error.response);
  }
}
```

## Request Options

### Full Request Configuration

```typescript
interface HttpRequest {
  method: string;                           // Required: HTTP method
  url: string;                              // Required: Request URL
  body?: any;                               // Optional: Request body
  headers?: Record<string, string>;         // Optional: HTTP headers
  parseJson?: boolean;                      // Default: true
  decodeToString?: boolean;                 // Default: true
  signal?: AbortSignal;                     // Optional: Cancellation signal
  interceptors?: HttpInterceptorFn[];       // Optional: Request-specific interceptors
  onUploadProgress?: (progress) => void;    // Optional: Upload progress callback
  onDownloadProgress?: (progress) => void;  // Optional: Download progress callback
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
  if (error.name === 'AbortError') {
    console.log('Request was cancelled');
  }
}
```

### Request-Specific Interceptors

Add interceptors to individual requests:

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

### HTTP Errors

```typescript
import { HttpError } from 'fetchquack';

try {
  await client.fetch({ method: 'GET', url: '/api/users/999' });
} catch (error) {
  if (error instanceof HttpError) {
    if (error.statusCode === 404) {
      console.log('User not found');
    } else if (error.statusCode === 500) {
      console.log('Server error');
    } else if (error.statusCode === 0) {
      console.log('Network error or request aborted');
    }
  }
}
```

### JSON Parse Errors

```typescript
import { HttpJsonParseError } from 'fetchquack';

try {
  await client.fetch({ method: 'GET', url: '/api/data' });
} catch (error) {
  if (error instanceof HttpJsonParseError) {
    console.log('Invalid JSON response');
    console.log('Raw text:', error.responseText);
  }
}
```

## Best Practices

### Type Safety

Always specify response types:

```typescript
// Good
const user = await client.fetch<User>({ method: 'GET', url: '/api/user' });

// Avoid
const user = await client.fetch({ method: 'GET', url: '/api/user' });
```

### Error Handling

Always handle errors appropriately:

```typescript
try {
  const data = await client.fetch<DataType>({
    method: 'GET',
    url: '/api/data'
  });
  processData(data);
} catch (error) {
  handleError(error);
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
```

## Next Steps

- Learn about [Interceptors](/core/interceptors) for request/response modification
- Explore [Progress Tracking](/features/progress) for uploads and downloads
- Discover [Streaming](/features/streaming) for large responses
