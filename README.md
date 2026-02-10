
![fetchquack](./readme-header.webp)

# 🦆 fetchquack

[![npm version](https://img.shields.io/npm/v/fetchquack.svg)](https://www.npmjs.com/package/fetchquack)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight, universal HTTP client built on the **standard Fetch API** designed for modern web applications. It provides first-class support for **streaming responses**, **Server-Sent Events (SSE)**, and **upload/download progress tracking**.

Built with **TypeScript** and works everywhere: **Browser**, **Node.js**, **Bun**, **Deno**, and **Angular**.

---

## ✨ Features

- 🌐 **Universal** — Works on Browser, Node.js, Bun, and Deno with zero configuration
- 🌊 **Streaming** — First-class support for streaming responses (text and binary)
- 📡 **Server-Sent Events** — Full SSE spec support with auto-reconnect and Last-Event-ID
- ⏳ **Progress Tracking** — Upload and download progress monitoring on all platforms
- 🔄 **Interceptors** — Powerful middleware system (auth, logging, retry, etc.)
- 🅰️ **Angular 17+ Integration** — RxJS Observable wrapper with injection context support
- 🔒 **Type-Safe** — Complete TypeScript definitions with generics
- 📦 **Zero Dependencies** — No runtime dependencies, just the Fetch API
- 🪶 **Lightweight** — ~4KB minified + gzipped (browser bundle)

---

## 📦 Installation

```bash
npm install fetchquack
```

```bash
# or with other package managers
yarn add fetchquack
pnpm add fetchquack
bun add fetchquack
```

---

## 🚀 Quick Start

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient();

// Simple GET request
const user = await client.fetch<User>({
  method: 'GET',
  url: 'https://api.example.com/user/1'
});
```

---

## 📖 Table of Contents

- [Basic HTTP Requests](#-basic-http-requests)
- [Streaming Responses](#-streaming-responses)
- [Server-Sent Events (SSE)](#-server-sent-events-sse)
- [Progress Tracking](#-progress-tracking)
- [Interceptors](#-interceptors)
- [Error Handling](#-error-handling)
- [Angular Integration](#-angular-integration)
- [API Reference](#-api-reference)
- [Runtime Compatibility](#-runtime-compatibility)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📋 Basic HTTP Requests

### GET Request

**Vanilla JavaScript/TypeScript:**

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient();

// With type inference
const user = await client.fetch<User>({
  method: 'GET',
  url: '/api/users/1'
});

console.log(user.name);
```

**Angular:**

```typescript
import { Component, inject, signal } from '@angular/core';
import { NgxHttpClient } from 'fetchquack/ngx';

@Component({
  selector: 'app-user',
  template: `<div>{{ user()?.name }}</div>`
})
export class UserComponent {
  private http = inject(NgxHttpClient);
  
  user = signal<User | null>(null);
  
  async ngOnInit() {
    const user = await this.http.fetch<User>({
      method: 'GET',
      url: '/api/users/1'
    });
    this.user.set(user);
  }
}
```

### POST Request with JSON Body

**Vanilla JavaScript/TypeScript:**

```typescript
const newUser = await client.fetch<User>({
  method: 'POST',
  url: '/api/users',
  body: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Angular:**

```typescript
async createUser(userData: CreateUserDto) {
  return this.http.fetch<User>({
    method: 'POST',
    url: '/api/users',
    body: userData
  });
}
```

### Binary Response (Images, Files)

**Vanilla JavaScript/TypeScript:**

```typescript
const imageBytes = await client.fetch<Uint8Array>({
  method: 'GET',
  url: '/api/images/avatar.png',
  decodeToString: false  // Returns Uint8Array
});

// Create blob URL for display
const blob = new Blob([imageBytes], { type: 'image/png' });
const imageUrl = URL.createObjectURL(blob);
```

**Angular:**

```typescript
async downloadImage(): Promise<string> {
  const bytes = await this.http.fetch<Uint8Array>({
    method: 'GET',
    url: '/api/images/avatar.png',
    decodeToString: false
  });
  
  const blob = new Blob([bytes], { type: 'image/png' });
  return URL.createObjectURL(blob);
}
```

### Text Response (HTML, Plain Text)

```typescript
const html = await client.fetch<string>({
  method: 'GET',
  url: '/api/template',
  parseJson: false  // Returns raw string instead of parsing JSON
});
```

### Request with Custom Headers

```typescript
const data = await client.fetch({
  method: 'GET',
  url: '/api/protected',
  headers: {
    'Authorization': 'Bearer eyJhbGc...',
    'X-Custom-Header': 'value'
  }
});
```

### Cancelling Requests

**Vanilla JavaScript/TypeScript:**

```typescript
const controller = new AbortController();

// Start request
const promise = client.fetch({
  method: 'GET',
  url: '/api/slow-endpoint',
  signal: controller.signal
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const data = await promise;
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request was cancelled');
  }
}
```

**Angular (Observable mode):**

```typescript
// Automatically cancelled when component destroys
this.http.fetch<User>({
  method: 'GET',
  url: '/api/user',
  returnObservable: true
}).pipe(
  takeUntilDestroyed()
).subscribe(user => this.user.set(user));
```

---

## 🌊 Streaming Responses

Stream large responses or real-time data chunk by chunk. Perfect for AI chat interfaces, log streaming, and large file downloads.

### Text Streaming (AI Chat, Logs)

**Vanilla JavaScript/TypeScript:**

```typescript
let fullResponse = '';

const abort = await client.fetchStream({
  method: 'POST',
  url: '/api/ai/chat',
  body: { 
    messages: [{ role: 'user', content: 'Hello!' }] 
  },
  decodeToString: true,
  onData: (chunk) => {
    // Receive chunks as they arrive: "Hello", " there", "!", ...
    fullResponse += chunk;
    updateUI(fullResponse);
  },
  onComplete: () => {
    console.log('Stream finished');
  },
  onError: (error) => {
    console.error('Stream error:', error);
  }
});

// Cancel streaming at any time
document.getElementById('stop').onclick = () => abort();
```

**Angular:**

```typescript
@Component({
  selector: 'app-chat',
  template: `
    <div class="response">{{ response() }}</div>
    <button (click)="stop()">Stop</button>
  `
})
export class ChatComponent {
  private http = inject(NgxHttpClient);
  private subscription?: Subscription;
  
  response = signal('');
  
  sendMessage(message: string) {
    this.response.set('');
    
    this.subscription = this.http.fetchStream({
      method: 'POST',
      url: '/api/ai/chat',
      body: { messages: [{ role: 'user', content: message }] },
      decodeToString: true
    }).subscribe({
      next: (chunk) => {
        this.response.update(r => r + chunk);
      },
      error: (err) => console.error(err),
      complete: () => console.log('Done')
    });
  }
  
  stop() {
    this.subscription?.unsubscribe();
  }
}
```

### Binary Streaming (File Downloads)

**Vanilla JavaScript/TypeScript:**

```typescript
const chunks: Uint8Array[] = [];

await client.fetchStream({
  method: 'GET',
  url: '/api/files/large-video.mp4',
  decodeToString: false,  // Binary mode
  onData: (chunk) => {
    chunks.push(chunk);
    console.log(`Received ${chunk.length} bytes`);
  },
  onComplete: () => {
    const blob = new Blob(chunks, { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, 'video.mp4');
  }
});
```

**Angular:**

```typescript
downloadFile(fileId: string): Observable<Blob> {
  const chunks: Uint8Array[] = [];
  
  return new Observable(observer => {
    this.http.fetchStream({
      method: 'GET',
      url: `/api/files/${fileId}`,
      decodeToString: false
    }).subscribe({
      next: (chunk) => chunks.push(chunk),
      error: (err) => observer.error(err),
      complete: () => {
        observer.next(new Blob(chunks));
        observer.complete();
      }
    });
  });
}
```

---

## 📡 Server-Sent Events (SSE)

Full implementation of the [SSE specification](https://html.spec.whatwg.org/multipage/server-sent-events.html) with:

- Automatic event parsing
- JSON data parsing
- Event ID tracking for resumable connections
- Auto-reconnect with exponential backoff
- Server-suggested retry intervals

### Basic SSE Connection

**Vanilla JavaScript/TypeScript:**

```typescript
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

// Close connection when done
document.getElementById('disconnect').onclick = () => abort();
```

**Angular:**

```typescript
@Component({
  selector: 'app-notifications',
  template: `
    <div *ngFor="let n of notifications()">
      {{ n.message }}
    </div>
  `
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private http = inject(NgxHttpClient);
  private destroyRef = inject(DestroyRef);
  
  notifications = signal<Notification[]>([]);
  
  ngOnInit() {
    this.http.sse<Notification>({
      method: 'GET',
      url: '/api/notifications',
      parseJson: true
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(event => {
      if (event.data) {
        this.notifications.update(list => [...list, event.data]);
      }
    });
  }
}
```

### SSE with JSON Parsing

```typescript
interface StockPrice {
  symbol: string;
  price: number;
  change: number;
}

await client.sse<StockPrice>({
  method: 'GET',
  url: '/api/stocks/stream',
  parseJson: true,  // Automatically parse data field as JSON
  onEvent: (event) => {
    // event.data is typed as StockPrice
    console.log(`${event.data.symbol}: $${event.data.price}`);
  }
});
```

### SSE with Auto-Reconnect

When the connection drops, the client can automatically reconnect and resume from the last received event ID.

**Vanilla JavaScript/TypeScript:**

```typescript
await client.sse({
  method: 'GET',
  url: '/api/events',
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 10,           // Maximum reconnection attempts (0 = unlimited)
    initialInterval: 1000,    // Start with 1 second delay
    maxInterval: 30000,       // Cap at 30 seconds
    backoffMultiplier: 2,     // Double delay each retry
    jitter: 1000              // Add 0-1s random jitter
  },
  onEvent: (event) => {
    console.log('Received:', event.data);
  },
  onError: (error) => {
    // Called on each error, connection will auto-retry
    console.warn('Connection error, retrying...', error);
  }
});
```

**Angular:**

```typescript
this.http.sse<Message>({
  method: 'GET',
  url: '/api/chat/stream',
  parseJson: true,
  autoReconnect: true,
  retryPolicy: {
    maxRetries: 0,  // Unlimited retries
    initialInterval: 2000
  }
}).pipe(
  takeUntilDestroyed()
).subscribe({
  next: (event) => this.handleMessage(event.data),
  error: (err) => this.showReconnectFailed(err)
});
```

### SSE with Custom Event Types

```typescript
// Server sends:
// event: user-joined
// data: {"userId": "123", "name": "Alice"}
//
// event: message
// data: {"text": "Hello everyone!"}

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
        showMessage(event.data);
        break;
      case 'user-left':
        showUserLeft(event.data);
        break;
    }
  }
});
```

### SSE with POST Method (AI Streaming)

Unlike browser's native `EventSource`, this library supports any HTTP method:

```typescript
await client.sse<{ delta: string }>({
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
  parseJson: true,
  onEvent: (event) => {
    process.stdout.write(event.data.delta);
  }
});
```

---

## ⏳ Progress Tracking

Monitor upload and download progress. Works on all platforms with platform-optimized implementations.

### Upload Progress

**Vanilla JavaScript/TypeScript:**

```typescript
const fileInput = document.getElementById('file') as HTMLInputElement;
const file = fileInput.files[0];

await client.fetch({
  method: 'POST',
  url: '/api/upload',
  body: file,
  headers: {
    'Content-Type': file.type
  },
  onUploadProgress: (progress) => {
    console.log(`Uploaded: ${progress.loaded} / ${progress.total} bytes`);
    console.log(`Progress: ${progress.percentage}%`);
    
    progressBar.style.width = `${progress.percentage}%`;
  }
});
```

**Angular:**

```typescript
uploadFile(file: File): Observable<number> {
  return new Observable(observer => {
    this.http.fetch({
      method: 'POST',
      url: '/api/upload',
      body: file,
      headers: { 'Content-Type': file.type },
      onUploadProgress: (progress) => {
        if (progress.percentage !== undefined) {
          observer.next(progress.percentage);
        }
      }
    }).then(() => observer.complete())
      .catch(err => observer.error(err));
  });
}
```

### Download Progress

```typescript
await client.fetch({
  method: 'GET',
  url: '/api/files/large-file.zip',
  decodeToString: false,
  onDownloadProgress: (progress) => {
    if (progress.total) {
      console.log(`Downloaded: ${progress.percentage}%`);
    } else {
      // Total unknown (no Content-Length header)
      console.log(`Downloaded: ${progress.loaded} bytes`);
    }
  }
});
```

### Combined Upload and Download Progress

```typescript
await client.fetch({
  method: 'POST',
  url: '/api/process-file',
  body: inputFile,
  onUploadProgress: (p) => {
    uploadProgress.textContent = `Uploading: ${p.percentage}%`;
  },
  onDownloadProgress: (p) => {
    downloadProgress.textContent = `Downloading: ${p.percentage}%`;
  }
});
```

---

## 🔄 Interceptors

Interceptors allow you to modify requests and responses globally. Perfect for authentication, logging, error handling, and more.

### Built-in Interceptors

The library includes several ready-to-use interceptors:

```typescript
import { HttpClient } from 'fetchquack';
import { authInterceptor } from 'fetchquack/interceptors/auth';
import { headerInterceptor } from 'fetchquack/interceptors/header';
import { loggingInterceptor } from 'fetchquack/interceptors/logging';
import { csrfInterceptor } from 'fetchquack/interceptors/csrf';
```

### Authentication Interceptor

**Vanilla JavaScript/TypeScript:**

```typescript
import { HttpClient } from 'fetchquack';
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

**Angular with Injection Context:**

```typescript
// app.config.ts
import { provideNgxHttpClient } from 'fetchquack/ngx';
import { authInterceptor } from 'fetchquack/interceptors/auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxHttpClient({
      globalInterceptors: [
        authInterceptor({
          // Can use inject() because interceptors run in injection context
          getToken: () => inject(AuthService).getToken()
        })
      ]
    })
  ]
};
```

### Logging Interceptor

```typescript
import { loggingInterceptor } from 'fetchquack/interceptors/logging';

const client = new HttpClient({
  globalInterceptors: [
    loggingInterceptor({
      prefix: '[API]',
      secretHeaders: ['Authorization', 'X-API-Key'],  // Masked in logs
      sanitizeBody: true,  // Hide request/response bodies
      shouldSkipLogging: (ctx) => ctx.url.includes('/health')
    })
  ]
});

// Output:
// [API] [abc123] [REQ] { method: 'GET', url: '/api/users', ... }
// [API] [abc123] [RES] { status: 200, duration: '45ms', ... }
```

### Header Interceptor

```typescript
import { headerInterceptor } from 'fetchquack/interceptors/header';

const client = new HttpClient({
  globalInterceptors: [
    headerInterceptor({
      headers: {
        'X-API-Version': '2.0',
        'X-Client': 'web-app'
      }
    })
  ]
});
```

### CSRF Interceptor (Browser)

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

### Custom Interceptor

**Vanilla JavaScript/TypeScript:**

```typescript
import { HttpInterceptorFn } from 'fetchquack';

const timingInterceptor: HttpInterceptorFn = async (context, next) => {
  const start = performance.now();
  
  try {
    const response = await next(context);
    const duration = performance.now() - start;
    console.log(`${context.method} ${context.url} - ${duration}ms`);
    return response;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`${context.method} ${context.url} - FAILED after ${duration}ms`);
    throw error;
  }
};

const client = new HttpClient({
  globalInterceptors: [timingInterceptor]
});
```

**Angular:**

```typescript
// Interceptor that uses Angular services
const analyticsInterceptor: HttpInterceptorFn = async (context, next) => {
  const analytics = inject(AnalyticsService);  // Works in injection context!
  
  analytics.trackApiCall(context.url);
  
  const response = await next(context);
  
  analytics.trackApiResponse(context.url, response.status);
  
  return response;
};
```

### Request-Level Interceptors

Add interceptors to specific requests only:

```typescript
const data = await client.fetch({
  method: 'GET',
  url: '/api/special-endpoint',
  interceptors: [
    specialAuthInterceptor,
    retryInterceptor
  ]
});
```

### Interceptor Execution Order

Interceptors execute in order, wrapping each other:

```typescript
const client = new HttpClient({
  globalInterceptors: [
    loggingInterceptor(),    // 1st: logs request → ... → logs response
    authInterceptor(...),    // 2nd: adds auth header
    headerInterceptor(...)   // 3rd: adds custom headers → makes request
  ]
});
```

---

## ❌ Error Handling

The library provides typed errors for different failure scenarios.

### HttpError

Thrown for HTTP errors (4xx, 5xx) and network failures:

```typescript
import { HttpError } from 'fetchquack';

try {
  await client.fetch({ method: 'GET', url: '/api/user' });
} catch (error) {
  if (error instanceof HttpError) {
    console.log('Status:', error.statusCode);  // e.g., 404, 500
    console.log('Message:', error.message);
    
    if (error.statusCode === 401) {
      redirectToLogin();
    } else if (error.statusCode === 404) {
      showNotFound();
    } else if (error.statusCode === 0) {
      // Network error or abort
      showNetworkError();
    }
  }
}
```

### HttpJsonParseError

Thrown when JSON parsing fails:

```typescript
import { HttpJsonParseError } from 'fetchquack';

try {
  await client.fetch({ method: 'GET', url: '/api/data' });
} catch (error) {
  if (error instanceof HttpJsonParseError) {
    console.log('Failed to parse response:', error.responseText);
  }
}
```

### Angular Error Handling

```typescript
this.http.fetch<User>({
  method: 'GET',
  url: '/api/user',
  returnObservable: true
}).pipe(
  catchError((error: HttpError) => {
    if (error.statusCode === 401) {
      this.router.navigate(['/login']);
    }
    return throwError(() => error);
  })
).subscribe(user => this.user.set(user));
```

---

## 🅰️ Angular Integration

The Angular module provides RxJS Observable support and integrates with Angular's dependency injection.

### Setup

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideNgxHttpClient } from 'fetchquack/ngx';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxHttpClient({
      globalInterceptors: [
        // Interceptors can use inject() here
      ]
    })
  ]
};
```

### Using NgxHttpClient

```typescript
import { Component, inject, signal } from '@angular/core';
import { NgxHttpClient } from 'fetchquack/ngx';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-example',
  template: `
    <div>{{ data() | json }}</div>
    <div>{{ streamedText() }}</div>
  `
})
export class ExampleComponent {
  private http = inject(NgxHttpClient);
  
