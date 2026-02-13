---
title: Retry Policies
description: Configure automatic retry behavior for failed requests
---

# Retry Policies

FetchQuack provides flexible retry policies for handling connection failures, especially useful for Server-Sent Events auto-reconnect.

## Retry Policy Configuration

```typescript
interface RetryPolicyConfig {
  maxRetries: number;         // Maximum retry attempts (0 = unlimited)
  initialInterval: number;    // Initial delay in milliseconds
  maxInterval: number;        // Maximum delay cap in milliseconds
  backoffMultiplier: number;  // Exponential backoff multiplier
  jitter: number;             // Random jitter range in milliseconds
}
```

## Default Retry Policy

The default retry policy for SSE:

```typescript
{
  maxRetries: 0,              // Unlimited retries
  initialInterval: 3000,      // Start with 3 seconds
  maxInterval: 30000,         // Cap at 30 seconds
  backoffMultiplier: 2,       // Double each time
  jitter: 1000                // Add 0-1 second randomness
}
```

## SSE with Retry Policy

```typescript
await client.sse({
  method: 'GET',
  url: '/api/events',
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 10,           // Try 10 times
    initialInterval: 1000,    // Start with 1 second
    maxInterval: 30000,       // Max 30 seconds
    backoffMultiplier: 2,     // Double delay each retry
    jitter: 1000              // Add 0-1s randomness
  },
  onEvent: (event) => {
    console.log('Event:', event.data);
  },
  onError: (error) => {
    console.warn('Connection error, will retry...', error);
  }
});
```

## Exponential Backoff

How retry delays are calculated:

```
Attempt 1: 1000ms + random(0-1000)ms = ~1000-2000ms
Attempt 2: 2000ms + random(0-1000)ms = ~2000-3000ms
Attempt 3: 4000ms + random(0-1000)ms = ~4000-5000ms
Attempt 4: 8000ms + random(0-1000)ms = ~8000-9000ms
Attempt 5: 16000ms + random(0-1000)ms = ~16000-17000ms
Attempt 6: 30000ms (capped) + random(0-1000)ms = ~30000-31000ms
```

## Unlimited Retries

For critical connections that should never give up:

```typescript
await client.sse({
  method: 'GET',
  url: '/api/critical-events',
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 0,            // Never stop trying
    initialInterval: 2000,
    maxInterval: 60000,       // Max 1 minute between retries
    backoffMultiplier: 1.5,
    jitter: 500
  },
  onEvent: (event) => processCriticalEvent(event),
  onError: (error) => logRetryAttempt(error)
});
```

## Fast Retry Policy

For low-latency environments:

```typescript
retryPolicy: {
  maxRetries: 5,
  initialInterval: 500,       // Start fast
  maxInterval: 5000,          // Cap at 5 seconds
  backoffMultiplier: 1.5,     // Slower growth
  jitter: 200
}
```

## Server-Suggested Retry Interval

SSE servers can suggest retry intervals:

```
Server sends:
retry: 5000
data: some data
```

FetchQuack respects the server's suggestion but still applies the retry policy bounds (initialInterval and maxInterval).

## Custom Retry Logic

For more control, implement a custom interceptor:

```typescript
import { HttpInterceptorFn, HttpError } from 'fetchquack';

const customRetryInterceptor: HttpInterceptorFn = async (context, next) => {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      return await next(context);
    } catch (error) {
      // Don't retry on 4xx errors (client errors)
      if (error instanceof HttpError && 
          error.statusCode >= 400 && 
          error.statusCode < 500) {
        throw error;
      }
      
      // Retry on 5xx or network errors
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('Max retries exceeded');
};

const client = new HttpClient({
  globalInterceptors: [customRetryInterceptor]
});
```

## Conditional Retry

Only retry certain types of errors:

```typescript
retryPolicy: {
  maxRetries: 5,
  initialInterval: 1000,
  maxInterval: 10000,
  backoffMultiplier: 2,
  jitter: 500,
  // Custom: only retry on network errors, not HTTP errors
  shouldRetry: (error) => {
    if (error instanceof HttpError) {
      // Don't retry on HTTP errors
      return false;
    }
    // Retry on network errors
    return true;
  }
}
```

## Monitoring Retries

Track retry attempts:

```typescript
let retryCount = 0;

await client.sse({
  method: 'GET',
  url: '/api/events',
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 10,
    initialInterval: 1000,
    maxInterval: 30000,
    backoffMultiplier: 2,
    jitter: 1000
  },
  onEvent: (event) => {
    if (retryCount > 0) {
      console.log(`Reconnected after ${retryCount} attempts`);
      retryCount = 0;
    }
    processEvent(event);
  },
  onError: (error) => {
    retryCount++;
    console.log(`Retry attempt ${retryCount}`);
    
    // Alert user after multiple failures
    if (retryCount >= 5) {
      showConnectionWarning('Connection unstable, retrying...');
    }
  }
});
```

## Best Practices

### Use Jitter

Always add jitter to prevent thundering herd:

```typescript
// Good - with jitter
retryPolicy: {
  maxRetries: 5,
  initialInterval: 1000,
  backoffMultiplier: 2,
  jitter: 500  // Prevents all clients retrying at exact same time
}

// Avoid - no jitter
retryPolicy: {
  maxRetries: 5,
  initialInterval: 1000,
  backoffMultiplier: 2,
  jitter: 0    // All clients retry simultaneously
}
```

### Cap Maximum Interval

Prevent excessively long waits:

```typescript
retryPolicy: {
  maxRetries: 0,              // Unlimited
  initialInterval: 1000,
  maxInterval: 60000,         // Don't wait more than 1 minute
  backoffMultiplier: 2,
  jitter: 1000
}
```

### Finite Retries for User-Initiated Actions

```typescript
// User clicked a button
await client.fetch({
  method: 'POST',
  url: '/api/action',
  interceptors: [
    createRetryInterceptor({
      maxRetries: 3,          // Give up after 3 tries
      initialInterval: 1000
    })
  ]
});
```

### Unlimited for Background Connections

```typescript
// Background SSE connection
await client.sse({
  method: 'GET',
  url: '/api/live-updates',
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 0,            // Keep trying forever
    initialInterval: 2000,
    maxInterval: 60000
  }
});
```

## Next Steps

- Learn about [Server-Sent Events](/features/sse) that use retry policies
- Explore [Interceptors](/core/interceptors) for custom retry logic
- Check out the [Error Handling](/core/requests-responses#error-handling) guide
