---
title: Server-Sent Events
description: Full SSE implementation with auto-reconnect and event parsing
---

# Server-Sent Events (SSE)

FetchQuack provides a complete implementation of the [SSE specification](https://html.spec.whatwg.org/multipage/server-sent-events.html) with automatic event parsing, reconnection, and support for all HTTP methods (unlike the browser's EventSource).

## Basic SSE Connection

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient();

const abort = await client.sse({
  method: 'GET',
  url: '/api/events',
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

// Close connection
abort();
```

## JSON Event Data

Automatically parse JSON data:

```typescript
interface StockPrice {
  symbol: string;
  price: number;
  change: number;
}

await client.sse<StockPrice>({
  method: 'GET',
  url: '/api/stocks/stream',
  parseJson: true,  // Parse data field as JSON
  onEvent: (event) => {
    // event.data is typed as StockPrice
    console.log(`${event.data.symbol}: $${event.data.price}`);
    updateStockDisplay(event.data);
  }
});
```

## Auto-Reconnect

Automatically reconnect when connection drops:

```typescript
await client.sse({
  method: 'GET',
  url: '/api/events',
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

## Custom Event Types

Handle different event types:

```typescript
await client.sse({
  method: 'GET',
  url: '/api/chat/room/123',
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

Unlike browser EventSource, supports any HTTP method:

```typescript
await client.sse({
  method: 'POST',
  url: '/api/ai/completions',
  body: {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Write a poem' }],
    stream: true
  },
  headers: {
    'Authorization': 'Bearer sk-...',
    'Content-Type': 'application/json'
  },
  parseJson: true,
  onEvent: (event) => {
    if (event.data?.delta) {
      process.stdout.write(event.data.delta);
    }
  }
});
```

## Angular Integration

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
      takeUntilDestroyed()
    ).subscribe(event => {
      if (event.data) {
        this.notifications.update(list => [...list, event.data]);
      }
    });
  }
}
```

## Event Structure

SSE events have the following structure:

```typescript
interface SseEvent<T = any> {
  event: string;      // Event type (default: "message")
  data: T;            // Event data (parsed if parseJson: true)
  id?: string;        // Event ID for resuming
  retry?: number;     // Server-suggested retry interval (ms)
}
```

## Last-Event-ID Tracking

When reconnecting, the library automatically sends the last received event ID:

```typescript
// Server sends:
// id: 123
// data: some data

// On reconnect, client sends header:
// Last-Event-ID: 123
```

This allows the server to resume streaming from where it left off.

## Request Options

```typescript
interface HttpSseRequest<T = any> {
  method: string;                         // HTTP method
  url: string;                            // SSE endpoint URL
  body?: any;                             // Request body
  headers?: Record<string, string>;       // HTTP headers
  parseJson?: boolean;                    // Parse data as JSON (default: false)
  autoReconnect?: boolean;                // Auto-reconnect (default: false)
  retryPolicy?: RetryPolicyConfig;        // Reconnection policy
  signal?: AbortSignal;                   // Cancellation signal
  onEvent: (event: SseEvent<T>) => void;  // Event callback
  onError?: (error: Error) => void;       // Error callback
  onComplete?: () => void;                // Completion callback
}
```

## Best Practices

### Handle Connection State

```typescript
let isConnected = false;

await client.sse({
  method: 'GET',
  url: '/api/events',
  autoReconnect: true,
  onEvent: (event) => {
    if (!isConnected) {
      isConnected = true;
      console.log('Connected');
    }
    processEvent(event);
  },
  onError: (error) => {
    isConnected = false;
    console.log('Disconnected');
  }
});
```

### Unlimited Retries for Critical Connections

```typescript
await client.sse({
  method: 'GET',
  url: '/api/critical-events',
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 0,  // Unlimited retries
    initialInterval: 2000,
    maxInterval: 60000
  },
  onEvent: (event) => processCriticalEvent(event)
});
```

### Clean up on Component Unmount

```typescript
// Vanilla JS
const abort = await client.sse({...});
window.addEventListener('beforeunload', () => abort());

// Angular - automatic with takeUntilDestroyed()
this.http.sse({...})
  .pipe(takeUntilDestroyed())
  .subscribe(...);
```

## Next Steps

- Learn about [Streaming](/features/streaming) for other streaming use cases
- Explore [Retry Policies](/features/retry) for connection reliability
- Check out the [Angular Integration](/integrations/angular) guide