  data = signal<any>(null);
  streamedText = signal('');
  
  // Promise-based fetch
  async loadData() {
    const result = await this.http.fetch({
      method: 'GET',
      url: '/api/data'
    });
    this.data.set(result);
  }
  
  // Observable-based fetch (auto-cancels on destroy)
  loadDataReactive() {
    this.http.fetch({
      method: 'GET',
      url: '/api/data',
      returnObservable: true
    }).pipe(
      takeUntilDestroyed()
    ).subscribe(result => this.data.set(result));
  }
  
  // Streaming
  streamData() {
    this.http.fetchStream({
      method: 'POST',
      url: '/api/stream',
      decodeToString: true
    }).pipe(
      takeUntilDestroyed()
    ).subscribe(chunk => {
      this.streamedText.update(t => t + chunk);
    });
  }
  
  // SSE
  connectToEvents() {
    this.http.sse<Notification>({
      method: 'GET',
      url: '/api/events',
      parseJson: true
    }).pipe(
      takeUntilDestroyed()
    ).subscribe(event => {
      console.log('Event:', event.data);
    });
  }
}
```

### Using inject() in Interceptors

Angular interceptors run in an injection context, so you can use `inject()`:

```typescript
import { inject } from '@angular/core';
import { HttpInterceptorFn } from 'fetchquack';
import { provideNgxHttpClient } from 'fetchquack/ngx';

