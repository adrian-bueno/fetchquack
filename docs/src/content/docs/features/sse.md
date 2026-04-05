---
title: Server-Sent Events (SSE)
description: Full SSE implementation with auto-reconnect and event parsing
---

FetchQuack provides a complete implementation of the [SSE specification](https://html.spec.whatwg.org/multipage/server-sent-events.html) with automatic event parsing, reconnection, and support for all HTTP methods (unlike the browser's native `EventSource` which only supports GET).

## How It Works

`sse()` returns `void` and delivers events through callbacks:
- `onEvent` -- Called for each parsed SSE event
- `onError` -- Called on connection errors
- `onComplete` -- Called when the connection closes

Use `AbortController` to close the connection.

## Basic SSE Connection

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient();
const controller = new AbortController();

client.sse({
  method: 'GET',
  url: '/api/events',
  signal: controller.signal,
  onEvent: (event) => {
    console.log('Event type:', event.event);  // e.g., "message", "update"
    console.log('Event ID:', event.id);
    console.log('Data:', event.data);
  },
  onError: (error) => {
    console.error('SSE error:', error);
  },
  onComplete: () => {
    console.log('SSE connection closed');
  }
});

// Close the connection
// controller.abort();
```

## JSON Event Data

Automatically parse the `data` field as JSON:

```typescript
interface StockPrice {
  symbol: string;
  price: number;
  change: number;
}

const controller = new AbortController();

client.sse<StockPrice>({
  method: 'GET',
  url: '/api/stocks/stream',
  signal: controller.signal,
  parseJson: true,  // Parse data field as JSON
  onEvent: (event) => {
    if (event.data) {
      // event.data is typed as StockPrice
      console.log(`${event.data.symbol}: $${event.data.price}`);
      updateStockDisplay(event.data);
    }
  }
});
```

## Auto-Reconnect

Automatically reconnect when the connection drops:

```typescript
const controller = new AbortController();

client.sse({
  method: 'GET',
  url: '/api/events',
  signal: controller.signal,
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 10,           // Max attempts (0 = unlimited)
    initialInterval: 1000,    // Start with 1s delay
    maxInterval: 30000,       // Cap at 30s
    backoffMultiplier: 2,     // Double delay each retry
    jitter: 1000              // Add 0-1s random jitter
  },
  onEvent: (event) => {
    console.log('Received:', event.data);
  },
  onError: (error) => {
    console.warn('Connection error, retrying...', error);
  }
});
```

All `retryPolicy` properties are optional. See [Retry Policies](/features/retry) for details.

## Custom Event Types

Handle different event types from the server:

```typescript
const controller = new AbortController();

client.sse({
  method: 'GET',
  url: '/api/chat/room/123',
  signal: controller.signal,
  parseJson: true,
  onEvent: (event) => {
    switch (event.event) {
      case 'user-joined':
        showUserJoined(event.data);
        break;
      case 'message':
        addMessage(event.data);
        break;
      case 'user-left':
        showUserLeft(event.data);
        break;
      default:
        console.log('Unknown event:', event.event);
    }
  }
});
```

## POST Method SSE (AI Streaming)

Unlike the browser's `EventSource`, FetchQuack supports any HTTP method. This is useful for AI APIs that require POST requests:

```typescript
const controller = new AbortController();

client.sse({
  method: 'POST',
  url: '/api/ai/completions',
  body: {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Write a poem' }],
    stream: true
  },
  headers: {
    'Authorization': 'Bearer sk-...'
  },
  signal: controller.signal,
  parseJson: true,
  onEvent: (event) => {
    if (event.data?.delta) {
      process.stdout.write(event.data.delta);
    }
  },
  onComplete: () => {
    console.log('\nDone');
  }
});
```

## Angular Integration

In Angular, `sse()` returns an `Observable<SseEvent<T>>`. Unsubscribing automatically closes the connection:

```typescript
import { Component, inject, signal } from '@angular/core';
import { NgxHttpClient } from 'fetchquack/ngx';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-notifications',
  template: `
    <div *ngFor="let n of notifications()">
      {{ n.message }}
    </div>
  `
})
export class NotificationsComponent {
  private http = inject(NgxHttpClient);
  notifications = signal<Notification[]>([]);
  
