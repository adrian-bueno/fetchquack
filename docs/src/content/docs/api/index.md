---
title: API Reference
description: Complete API reference for fetchquack
---

Complete reference documentation for all fetchquack APIs.

## Core Classes

### HttpClient

Main client class for making HTTP requests.

```typescript
import { HttpClient } from 'fetchquack';

class HttpClient {
  constructor(options?: HttpClientOptions);
  
  // Standard HTTP request - returns parsed response
  fetch<T>(request: HttpRequest): Promise<T | string | Uint8Array>;
  
  // Streaming - delivers chunks via callbacks, returns void
  fetchStream(request: HttpStreamRequest): void;
  
  // Server-Sent Events - delivers events via callbacks, returns void
  sse<T>(request: HttpSseRequest): void;
}
```

**`fetch()` overloads:**

| Configuration | Return Type |
|---|---|
| Default (`parseJson: true, decodeToString: true`) | `Promise<T>` |
| `parseJson: false` | `Promise<string>` |
| `decodeToString: false` | `Promise<Uint8Array>` |

[View detailed HttpClient documentation](/core/http-client)

### NgxHttpClient (Angular)

Angular wrapper with RxJS Observable support. Injectable via `inject(NgxHttpClient)`.

```typescript
import { NgxHttpClient } from 'fetchquack/ngx';

class NgxHttpClient {
  // Promise mode (default)
  fetch<T>(request: NgxHttpRequest): Promise<T | string | Uint8Array>;
  
  // Observable mode - auto-aborts on unsubscribe
  fetch<T>(request: NgxHttpRequestObservable & { returnObservable: true }): Observable<T | string | Uint8Array>;
  
  // Streaming - always Observable, auto-aborts on unsubscribe
  fetchStream(request: NgxHttpStreamRequest): Observable<string | Uint8Array>;
  
  // SSE - always Observable, auto-aborts on unsubscribe
  sse<T>(request: NgxHttpSseRequest): Observable<SseEvent<T>>;
}
```

[View Angular integration guide](/integrations/angular)

## Request Types

### HttpRequest

Standard HTTP request configuration.

```typescript
interface HttpRequest {
  method: string;                           // Required: HTTP method
  url: string;                              // Required: Request URL
  body?: any;                               // Request body (objects auto-serialized to JSON)
  headers?: Record<string, string>;         // HTTP headers (Content-Type auto-detected)
  interceptors?: HttpInterceptorFn[];       // Request-specific interceptors
  signal?: AbortSignal;                     // Cancellation signal
  parseJson?: boolean;                      // Parse response as JSON (default: true)
  decodeToString?: boolean;                 // Decode to string (default: true), false for Uint8Array
  onUploadProgress?: (progress: HttpProgressEvent) => void;
  onDownloadProgress?: (progress: HttpProgressEvent) => void;
}
```

### HttpStreamRequest

Streaming request configuration. Union of binary and string modes.

```typescript
type HttpStreamRequest = HttpStreamRequestBinary | HttpStreamRequestString;

interface HttpStreamRequestBinary {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  interceptors?: HttpInterceptorFn[];
  signal?: AbortSignal;
  decodeToString?: false;                   // Binary mode (default)
  onData?: (chunk: Uint8Array) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

interface HttpStreamRequestString {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  interceptors?: HttpInterceptorFn[];
  signal?: AbortSignal;
  decodeToString: true;                     // Text mode
  onData?: (chunk: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}
```

### HttpSseRequest

Server-Sent Events request configuration.

```typescript
interface HttpSseRequest {
  method: string;                           // Any HTTP method (not just GET)
  url: string;
  body?: any;
  headers?: Record<string, string>;
  interceptors?: HttpInterceptorFn[];
  signal?: AbortSignal;
  parseJson?: boolean;                      // Parse event data as JSON (default: false)
  stripOptionalSpace?: boolean;             // Strip space after colon (default: true)
  autoReconnect?: boolean;                  // Auto-reconnect on disconnect (default: false)
  retryPolicy?: RetryPolicyConfig;          // Reconnection policy
  onEvent?: (event: SseEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}
```

## Response Types

### HttpProgressEvent

Progress information for uploads/downloads.

```typescript
interface HttpProgressEvent {
  loaded: number;      // Bytes transferred so far
  total?: number;      // Total bytes (undefined if Content-Length unavailable)
  percentage?: number; // 0-100 (undefined if total unknown)
}
```

### SseEvent

Server-Sent Event structure. All fields are optional.

```typescript
interface SseEvent<T = any> {
  id?: string;       // Event ID (for Last-Event-ID tracking)
  event?: string;    // Event type (e.g., "message", "update")
  data?: T;          // Event payload (string, or parsed JSON if parseJson: true)
  retry?: number;    // Server-suggested reconnection interval in ms
}
```

## Configuration Types

### HttpClientOptions

Client configuration options.

```typescript
interface HttpClientOptions {
  globalInterceptors?: HttpInterceptorFn[];  // Interceptors applied to all requests
}
```

### RetryPolicyConfig

Retry policy for SSE auto-reconnect. All properties are optional.

```typescript
interface RetryPolicyConfig {
  maxRetries?: number;         // Max retry attempts. 0 = unlimited. Default: 0
  initialInterval?: number;    // Initial delay in ms. Default: 3000
  maxInterval?: number;        // Maximum delay cap in ms. Default: 30000
  backoffMultiplier?: number;  // Exponential backoff multiplier. Default: 2
  jitter?: number;             // Random jitter range in ms. Default: 1000
}
```

