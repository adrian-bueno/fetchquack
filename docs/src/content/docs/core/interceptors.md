---
title: Interceptors
description: Powerful middleware system for request and response handling
---

Interceptors are a middleware system that lets you modify requests and responses globally or per-request. They're useful for authentication, logging, error handling, retries, and more.

## How Interceptors Work

Interceptors wrap around the HTTP request, allowing you to:

- Modify requests before they're sent
- Transform responses before they're returned
- Handle errors globally
- Add authentication headers
- Log requests and responses
- Implement retry logic
- Short-circuit requests (e.g., return cached responses without hitting the network)

## Basic Interceptor

Here's a simple interceptor that adds a custom header:

```typescript
import { HttpInterceptorFn } from 'fetchquack';

const customHeaderInterceptor: HttpInterceptorFn = async (context, next) => {
  // Modify the request before it's sent
  context.headers['X-Custom-Header'] = 'MyValue';
  
  // Call next() to continue to the next interceptor or the actual request
  const response = await next(context);
  
  // Optionally inspect or modify the response
  return response;
};
```

## Built-in Interceptors

fetchquack includes several ready-to-use interceptors.

### Authentication Interceptor

Automatically adds authentication tokens to requests:

```typescript
import { authInterceptor } from 'fetchquack/interceptors/auth';

const client = new HttpClient({
  globalInterceptors: [
    authInterceptor({
      getToken: () => localStorage.getItem('authToken'),
      headerName: 'Authorization',  // default
      tokenPrefix: 'Bearer '        // default
    })
  ]
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `getToken` | `() => string \| null \| Promise<string \| null>` | *Required* | Function to retrieve the auth token. Return `null` to skip adding the header. |
| `headerName` | `string` | `'Authorization'` | Name of the auth header |
| `tokenPrefix` | `string` | `'Bearer '` | Prefix before the token. Set to `''` for API keys. |
| `shouldSkipAuth` | `(context: HttpInterceptorContext) => boolean` | `() => false` | Return `true` to skip auth for certain requests |

**Examples:**

```typescript
// API Key authentication (no prefix)
authInterceptor({
  getToken: () => process.env.API_KEY,
  headerName: 'X-API-Key',
  tokenPrefix: ''
})

// Async token with refresh
authInterceptor({
  getToken: async () => {
    const token = getStoredToken();
    if (isExpired(token)) {
      return await refreshToken();
    }
    return token;
  }
})

// Skip auth for public endpoints
authInterceptor({
  getToken: () => getToken(),
  shouldSkipAuth: (ctx) => ctx.url.startsWith('/public/')
})
```

### Logging Interceptor

Logs all requests and responses for debugging:

```typescript
import { loggingInterceptor } from 'fetchquack/interceptors/logging';

const client = new HttpClient({
  globalInterceptors: [
    loggingInterceptor({
      prefix: '[API]',
      secretHeaders: ['Authorization', 'X-API-Key'],
      sanitizeBody: true,
      shouldSkipLogging: (ctx) => ctx.url.includes('/health')
    })
  ]
});

// Console output:
// [API] [abc123] [REQ] { method: 'GET', url: '/api/users', headers: {...} }
// [API] [abc123] [RES] { status: 200, duration: '45ms' }
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `'[HTTP]'` | Prefix for log messages |
| `secretHeaders` | `string[]` | `['Authorization']` | Headers to mask as `'<secret>'` in logs (case-insensitive) |
| `sanitizeBody` | `boolean` | `false` | Hide request/response bodies in logs |
| `colorizeRequestId` | `boolean` | `true` | Use ANSI colors for request IDs |
| `shouldSkipLogging` | `(ctx: HttpInterceptorContext) => boolean` | `() => false` | Return `true` to skip logging for certain requests |

### Header Interceptor

Adds custom headers to requests:

