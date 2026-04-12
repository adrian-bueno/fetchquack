---
title: Retry Policies
description: Configure automatic retry behavior for SSE connections
---

fetchquack provides configurable retry policies with exponential backoff for SSE auto-reconnect. You can also implement custom retry logic for regular requests using interceptors.

## Retry Policy Configuration

All properties are optional. Provide only what you want to override:

```typescript
interface RetryPolicyConfig {
  maxRetries?: number;         // Max retry attempts (0 = unlimited). Default: 0
  initialInterval?: number;    // Initial delay in ms. Default: 3000
  maxInterval?: number;        // Maximum delay cap in ms. Default: 30000
  backoffMultiplier?: number;  // Exponential backoff multiplier. Default: 2
  jitter?: number;             // Random jitter range in ms. Default: 1000
}
```

## Default Values

The default retry policy:

| Property | Default | Description |
|----------|---------|-------------|
| `maxRetries` | `0` | Unlimited retries |
| `initialInterval` | `3000` | 3 second initial delay |
| `maxInterval` | `30000` | 30 second maximum delay |
| `backoffMultiplier` | `2` | Double the delay each retry |
| `jitter` | `1000` | 0-1 second random jitter |

## SSE with Retry Policy

```typescript
const controller = new AbortController();

client.sse({
  method: 'GET',
  url: '/api/events',
  signal: controller.signal,
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 10,           // Try 10 times then give up
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

You can override just the properties you care about:

```typescript
client.sse({
  method: 'GET',
  url: '/api/events',
  signal: controller.signal,
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 5  // Only override maxRetries, keep all other defaults
  },
  onEvent: (event) => processEvent(event)
});
```

## Exponential Backoff

Retry delays are calculated using this formula:

```
delay = min(initialInterval * backoffMultiplier^retryCount, maxInterval) + random(0, jitter)
```

Example with `initialInterval: 1000, backoffMultiplier: 2, maxInterval: 30000, jitter: 1000`:

```
Attempt 1: min(1000 * 2^0, 30000) + random(0-1000) = ~1000-2000ms
Attempt 2: min(1000 * 2^1, 30000) + random(0-1000) = ~2000-3000ms
Attempt 3: min(1000 * 2^2, 30000) + random(0-1000) = ~4000-5000ms
Attempt 4: min(1000 * 2^3, 30000) + random(0-1000) = ~8000-9000ms
Attempt 5: min(1000 * 2^4, 30000) + random(0-1000) = ~16000-17000ms
Attempt 6: min(1000 * 2^5, 30000) + random(0-1000) = ~30000-31000ms (capped)
```

## Unlimited Retries

For critical connections that should never give up:

```typescript
client.sse({
  method: 'GET',
  url: '/api/critical-events',
  signal: controller.signal,
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 0,            // 0 means never stop trying
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
client.sse({
  method: 'GET',
  url: '/api/fast-events',
  signal: controller.signal,
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 5,
    initialInterval: 500,       // Start fast
    maxInterval: 5000,          // Cap at 5 seconds
    backoffMultiplier: 1.5,     // Slower growth
    jitter: 200
  },
  onEvent: (event) => processEvent(event)
});
```

## Constant Interval (No Backoff)

Set `backoffMultiplier` to `1` for a fixed retry interval:

```typescript
client.sse({
  method: 'GET',
  url: '/api/events',
  signal: controller.signal,
  autoReconnect: true,
  retryPolicy: {
    initialInterval: 5000,
    backoffMultiplier: 1,     // No exponential growth
    jitter: 500
  },
  onEvent: (event) => processEvent(event)
});
```

## Server-Suggested Retry Interval

SSE servers can suggest retry intervals via the `retry:` field:

```
retry: 5000
event: message
data: some data
```

fetchquack respects the server's suggestion. The suggested interval replaces the current interval but is still capped by `maxInterval`.

## Custom Retry Logic for Regular Requests

For retrying regular `fetch()` requests, use a custom interceptor:

```typescript
import { HttpInterceptorFn, HttpError } from 'fetchquack';

const retryInterceptor: HttpInterceptorFn = async (context, next) => {
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
  globalInterceptors: [retryInterceptor]
});
```

## Monitoring Retries

Track retry attempts in the `onError` callback:

```typescript
let retryCount = 0;

client.sse({
  method: 'GET',
  url: '/api/events',
  signal: controller.signal,
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
    
    if (retryCount >= 5) {
      showConnectionWarning('Connection unstable, retrying...');
    }
  }
});
```

## Best Practices

### Always Use Jitter

Jitter prevents the "thundering herd" problem where all clients retry at the same time:

```typescript
// Good - with jitter
retryPolicy: {
  jitter: 500  // Spreads out retry attempts
}

// Avoid - no jitter
retryPolicy: {
  jitter: 0    // All clients retry simultaneously
}
```

### Cap Maximum Interval

Prevent excessively long waits:

```typescript
retryPolicy: {
  maxRetries: 0,              // Unlimited
  maxInterval: 60000,         // Don't wait more than 1 minute
}
```

### Finite Retries for User-Initiated Actions

Don't make users wait forever:

```typescript
// User clicked a button - use a retry interceptor with finite attempts
const client = new HttpClient({
  globalInterceptors: [retryInterceptor]  // max 3 retries
});

try {
  await client.fetch({
    method: 'POST',
    url: '/api/action',
    body: actionData
  });
} catch (error) {
  showError('Action failed after multiple attempts');
}
```

### Unlimited Retries for Background Connections

Background SSE connections should keep reconnecting:

```typescript
client.sse({
  method: 'GET',
  url: '/api/live-updates',
  signal: controller.signal,
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 0,            // Keep trying forever
    initialInterval: 2000,
    maxInterval: 60000
  },
  onEvent: (event) => updateDashboard(event)
});
```

## Next Steps

- Learn about [Server-Sent Events](/features/sse) that use retry policies
- Explore [Interceptors](/core/interceptors) for custom retry logic
- Check out [Error Handling](/core/requests-responses#error-handling) guide
