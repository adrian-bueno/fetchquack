---
title: Streaming
description: Stream large responses and process data as it arrives
---

FetchQuack provides first-class support for streaming responses, allowing you to process data chunk by chunk as it arrives. This is ideal for large files, real-time data, AI chat interfaces, and log streaming.

## Why Stream?

Streaming is beneficial when:

- **Large responses** -- Process data without loading everything into memory
- **Real-time data** -- Display results as they arrive (AI chat, live logs)
- **Better UX** -- Show progress and partial results immediately
- **Memory efficiency** -- Handle files larger than available RAM

## How It Works

`fetchStream()` returns `void` and delivers data through callbacks:
- `onData` -- Called for each chunk of data
- `onError` -- Called if an error occurs
- `onComplete` -- Called when the stream ends

Use `AbortController` to cancel the stream at any time.

## Basic Text Streaming

Stream text responses chunk by chunk:

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient();
const controller = new AbortController();

client.fetchStream({
  method: 'GET',
  url: '/api/stream',
  signal: controller.signal,
  decodeToString: true,  // Decode chunks as text (string)
  onData: (chunk) => {
    console.log('Received:', chunk);
  },
  onComplete: () => {
    console.log('Stream complete');
  },
  onError: (error) => {
    console.error('Stream error:', error);
  }
});

// Cancel the stream at any time
// controller.abort();
```

## Binary Streaming

Stream binary data (images, videos, files):

```typescript
const controller = new AbortController();
const chunks: Uint8Array[] = [];

client.fetchStream({
  method: 'GET',
  url: '/api/files/video.mp4',
  signal: controller.signal,
  // decodeToString defaults to false, so chunks are Uint8Array
  onData: (chunk) => {
    chunks.push(chunk);
    console.log(`Downloaded ${chunk.length} bytes`);
  },
  onComplete: () => {
    const blob = new Blob(chunks, { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    videoElement.src = url;
  }
});
```

## AI Chat Streaming

Stream AI responses in real-time.

### Vanilla JavaScript

```typescript
const responseDiv = document.getElementById('response');
const controller = new AbortController();
let fullResponse = '';

client.fetchStream({
  method: 'POST',
  url: '/api/ai/chat',
  body: {
    messages: [
      { role: 'user', content: 'Write a short poem about coding' }
    ],
    stream: true
  },
  signal: controller.signal,
  decodeToString: true,
  onData: (chunk) => {
    fullResponse += chunk;
    responseDiv.textContent = fullResponse;
  },
  onComplete: () => {
    console.log('AI response complete');
  },
  onError: (error) => {
    console.error('Streaming failed:', error);
    responseDiv.textContent = 'Error: ' + error.message;
  }
});

// Stop button
stopButton.onclick = () => controller.abort();
```

### Angular

```typescript
import { Component, inject, signal } from '@angular/core';
import { NgxHttpClient } from 'fetchquack/ngx';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ai-chat',
  template: `
    <div class="messages">
      <div class="user-message">{{ userMessage }}</div>
      <div class="ai-response">{{ aiResponse() }}</div>
    </div>
    <button (click)="sendMessage()">Send</button>
    <button (click)="stopStreaming()" *ngIf="streaming()">Stop</button>
  `
})
export class AiChatComponent {
  private http = inject(NgxHttpClient);
  private subscription?: Subscription;
  
  userMessage = 'Write a poem about TypeScript';
  aiResponse = signal('');
  streaming = signal(false);
  
  sendMessage() {
    this.aiResponse.set('');
    this.streaming.set(true);
    
    // fetchStream returns an Observable in Angular
    // Unsubscribing automatically aborts the stream
    this.subscription = this.http.fetchStream({
      method: 'POST',
      url: '/api/ai/chat',
      body: {
        messages: [{ role: 'user', content: this.userMessage }],
        stream: true
      },
      decodeToString: true
    }).subscribe({
      next: (chunk) => {
        this.aiResponse.update(response => response + chunk);
      },
      error: (err) => {
        console.error('Stream error:', err);
        this.streaming.set(false);
      },
      complete: () => {
        this.streaming.set(false);
      }
    });
  }
  
  stopStreaming() {
    this.subscription?.unsubscribe(); // Automatically aborts the stream
    this.streaming.set(false);
  }
}
```

## Log Streaming

Stream server logs in real-time:

```typescript
const logContainer = document.getElementById('logs');
const controller = new AbortController();

client.fetchStream({
  method: 'GET',
  url: '/api/logs/stream',
  signal: controller.signal,
  decodeToString: true,
  onData: (chunk) => {
    const lines = chunk.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const logEntry = document.createElement('div');
      logEntry.className = 'log-line';
      logEntry.textContent = line;
      logContainer.appendChild(logEntry);
    });
    
    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
  },
  onComplete: () => {
    console.log('Log stream ended');
  }
});

// Stop streaming logs
// controller.abort();
```

## File Download with Streaming

Download large files with manual progress tracking:

```typescript
const controller = new AbortController();
const chunks: Uint8Array[] = [];
let totalBytesReceived = 0;