```typescript
import { headerInterceptor } from 'fetchquack/interceptors/header';

const client = new HttpClient({
  globalInterceptors: [
    headerInterceptor({
      headers: {
        'X-API-Version': '2.0',
        'X-Client-Type': 'web',
        'Accept-Language': 'en-US'
      }
    })
  ]
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `headers` | `Record<string, string>` | *Required* | Headers to add to every request |
| `shouldAddHeaders` | `(context: HttpInterceptorContext) => boolean` | `() => true` | Return `false` to skip adding headers for certain requests |

**Example with conditional headers:**

```typescript
headerInterceptor({
  headers: { 'X-Internal': 'true' },
  shouldAddHeaders: (ctx) => ctx.url.startsWith('/internal/')
})
```

### CSRF Interceptor

Automatically handles CSRF tokens (browser only):

```typescript
import { csrfInterceptor } from 'fetchquack/interceptors/csrf';

const client = new HttpClient({
  globalInterceptors: [
    csrfInterceptor({
      cookieName: 'XSRF-TOKEN',     // default
      headerName: 'X-XSRF-TOKEN',   // default
      protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE']  // default
    })
  ]
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cookieName` | `string` | `'XSRF-TOKEN'` | Cookie name containing the CSRF token |
| `headerName` | `string` | `'X-XSRF-TOKEN'` | Header name to send the token in |
| `protectedMethods` | `string[]` | `['POST', 'PUT', 'PATCH', 'DELETE']` | HTTP methods that require CSRF protection |

**Example for Django:**

```typescript
csrfInterceptor({
  cookieName: 'csrftoken',
  headerName: 'X-CSRFToken'
})
```

## Custom Interceptors

### Timing Interceptor

Measure request duration:

```typescript
import { HttpInterceptorFn } from 'fetchquack';

const timingInterceptor: HttpInterceptorFn = async (context, next) => {
  const start = performance.now();
  
  try {
    const response = await next(context);
    const duration = performance.now() - start;
    console.log(`${context.method} ${context.url} - ${duration.toFixed(2)}ms`);
    return response;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`${context.method} ${context.url} - FAILED after ${duration.toFixed(2)}ms`);
    throw error;
  }
};
```

### Retry Interceptor

Automatically retry failed requests:

```typescript
import { HttpInterceptorFn, HttpError } from 'fetchquack';

const retryInterceptor: HttpInterceptorFn = async (context, next) => {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await next(context);
    } catch (error) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors)
      if (error instanceof HttpError && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        console.log(`Retrying request (attempt ${attempt + 2}/${maxRetries + 1})...`);
      }
    }
  }
  
  throw lastError;
};
```

### Error Handler Interceptor

Transform errors into a consistent format:

```typescript
const errorHandlerInterceptor: HttpInterceptorFn = async (context, next) => {
  try {
    return await next(context);
  } catch (error) {
    if (error instanceof HttpError) {
      throw new AppError({
        code: `HTTP_${error.statusCode}`,
        message: error.message,
        statusCode: error.statusCode,
        url: context.url
      });
    }
    throw error;
  }
};
```

### Cache Interceptor

Implement simple response caching:

```typescript
const cache = new Map<string, { response: HttpInterceptorResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cacheInterceptor: HttpInterceptorFn = async (context, next) => {
  // Only cache GET requests
  if (context.method !== 'GET') {
    return next(context);
  }
  
  const cacheKey = context.url;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache hit for', cacheKey);
    return cached.response;
  }
  
  const response = await next(context);
  cache.set(cacheKey, { response, timestamp: Date.now() });
  
  return response;
};
```

## Interceptor Context

Interceptors receive a context object with request information:

```typescript
interface HttpInterceptorContext {
  method: string;                          // HTTP method (uppercased)
  url: string;                             // Request URL
  body?: string | object | null;           // Request body
  headers: Record<string, string>;         // HTTP headers (mutable)
  metadata?: Record<string, any>;          // Custom metadata for passing data between interceptors
}
```

The `metadata` field is used internally to flag streaming and SSE requests:
- `metadata.streaming === true` for `fetchStream()` and `sse()` calls
- `metadata.sse === true` for `sse()` calls

You can also use `metadata` to pass data between your own interceptors:

```typescript
const addRequestIdInterceptor: HttpInterceptorFn = async (context, next) => {
  context.metadata = context.metadata || {};
  context.metadata.requestId = crypto.randomUUID();
  context.headers['X-Request-ID'] = context.metadata.requestId;
  return next(context);
};
```

## Global vs Request-Level Interceptors

### Global Interceptors

Applied to all requests made with a client:

```typescript
const client = new HttpClient({
  globalInterceptors: [
    authInterceptor({ getToken: () => getToken() }),
    loggingInterceptor()
  ]
});
```

### Request-Level Interceptors

Applied to specific requests only:

```typescript
await client.fetch({
  method: 'GET',
  url: '/api/special',
  interceptors: [
    specialAuthInterceptor,
    cacheInterceptor
  ]
});
```

### Combining Both

Request-level interceptors run after global interceptors:

```typescript
const client = new HttpClient({
  globalInterceptors: [loggingInterceptor()]  // Runs first
});