  ngOnInit() {
    this.http.sse<Notification>({
      method: 'GET',
      url: '/api/notifications',
      parseJson: true,
      autoReconnect: true
    }).pipe(
      takeUntilDestroyed()  // Auto-close when component is destroyed
    ).subscribe({
      next: (event) => {
        if (event.data) {
          this.notifications.update(list => [...list, event.data!]);
        }
      },
      error: (err) => console.error('SSE error:', err)
    });
  }
}
```

## Event Structure

SSE events have the following structure:

```typescript
interface SseEvent<T = any> {
  id?: string;       // Event ID (for Last-Event-ID tracking)
  event?: string;    // Event type (e.g., "message", "update")
  data?: T;          // Event payload (string or parsed JSON)
  retry?: number;    // Server-suggested reconnection interval (ms)
}
```

All fields are optional. The `data` field is a string by default, or parsed JSON when `parseJson: true`.

## Last-Event-ID Tracking

When auto-reconnect is enabled, the library automatically tracks the last received event ID and sends it as the `Last-Event-ID` header on reconnection:

```
# Server sends:
id: 42
event: message
data: some data

# On reconnect, client automatically sends:
# Last-Event-ID: 42
```

This allows the server to resume streaming from where it left off.

## Server Behavior

- If the server responds with `204 No Content`, the connection closes without reconnecting.
- If the response `Content-Type` is not `text/event-stream`, the connection reports an error and does not reconnect.
- The `Accept: text/event-stream` header is automatically added if not present.
- If the server sends a `retry:` field, the retry interval is updated accordingly.

## Request Options

```typescript
interface HttpSseRequest {
  method: string;                         // HTTP method (any method, not just GET)
  url: string;                            // SSE endpoint URL
  body?: any;                             // Request body
  headers?: Record<string, string>;       // HTTP headers
  interceptors?: HttpInterceptorFn[];     // Interceptor chain
  signal?: AbortSignal;                   // Cancellation signal
  parseJson?: boolean;                    // Parse data as JSON (default: false)
  stripOptionalSpace?: boolean;           // Strip space after colon in fields (default: true)
  autoReconnect?: boolean;                // Auto-reconnect on disconnect (default: false)
  retryPolicy?: RetryPolicyConfig;        // Reconnection policy (all fields optional)
  onEvent?: (event: SseEvent) => void;    // Event callback
  onError?: (error: Error) => void;       // Error callback
  onComplete?: () => void;                // Completion callback
}
```

## Best Practices

### Handle Connection State

```typescript
const controller = new AbortController();
let isConnected = false;

client.sse({
  method: 'GET',
  url: '/api/events',
  signal: controller.signal,
  autoReconnect: true,
  onEvent: (event) => {
    if (!isConnected) {
      isConnected = true;
      showStatus('Connected');
    }
    processEvent(event);
  },
  onError: (error) => {
    isConnected = false;
    showStatus('Disconnected, reconnecting...');
  }
});
```

### Unlimited Retries for Critical Connections

```typescript
client.sse({
  method: 'GET',
  url: '/api/critical-events',
  signal: controller.signal,
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 0,  // 0 means unlimited retries
    initialInterval: 2000,
    maxInterval: 60000
  },
  onEvent: (event) => processCriticalEvent(event)
});
```

### Clean Up on Component Unmount

```typescript
// Vanilla JS - use AbortController
const controller = new AbortController();
client.sse({ ..., signal: controller.signal });
window.addEventListener('beforeunload', () => controller.abort());

// Angular - use takeUntilDestroyed() for automatic cleanup
this.http.sse({...})
  .pipe(takeUntilDestroyed())
  .subscribe(...);
```

## Next Steps

- Learn about [Streaming](/features/streaming) for other streaming use cases
- Explore [Retry Policies](/features/retry) for connection reliability
- Check out the [Angular Integration](/integrations/angular) guide