**Backoff formula:** `delay = min(initialInterval * backoffMultiplier^retryCount, maxInterval) + random(0, jitter)`

## Interceptor Types

### HttpInterceptorFn

Interceptor function type.

```typescript
type HttpInterceptorFn = (
  context: HttpInterceptorContext,
  next: HttpInterceptorNext
) => Promise<HttpInterceptorResponse>;
```

### HttpInterceptorNext

```typescript
type HttpInterceptorNext = (
  context: HttpInterceptorContext
) => Promise<HttpInterceptorResponse>;
```

### HttpInterceptorContext

Request context passed to interceptors.

```typescript
interface HttpInterceptorContext {
  method: string;                          // HTTP method (uppercased)
  url: string;                             // Request URL
  body?: string | object | null;           // Request body
  headers: Record<string, string>;         // HTTP headers (mutable)
  metadata?: Record<string, any>;          // Custom data between interceptors
}
```

Internal metadata flags:
- `metadata.streaming === true` -- Set for `fetchStream()` and `sse()` calls
- `metadata.sse === true` -- Set for `sse()` calls

### HttpInterceptorResponse

```typescript
interface HttpInterceptorResponse {
  status: number;        // HTTP status code
  statusText: string;    // HTTP status text
  headers: Headers;      // Response headers
  ok: boolean;           // True if status 200-299
  response: Response;    // Original Fetch Response
}
```

## Error Types

### HttpError

HTTP error with status information. Extends `Error`.

```typescript
class HttpError extends Error {
  readonly statusCode: number;  // HTTP status code (0 for network/abort errors)
  readonly message: string;     // Error description
  readonly error?: Error;       // Original error (for chaining)
  readonly name: string;        // Always 'HttpError'
}
```

### HttpJsonParseError

JSON parsing error. Extends `HttpError`.

```typescript
class HttpJsonParseError extends HttpError {
  readonly responseText: string;  // Raw response text (truncated to ~500 chars)
  readonly name: string;          // Always 'HttpJsonParseError'
  // statusCode is always 0
}
```

## Built-in Interceptors

### authInterceptor

Adds authentication headers to requests.

```typescript
import { authInterceptor } from 'fetchquack/interceptors/auth';

function authInterceptor(options: {
  getToken: () => string | null | Promise<string | null>;  // Required
  headerName?: string;       // Default: 'Authorization'
  tokenPrefix?: string;      // Default: 'Bearer '
  shouldSkipAuth?: (context: HttpInterceptorContext) => boolean;  // Default: () => false
}): HttpInterceptorFn;
```

### loggingInterceptor

Logs requests and responses.

```typescript
import { loggingInterceptor } from 'fetchquack/interceptors/logging';

function loggingInterceptor(options?: {
  prefix?: string;                  // Default: '[HTTP]'
  secretHeaders?: string[];         // Default: ['Authorization']
  sanitizeBody?: boolean;           // Default: false
  colorizeRequestId?: boolean;      // Default: true
  shouldSkipLogging?: (ctx: HttpInterceptorContext) => boolean;  // Default: () => false
}): HttpInterceptorFn;
```

### headerInterceptor

Adds custom headers to requests.

```typescript
import { headerInterceptor } from 'fetchquack/interceptors/header';

function headerInterceptor(options: {
  headers: Record<string, string>;  // Required
  shouldAddHeaders?: (context: HttpInterceptorContext) => boolean;  // Default: () => true
}): HttpInterceptorFn;
```

### csrfInterceptor

Handles CSRF tokens (browser only).

```typescript
import { csrfInterceptor } from 'fetchquack/interceptors/csrf';

function csrfInterceptor(options?: {
  cookieName?: string;         // Default: 'XSRF-TOKEN'
  headerName?: string;         // Default: 'X-XSRF-TOKEN'
  protectedMethods?: string[]; // Default: ['POST', 'PUT', 'PATCH', 'DELETE']
}): HttpInterceptorFn;
```

## Angular Providers

### provideNgxHttpClient

Registers the configured HttpClient in Angular's dependency injection system. Wraps interceptors in Angular's injection context so `inject()` works inside them.

```typescript
import { provideNgxHttpClient } from 'fetchquack/ngx';

function provideNgxHttpClient(
  options?: ProvideNgxHttpClientOptions
): EnvironmentProviders;
```

`ProvideNgxHttpClientOptions` extends `HttpClientOptions`.

**Usage in `app.config.ts`:**

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxHttpClient({
      globalInterceptors: [authInterceptor, loggingInterceptor]
    })
  ]
};
```

## Angular Request Types

Angular-specific request types that omit callback/signal fields managed by the Observable:

| Type | Base | Omits | Used By |
|------|------|-------|---------|
| `NgxHttpRequest` | `HttpRequest` | -- | `fetch()` (Promise mode) |
| `NgxHttpRequestObservable` | `HttpRequest` | `signal` | `fetch()` (Observable mode) |
| `NgxHttpStreamRequestBinary` | `HttpStreamRequestBinary` | `onData`, `onError`, `onComplete`, `signal` | `fetchStream()` |
| `NgxHttpStreamRequestString` | `HttpStreamRequestString` | `onData`, `onError`, `onComplete`, `signal` | `fetchStream()` |
| `NgxHttpSseRequest` | `HttpSseRequest` | `onEvent`, `onError`, `onComplete`, `signal` | `sse()` |

## Next Steps

- Explore [Core Concepts](/core/http-client)
- Learn about [Requests & Responses](/core/requests-responses)
- Discover [Interceptors](/core/interceptors)