await client.fetch({
  method: 'GET',
  url: '/api/data',
  interceptors: [cacheInterceptor]  // Runs second
});

// Execution order:
// 1. loggingInterceptor (pre-request)
// 2. cacheInterceptor (pre-request) → actual HTTP request
// 3. cacheInterceptor (post-response)
// 4. loggingInterceptor (post-response)
```

## Execution Order

Interceptors execute in order, wrapping each other like layers of an onion:

```typescript
const client = new HttpClient({
  globalInterceptors: [
    loggingInterceptor(),    // 1st: logs request → last to process response
    authInterceptor(...),    // 2nd: adds auth header
    headerInterceptor(...)   // 3rd: adds headers → actual HTTP request
  ]
});
```

1. Request passes through each interceptor in order
2. The actual HTTP request is made
3. Response comes back through each interceptor in reverse order

## Angular Integration

In Angular, interceptors can use dependency injection thanks to `provideNgxHttpClient()`:

```typescript
import { inject } from '@angular/core';
import { HttpInterceptorFn } from 'fetchquack';

const angularAuthInterceptor: HttpInterceptorFn = async (context, next) => {
  // inject() works here because provideNgxHttpClient wraps interceptors
  // in Angular's injection context
  const authService = inject(AuthService);
  const token = await authService.getToken();
  
  if (token) {
    context.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return next(context);
};

// In app.config.ts
import { provideNgxHttpClient } from 'fetchquack/ngx';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxHttpClient({
      globalInterceptors: [angularAuthInterceptor]
    })
  ]
};
```

## Best Practices

### Keep Interceptors Focused

Each interceptor should have a single responsibility:

```typescript
// Good - focused interceptors
const client = new HttpClient({
  globalInterceptors: [
    authInterceptor({ ... }),
    loggingInterceptor(),
    retryInterceptor
  ]
});

// Avoid - one interceptor doing too much
const megaInterceptor = async (context, next) => {
  // adds auth, logs, retries, caches, etc.
};
```

### Order Matters

Place interceptors in logical order:

```typescript
const client = new HttpClient({
  globalInterceptors: [
    loggingInterceptor(),     // Log everything first
    authInterceptor(...),     // Add auth before other modifications
    headerInterceptor(...),   // Add other headers
    retryInterceptor          // Retry should wrap the actual request
  ]
});
```

### Handle Errors Gracefully

Always consider error cases in your interceptors:

```typescript
const safeInterceptor: HttpInterceptorFn = async (context, next) => {
  try {
    context.headers['X-Custom'] = 'value';
    return await next(context);
  } catch (error) {
    console.error('Request failed:', error);
    throw error; // Always re-throw unless you're intentionally handling the error
  }
};
```

## Next Steps

- Explore [Streaming](/features/streaming) capabilities
- Learn about [Progress Tracking](/features/progress)
- Discover [Server-Sent Events](/features/sse) support
