---
title: API Reference
description: Complete API reference for FetchQuack
---

Complete reference documentation for all FetchQuack APIs.

## Core Classes

### HttpClient

Main client class for making HTTP requests.

```typescript
class HttpClient {
  constructor(options?: HttpClientOptions);
  fetch<T>(request: HttpRequest): Promise<T>;
  fetchStream(request: HttpStreamRequest): Promise<() => void>;
  sse<T>(request: HttpSseRequest<T>): Promise<() => void>;
}
```

[View detailed HttpClient documentation](/core/http-client)

### NgxHttpClient (Angular)

Angular wrapper with RxJS Observable support.

```typescript
class NgxHttpClient {
  fetch<T>(request: HttpRequest & { returnObservable?: boolean }): Promise<T> | Observable<T>;
  fetchStream(request: HttpStreamRequest): Observable<string | Uint8Array>;
  sse<T>(request: HttpSseRequest<T>): Observable<SseEvent<T>>;
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
  body?: any;                               // Request body
  headers?: Record<string, string>;         // HTTP headers
  parseJson?: boolean;                      // Parse response as JSON (default: true)
  decodeToString?: boolean;                 // Decode to string vs Uint8Array (default: true)
  signal?: AbortSignal;                     // Cancellation signal
  interceptors?: HttpInterceptorFn[];       // Request-specific interceptors
  onUploadProgress?: (progress: HttpProgressEvent) => void;
  onDownloadProgress?: (progress: HttpProgressEvent) => void;
}
```

### HttpStreamRequest

Streaming request configuration.

```typescript
interface HttpStreamRequest {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  decodeToString?: boolean;                 // default: false
  signal?: AbortSignal;
  onData: (chunk: string | Uint8Array) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}
```

### HttpSseRequest

Server-Sent Events request configuration.

```typescript
interface HttpSseRequest<T = any> {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  parseJson?: boolean;                      // default: false
  autoReconnect?: boolean;                  // default: false
  retryPolicy?: RetryPolicyConfig;
  signal?: AbortSignal;
  onEvent: (event: SseEvent<T>) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}
```

## Response Types

### HttpProgressEvent

Progress information for uploads/downloads.

```typescript
interface HttpProgressEvent {
  loaded: number;      // Bytes transferred
  total?: number;      // Total bytes (if known)
  percentage?: number; // Percentage (0-100, if total known)
}
```

### SseEvent

Server-Sent Event structure.

```typescript
interface SseEvent<T = any> {
  event: string;      // Event type (default: "message")
  data: T;            // Event data (parsed if parseJson: true)
  id?: string;        // Event ID for resuming
  retry?: number;     // Server-suggested retry interval (ms)
}
```

## Configuration Types

### HttpClientOptions

Client configuration options.

```typescript
interface HttpClientOptions {
  globalInterceptors?: HttpInterceptorFn[];
}
```

### RetryPolicyConfig

Retry policy configuration for auto-reconnect.

```typescript
interface RetryPolicyConfig {
  maxRetries: number;         // Max retry attempts (0 = unlimited)
  initialInterval: number;    // Initial delay in milliseconds
  maxInterval: number;        // Maximum delay cap in milliseconds
  backoffMultiplier: number;  // Exponential backoff multiplier
  jitter: number;             // Random jitter range in milliseconds
}
```

## Interceptor Types

### HttpInterceptorFn

Interceptor function type.

```typescript
type HttpInterceptorFn = (
  context: HttpInterceptorContext,
  next: HttpInterceptorNext
) => Promise<HttpInterceptorResponse>;
```

### HttpInterceptorContext

Interceptor context with request information.

```typescript
interface HttpInterceptorContext {
  method: string;
  url: string;
  body?: any;
  headers: Record<string, string>;
  signal?: AbortSignal;
}
```

## Error Types

### HttpError

HTTP error with status information.

```typescript
class HttpError extends Error {
  statusCode: number;
  statusText: string;
  response?: any;
}
```

### HttpJsonParseError

JSON parsing error.

```typescript
class HttpJsonParseError extends Error {
  responseText: string;
}
```

## Built-in Interceptors

### authInterceptor

Adds authentication headers.

```typescript
function authInterceptor(options: {
  getToken: () => string | null | Promise<string | null>;
  headerName?: string;    // default: 'Authorization'
  tokenPrefix?: string;   // default: 'Bearer '
}): HttpInterceptorFn;
```

### loggingInterceptor

Logs requests and responses.

```typescript
function loggingInterceptor(options?: {
  prefix?: string;
  secretHeaders?: string[];
  sanitizeBody?: boolean;
  shouldSkipLogging?: (ctx: HttpInterceptorContext) => boolean;
}): HttpInterceptorFn;
```

### headerInterceptor

Adds custom headers.

```typescript
function headerInterceptor(options: {
  headers: Record<string, string>;
}): HttpInterceptorFn;
```

### csrfInterceptor

Handles CSRF tokens (Browser only).

```typescript
function csrfInterceptor(options?: {
  cookieName?: string;        // default: 'XSRF-TOKEN'
  headerName?: string;        // default: 'X-XSRF-TOKEN'
  protectedMethods?: string[]; // default: ['POST', 'PUT', 'PATCH', 'DELETE']
}): HttpInterceptorFn;
```

## Angular Providers

### provideNgxHttpClient

Provides NgxHttpClient in Angular applications.

```typescript
function provideNgxHttpClient(
  options?: HttpClientOptions
): Provider;
```

## Next Steps

- Explore [Core Concepts](/core/http-client)
- Learn about [Request Handling](/core/requests-responses)
- Discover [Interceptors](/core/interceptors)