client.fetchStream({
  method: 'GET',
  url: '/api/files/large-file.zip',
  signal: controller.signal,
  onData: (chunk) => {
    chunks.push(chunk);
    totalBytesReceived += chunk.length;
    
    const megabytes = (totalBytesReceived / (1024 * 1024)).toFixed(2);
    progressText.textContent = `Downloaded: ${megabytes} MB`;
  },
  onComplete: () => {
    const blob = new Blob(chunks, { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'file.zip';
    a.click();
    URL.revokeObjectURL(url);
  }
});
```

## JSON Lines Streaming (NDJSON)

Process newline-delimited JSON objects one at a time:

```typescript
const controller = new AbortController();
let buffer = '';

client.fetchStream({
  method: 'GET',
  url: '/api/data/jsonl',
  signal: controller.signal,
  decodeToString: true,
  onData: (chunk) => {
    buffer += chunk;
    
    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    lines.forEach(line => {
      if (line.trim()) {
        try {
          const data = JSON.parse(line);
          processDataItem(data);
        } catch (err) {
          console.error('Failed to parse JSON:', line);
        }
      }
    });
  },
  onComplete: () => {
    // Process any remaining data in the buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        processDataItem(data);
      } catch (err) {
        console.error('Failed to parse final JSON:', buffer);
      }
    }
  }
});
```

## Cancellation

Use `AbortController` to cancel streams:

```typescript
const controller = new AbortController();

client.fetchStream({
  method: 'GET',
  url: '/api/long-stream',
  signal: controller.signal,
  decodeToString: true,
  onData: (chunk) => console.log(chunk),
  onError: (error) => {
    // AbortError is silently ignored by the library,
    // so this won't fire when you call controller.abort()
    console.error('Stream error:', error);
  }
});

// Cancel after 10 seconds
setTimeout(() => controller.abort(), 10000);
```

In Angular, unsubscribing from the Observable automatically aborts the stream:

```typescript
const subscription = this.http.fetchStream({
  method: 'GET',
  url: '/api/stream',
  decodeToString: true
}).subscribe(chunk => console.log(chunk));

// Cancel
subscription.unsubscribe();

// Or use takeUntilDestroyed() for automatic cleanup
// (pass DestroyRef when calling outside constructor/field initializer)
this.http.fetchStream({...})
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(chunk => console.log(chunk));
```

## Request Options

Full `HttpStreamRequest` configuration:

```typescript
// Binary streaming (default)
interface HttpStreamRequestBinary {
  method: string;                       // HTTP method
  url: string;                          // Request URL
  body?: any;                           // Request body
  headers?: Record<string, string>;     // HTTP headers
  interceptors?: HttpInterceptorFn[];   // Interceptor chain
  signal?: AbortSignal;                 // Cancellation signal
  decodeToString?: false;               // Binary mode (default)
  onData?: (chunk: Uint8Array) => void; // Data callback
  onError?: (error: Error) => void;     // Error callback
  onComplete?: () => void;              // Completion callback
}

// Text streaming
interface HttpStreamRequestString {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  interceptors?: HttpInterceptorFn[];
  signal?: AbortSignal;
  decodeToString: true;                 // Text mode
  onData?: (chunk: string) => void;     // Data callback (string chunks)
  onError?: (error: Error) => void;
  onComplete?: () => void;
}
```

## Platform Support

Streaming works on all platforms:

| Platform | Implementation |
|----------|----------------|
| **Browser** | ReadableStream API |
| **Node.js** | Native ReadableStream (Node.js 18+) |
| **Bun** | Optimized ReadableStream |
| **Deno** | Native ReadableStream |

## Best Practices

### Handle Backpressure

Don't overwhelm the UI with too many updates:

```typescript
let updateScheduled = false;
let accumulatedData = '';

client.fetchStream({
  method: 'GET',
  url: '/api/stream',
  decodeToString: true,
  onData: (chunk) => {
    accumulatedData += chunk;
    
    if (!updateScheduled) {
      updateScheduled = true;
      requestAnimationFrame(() => {
        updateUI(accumulatedData);
        updateScheduled = false;
      });
    }
  }
});
```

### Buffer Management

For binary streams, limit memory usage:

```typescript
const MAX_CHUNKS = 100;
const chunks: Uint8Array[] = [];

client.fetchStream({
  method: 'GET',
  url: '/api/large-file',
  onData: (chunk) => {
    chunks.push(chunk);
    
    if (chunks.length >= MAX_CHUNKS) {
      saveToDisk(chunks);
      chunks.length = 0;
    }
  },
  onComplete: () => {
    if (chunks.length > 0) {
      saveToDisk(chunks);
    }
  }
});
```

### Error Recovery

Always handle errors gracefully:

```typescript
client.fetchStream({
  method: 'GET',
  url: '/api/stream',
  decodeToString: true,
  onData: (chunk) => {
    try {
      processChunk(chunk);
    } catch (err) {
      console.error('Error processing chunk:', err);
      // Continue processing other chunks
    }
  },
  onError: (error) => {
    console.error('Stream error:', error);
    showErrorToUser('Stream interrupted. Please try again.');
  },
  onComplete: () => {
    console.log('Stream completed successfully');
  }
});
```

## Next Steps

- Learn about [Server-Sent Events](/features/sse) for event-based streaming
- Explore [Progress Tracking](/features/progress) for upload/download monitoring
- Check out the [API Reference](/api) for all options