const authInterceptor: HttpInterceptorFn = async (ctx, next) => {
  const authService = inject(AuthService);
  const token = await authService.getToken();
  
  if (token) {
    ctx.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return next(ctx);
};

const errorInterceptor: HttpInterceptorFn = async (ctx, next) => {
  const errorHandler = inject(ErrorHandlerService);
  
  try {
    return await next(ctx);
  } catch (error) {
    errorHandler.handle(error);
    throw error;
  }
};

// In app.config.ts
provideNgxHttpClient({
  globalInterceptors: [authInterceptor, errorInterceptor]
});
```

---

## 📚 API Reference

### HttpClient

Main client class for making HTTP requests.

```typescript
const client = new HttpClient(options?: HttpClientOptions);
```

**HttpClientOptions:**

| Property | Type | Description |
|----------|------|-------------|
| `globalInterceptors` | `HttpInterceptorFn[]` | Interceptors applied to all requests |

**Methods:**

| Method | Description |
|--------|-------------|
| `fetch<T>(request)` | Standard HTTP request, returns Promise |
| `fetchStream(request)` | Streaming request with callbacks |
| `sse<T>(request)` | Server-Sent Events connection |

### Request Types

**HttpRequest** (for `fetch`):

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `method` | `string` | required | HTTP method |
| `url` | `string` | required | Request URL |
| `body` | `any` | - | Request body |
| `headers` | `Record<string, string>` | - | HTTP headers |
| `parseJson` | `boolean` | `true` | Parse response as JSON |
| `decodeToString` | `boolean` | `true` | Decode to string vs Uint8Array |
| `signal` | `AbortSignal` | - | Cancellation signal |
| `interceptors` | `HttpInterceptorFn[]` | - | Request-specific interceptors |
| `onUploadProgress` | `(progress) => void` | - | Upload progress callback |
| `onDownloadProgress` | `(progress) => void` | - | Download progress callback |

**HttpStreamRequest** (for `fetchStream`):

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `method` | `string` | required | HTTP method |
| `url` | `string` | required | Request URL |
| `body` | `any` | - | Request body |
| `headers` | `Record<string, string>` | - | HTTP headers |
| `decodeToString` | `boolean` | `false` | Decode chunks to string |
| `signal` | `AbortSignal` | - | Cancellation signal |
| `onData` | `(chunk) => void` | - | Data callback |
| `onError` | `(error) => void` | - | Error callback |
| `onComplete` | `() => void` | - | Completion callback |

**HttpSseRequest** (for `sse`):

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `method` | `string` | required | HTTP method |
| `url` | `string` | required | SSE endpoint URL |
| `body` | `any` | - | Request body |
| `headers` | `Record<string, string>` | - | HTTP headers |
| `parseJson` | `boolean` | `false` | Parse data field as JSON |
| `autoReconnect` | `boolean` | `false` | Auto-reconnect on disconnect |
| `retryPolicy` | `RetryPolicyConfig` | - | Reconnection policy |
| `signal` | `AbortSignal` | - | Cancellation signal |
| `onEvent` | `(event) => void` | - | Event callback |
| `onError` | `(error) => void` | - | Error callback |
| `onComplete` | `() => void` | - | Completion callback |

**RetryPolicyConfig:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxRetries` | `number` | `0` | Max retries (0 = unlimited) |
| `initialInterval` | `number` | `3000` | Initial delay (ms) |
| `maxInterval` | `number` | `30000` | Max delay (ms) |
| `backoffMultiplier` | `number` | `2` | Exponential backoff multiplier |
| `jitter` | `number` | `1000` | Random jitter range (ms) |

---

## 🖥️ Runtime Compatibility

| Runtime | Version | Progress Implementation |
|---------|---------|------------------------|
| **Browser** | Modern | XMLHttpRequest (with progress callbacks) / Fetch API |
| **Node.js** | 18.0+ | Fetch API with ReadableStream |
| **Bun** | 1.0+ | Fetch API with ReadableStream |
| **Deno** | 1.11+ | Fetch API with ReadableStream |

**Notes:**
- Browser uses XMLHttpRequest only when progress callbacks are provided, otherwise uses standard Fetch API
- Upload progress is best supported in browsers via XMLHttpRequest
- All platforms support download progress via stream monitoring

---

## 🧪 Testing

The library includes a comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific runtime
npm run test:node
npm run test:deno
npm run test:bun
npm run test:browser
```

See [README-tests.md](./README-tests.md) for detailed testing documentation.

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © [Adrián Bueno Jiménez](https://devadri.com)

---

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/fetchquack)
- [GitHub Repository](https://github.com/adrian-bueno/fetchquack)
- [Report Issues](https://github.com/adrian-bueno/fetchquack/issues)
