---
title: Interceptors
description: Powerful middleware system for request and response handling
---

Interceptors are a powerful middleware system that allows you to modify requests and responses globally or per-request. They're perfect for authentication, logging, error handling, retries, and more.

## How Interceptors Work

Interceptors wrap around the HTTP request, allowing you to:

- Modify requests before they're sent
- Transform responses before they're returned
- Handle errors globally
- Add authentication headers
- Log requests and responses
- Implement retry logic

## Basic Interceptor

Here's a simple interceptor that adds a custom header to all requests:

```typescript
import { HttpInterceptorFn } from 'fetchquack';

const customHeaderInterceptor: HttpInterceptorFn = async (context, next) => {
  // Modify the request
  context.headers['X-Custom-Header'] = 'MyValue';
  
  // Continue to the next interceptor or the actual request
  const response = await next(context);
  
  // Optionally modify the response
  return response;
};
```

## Built-in Interceptors

FetchQuack includes several ready-to-use interceptors:

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
| `getToken` | `() => string \| null \| Promise<string \| null>` | Required | Function to retrieve the auth token |
| `headerName` | `string` | `'Authorization'` | Name of the auth header |
| `tokenPrefix` | `string` | `'Bearer '` | Prefix before the token |

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
| `prefix` | `string` | `''` | Prefix for log messages |
| `secretHeaders` | `string[]` | `[]` | Headers to mask in logs |
| `sanitizeBody` | `boolean` | `false` | Hide request/response bodies |
| `shouldSkipLogging` | `(ctx) => boolean` | `undefined` | Function to skip logging for certain requests |

### Header Interceptor

Adds custom headers to all requests:

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

### CSRF Interceptor

Automatically handles CSRF tokens (Browser only):

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
const retryInterceptor: HttpInterceptorFn = async (context, next) => {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await next(context);
    } catch (error) {
      lastError = error;
      
      // Don't retry on 4xx errors
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
      // Transform to your app's error format
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
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cacheInterceptor: HttpInterceptorFn = async (context, next) => {
  // Only cache GET requests
  if (context.method !== 'GET') {
    return next(context);
  }
  
  const cacheKey = context.url;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Returning cached response for', cacheKey);
    return cached.data;
  }
  
  const response = await next(context);
  cache.set(cacheKey, { data: response, timestamp: Date.now() });
  
  return response;
};
```

## Interceptor Context

Interceptors receive a context object with request information:

```typescript
interface HttpInterceptorContext {
  method: string;
  url: string;
  body?: any;
  headers: Record<string, string>;
  signal?: AbortSignal;
  // ... other properties
}
```

You can modify any property in the context before calling `next()`.

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

Request-level interceptors are executed after global interceptors:

```typescript
const client = new HttpClient({
  globalInterceptors: [loggingInterceptor()]  // Runs first
});

await client.fetch({
  method: 'GET',
  url: '/api/data',
  interceptors: [authInterceptor(...)]  // Runs second
});
```

## Execution Order

Interceptors execute in order, wrapping each other like layers:

```typescript
const client = new HttpClient({
  globalInterceptors: [
    loggingInterceptor(),    // 1st: logs request
    authInterceptor(...),    // 2nd: adds auth
    headerInterceptor(...)   // 3rd: adds headers → actual request
    // Response flows back: 3rd → 2nd → 1st
  ]
});
```

Think of it as an onion:
1. Request goes through each layer
2. Actual HTTP request is made
3. Response comes back through each layer in reverse

## Angular Integration

In Angular, interceptors can use dependency injection:

```typescript
import { inject } from '@angular/core';
import { HttpInterceptorFn } from 'fetchquack';

const angularAuthInterceptor: HttpInterceptorFn = async (context, next) => {
  // Use inject() to get Angular services
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
const authInterceptor = ...;
const loggingInterceptor = ...;
const retryInterceptor = ...;

// Avoid - doing too much in one interceptor
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
    retryInterceptor()        // Retry should wrap the actual request
  ]
});
```

### Handle Errors Gracefully

Always consider error cases:

```typescript
const safeInterceptor: HttpInterceptorFn = async (context, next) => {
  try {
    // Modify request
    context.headers['X-Custom'] = 'value';
    return await next(context);
  } catch (error) {
    // Handle or rethrow
    console.error('Request failed:', error);
    throw error;
  }
};
```

## Next Steps

- Explore [Streaming](/features/streaming) capabilities
- Learn about [Progress Tracking](/features/progress)
- Discover [Server-Sent Events](/features/sse) support
