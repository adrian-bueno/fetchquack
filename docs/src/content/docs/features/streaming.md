---
title: Streaming
description: Stream large responses and process data as it arrives
---

FetchQuack provides first-class support for streaming responses, allowing you to process data chunk by chunk as it arrives. This is perfect for large files, real-time data, AI chat interfaces, and log streaming.

## Why Stream?

Streaming is beneficial when:

- **Large responses** - Process data without loading everything into memory
- **Real-time data** - Display results as they arrive (AI chat, live logs)
- **Better UX** - Show progress and partial results immediately
- **Memory efficiency** - Handle files larger than available RAM

## Basic Text Streaming

Stream text responses chunk by chunk:

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient();

const abort = await client.fetchStream({
  method: 'GET',
  url: '/api/stream',
  decodeToString: true,  // Decode chunks as text
  onData: (chunk) => {
    console.log('Received:', chunk);
    // Display chunk in UI
  },
  onComplete: () => {
    console.log('Stream complete');
  },
  onError: (error) => {
    console.error('Stream error:', error);
  }
});

// Cancel streaming at any time
abort();
```

## Binary Streaming

Stream binary data (images, videos, files):

```typescript
const chunks: Uint8Array[] = [];

await client.fetchStream({
  method: 'GET',
  url: '/api/files/video.mp4',
  decodeToString: false,  // Keep as binary
  onData: (chunk) => {
    chunks.push(chunk);
    console.log(`Downloaded ${chunk.length} bytes`);
  },
  onComplete: () => {
    // Combine all chunks into a blob
    const blob = new Blob(chunks, { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    videoElement.src = url;
  }
});
```

## AI Chat Streaming

Perfect for streaming AI responses:

### Vanilla JavaScript

```typescript
const responseDiv = document.getElementById('response');
let fullResponse = '';

const abort = await client.fetchStream({
  method: 'POST',
  url: '/api/ai/chat',
  body: {
    messages: [
      { role: 'user', content: 'Write a short poem about coding' }
    ],
    stream: true
  },
  headers: {
    'Content-Type': 'application/json'
  },
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

// Add stop button
stopButton.onclick = () => abort();
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
        console.log('Stream complete');
        this.streaming.set(false);
      }
    });
  }
  
  stopStreaming() {
    this.subscription?.unsubscribe();
    this.streaming.set(false);
  }
}
```

## Log Streaming

Stream server logs in real-time:

```typescript
const logContainer = document.getElementById('logs');

await client.fetchStream({
  method: 'GET',
  url: '/api/logs/stream',
  decodeToString: true,
  onData: (chunk) => {
    // Split chunk into lines
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
```

## File Download with Progress

Combine streaming with progress tracking:

```typescript
const chunks: Uint8Array[] = [];
let totalBytesReceived = 0;

await client.fetchStream({
  method: 'GET',
  url: '/api/files/large-file.zip',
  decodeToString: false,
  onData: (chunk) => {
    chunks.push(chunk);
    totalBytesReceived += chunk.length;
    
    // Update progress bar
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

## JSON Line Streaming (JSONL)

Process JSON objects one at a time:

```typescript
let buffer = '';

await client.fetchStream({
  method: 'GET',
  url: '/api/data/jsonl',
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
    // Process any remaining data
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

Cancel streams at any time using the returned abort function:

```typescript
// Start streaming
const abort = await client.fetchStream({
  method: 'GET',
  url: '/api/long-stream',
  decodeToString: true,
  onData: (chunk) => console.log(chunk)
});

// Cancel after 10 seconds
setTimeout(() => {
  abort();
  console.log('Stream cancelled');
}, 10000);
```

Or use `AbortController`:

```typescript
const controller = new AbortController();

await client.fetchStream({
  method: 'GET',
  url: '/api/stream',
  signal: controller.signal,
  decodeToString: true,
  onData: (chunk) => console.log(chunk),
  onError: (error) => {
    if (error.name === 'AbortError') {
      console.log('Stream was cancelled');
    }
  }
});

// Cancel from anywhere
controller.abort();
```

## Request Options

Full `fetchStream()` configuration:

```typescript
interface HttpStreamRequest {
  method: string;                      // HTTP method
  url: string;                         // Request URL
  body?: any;                          // Request body
  headers?: Record<string, string>;    // HTTP headers
  decodeToString?: boolean;            // Decode chunks to string (default: false)
  signal?: AbortSignal;                // Cancellation signal
  onData: (chunk: string | Uint8Array) => void;     // Data callback
  onError?: (error: Error) => void;    // Error callback
  onComplete?: () => void;             // Completion callback
}
```

## Platform Support

Streaming works on all platforms with optimized implementations:

| Platform | Implementation |
|----------|----------------|
| **Browser** | ReadableStream API |
| **Node.js** | Native streams with ReadableStream |
| **Bun** | Optimized ReadableStream |
| **Deno** | Native ReadableStream |

## Best Practices

### Handle Backpressure

Don't overwhelm the UI with too many updates:

```typescript
let updateScheduled = false;
let accumulatedData = '';

await client.fetchStream({
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

await client.fetchStream({
  method: 'GET',
  url: '/api/large-file',
  decodeToString: false,
  onData: (chunk) => {
    chunks.push(chunk);
    
    // Save to disk or process when buffer is full
    if (chunks.length >= MAX_CHUNKS) {
      saveToDisk(chunks);
      chunks.length = 0; // Clear array
    }
  },
  onComplete: () => {
    // Save remaining chunks
    if (chunks.length > 0) {
      saveToDisk(chunks);
    }
  }
});
```

### Error Recovery

Always handle errors gracefully:

```typescript
await client.fetchStream({
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
- Check out the [API Reference](/api/http-stream-request) for all options
