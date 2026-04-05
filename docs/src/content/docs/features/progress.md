---
title: Progress Tracking
description: Monitor upload and download progress on all platforms
---

FetchQuack provides upload and download progress tracking that works on all platforms with platform-optimized implementations.

## Upload Progress

Track file upload progress:

```typescript
import { HttpClient } from 'fetchquack';

const client = new HttpClient();
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
    progressText.textContent = `${progress.percentage}% uploaded`;
  }
});

console.log('Upload complete!');
```

## Download Progress

Track file download progress:

```typescript
const data = await client.fetch({
  method: 'GET',
  url: '/api/files/large-file.zip',
  decodeToString: false,
  onDownloadProgress: (progress) => {
    if (progress.total) {
      console.log(`Downloaded: ${progress.percentage}%`);
      progressBar.style.width = `${progress.percentage}%`;
    } else {
      // Total unknown (no Content-Length header)
      const mb = (progress.loaded / (1024 * 1024)).toFixed(2);
      console.log(`Downloaded: ${mb} MB`);
    }
  }
});
```

## Combined Upload and Download Progress

Track both directions for requests that upload data and receive a response:

```typescript
await client.fetch({
  method: 'POST',
  url: '/api/process-file',
  body: inputFile,
  onUploadProgress: (p) => {
    uploadBar.style.width = `${p.percentage}%`;
    uploadText.textContent = `Uploading: ${p.percentage}%`;
  },
  onDownloadProgress: (p) => {
    downloadBar.style.width = `${p.percentage}%`;
    downloadText.textContent = `Downloading: ${p.percentage}%`;
  }
});
```

## Progress Event Structure

```typescript
interface HttpProgressEvent {
  loaded: number;      // Bytes transferred so far
  total?: number;      // Total bytes (undefined if Content-Length not available)
  percentage?: number; // 0-100 (undefined if total is unknown)
}
```

## Angular Integration

Progress tracking works the same in Angular since `fetch()` returns a Promise:

```typescript
import { Component, inject, signal } from '@angular/core';
import { NgxHttpClient } from 'fetchquack/ngx';

@Component({
  selector: 'app-file-upload',
  template: `
    <input type="file" (change)="onFileSelected($event)" />
    <button (click)="upload()" [disabled]="!selectedFile()">Upload</button>
    
    <div class="progress-bar">
      <div class="progress" [style.width.%]="uploadProgress()"></div>
    </div>
    <div>{{ uploadProgress() }}% uploaded</div>
  `
})
export class FileUploadComponent {
  private http = inject(NgxHttpClient);
  
  selectedFile = signal<File | null>(null);
  uploadProgress = signal(0);
  
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile.set(input.files[0]);
    }
  }
  
  async upload() {
    const file = this.selectedFile();
    if (!file) return;
    
    this.uploadProgress.set(0);
    
    try {
      await this.http.fetch({
        method: 'POST',
        url: '/api/upload',
        body: file,
        headers: { 'Content-Type': file.type },
        onUploadProgress: (progress) => {
          if (progress.percentage !== undefined) {
            this.uploadProgress.set(Math.round(progress.percentage));
          }
        }
      });
      console.log('Upload complete!');
      this.uploadProgress.set(100);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  }
}
```

## FormData Upload

Track progress when uploading multiple files:

```typescript
const formData = new FormData();
formData.append('file1', file1);
formData.append('file2', file2);
formData.append('description', 'Multiple files');

await client.fetch({
  method: 'POST',
  url: '/api/upload-multiple',
  body: formData,
  // Don't set Content-Type - browser sets it with boundary
  onUploadProgress: (progress) => {
    console.log(`Uploading: ${progress.percentage}%`);
  }
});
```

## Large File Download

Download with progress indicator:

```typescript
const response = await client.fetch({
  method: 'GET',
  url: '/api/files/video.mp4',
  decodeToString: false,
  onDownloadProgress: (progress) => {
    if (progress.total) {
      const mb = (progress.loaded / (1024 * 1024)).toFixed(1);
      const totalMb = (progress.total / (1024 * 1024)).toFixed(1);
      progressText.textContent = `${mb} MB / ${totalMb} MB`;
      progressBar.style.width = `${progress.percentage}%`;
    }
  }
});

// Create downloadable link
const blob = new Blob([response], { type: 'video/mp4' });
const url = URL.createObjectURL(blob);
downloadLink.href = url;
```

## Platform Support

Progress tracking uses platform-optimized implementations:

| Platform | Upload Progress | Download Progress | Implementation |
|----------|----------------|-------------------|----------------|
| **Browser** | Full support | Full support | XMLHttpRequest with progress events |
| **Node.js** | Chunked streaming | Full support | ReadableStream monitoring (64KB chunks) |
| **Bun** | Chunked streaming | Full support | ReadableStream monitoring |
| **Deno** | Chunked streaming | Full support | ReadableStream monitoring |

On the server (Node.js/Bun/Deno), upload progress is tracked by sending the body in 64KB chunks via a `ReadableStream`. If streaming request bodies aren't supported, a fallback emits 0% and 100% events.

## Handling Unknown Total Size

When the server doesn't send a `Content-Length` header, `total` and `percentage` are `undefined`:

```typescript
await client.fetch({
  method: 'GET',
  url: '/api/stream-data',
  onDownloadProgress: (progress) => {
    if (progress.percentage !== undefined) {
      // Total is known - show percentage
      progressBar.style.width = `${progress.percentage}%`;
    } else {
      // Total is unknown - show bytes downloaded
      const kb = (progress.loaded / 1024).toFixed(0);
      progressText.textContent = `Downloaded: ${kb} KB`;
      progressBar.classList.add('indeterminate');
    }
  }
});
```

## Best Practices

### Throttle Progress Updates

Avoid updating the UI too frequently:

```typescript
let lastUpdate = 0;
const THROTTLE_MS = 100;

await client.fetch({
  method: 'GET',
  url: '/api/large-file',
  onDownloadProgress: (progress) => {
    const now = Date.now();
    if (now - lastUpdate >= THROTTLE_MS) {
      updateProgressUI(progress);
      lastUpdate = now;
    }
  }
});
```

### Show Speed and Time Remaining

```typescript
let lastLoaded = 0;
let lastTime = Date.now();

await client.fetch({
  method: 'GET',
  url: '/api/file',
  onDownloadProgress: (progress) => {
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000; // seconds
    const bytesDiff = progress.loaded - lastLoaded;
    
    if (timeDiff > 0) {
      const speed = bytesDiff / timeDiff;
      const speedMB = (speed / (1024 * 1024)).toFixed(2);
      
      if (progress.total && speed > 0) {
        const remaining = (progress.total - progress.loaded) / speed;
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);
        console.log(`Speed: ${speedMB} MB/s, ETA: ${minutes}m ${seconds}s`);
      }
      
      lastLoaded = progress.loaded;
      lastTime = now;
    }
  }
});
```

### Handle Errors

Always handle errors alongside progress tracking:

```typescript
import { HttpError } from 'fetchquack';

try {
  await client.fetch({
    method: 'POST',
    url: '/api/upload',
    body: file,
    onUploadProgress: (progress) => {
      updateProgress(progress.percentage);
    }
  });
  showSuccess('Upload complete!');
} catch (error) {
  if (error instanceof HttpError) {
    showError(`Upload failed: ${error.message}`);
  }
  resetProgress();
}
```

## Next Steps

- Learn about [Streaming](/features/streaming) for chunk-by-chunk processing
- Explore [Server-Sent Events](/features/sse) for real-time updates
- Check out the [Angular Integration](/integrations/angular) guide
