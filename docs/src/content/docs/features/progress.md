---
title: Progress Tracking
description: Monitor upload and download progress on all platforms
---

FetchQuack provides upload and download progress tracking that works on all platforms with platform-optimized implementations.

## Upload Progress

Track file upload progress:

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
    
    // Update UI
    progressBar.style.width = `${progress.percentage}%`;
    progressText.textContent = `${progress.percentage}% uploaded`;
  }
});

console.log('Upload complete!');
```

## Download Progress

Track file download progress:

```typescript
await client.fetch({
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

## Combined Progress

Track both upload and download:

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
  loaded: number;      // Bytes transferred
  total?: number;      // Total bytes (if known)
  percentage?: number; // Percentage (0-100, if total known)
}
```

## Angular Integration

```typescript
import { Component, inject, signal } from '@angular/core';
import { NgxHttpClient } from 'fetchquack/ngx';
import { Observable } from 'rxjs';

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
  
  upload() {
    const file = this.selectedFile();
    if (!file) return;
    
    this.uploadProgress.set(0);
    
    this.http.fetch({
      method: 'POST',
      url: '/api/upload',
      body: file,
      headers: { 'Content-Type': file.type },
      onUploadProgress: (progress) => {
        if (progress.percentage !== undefined) {
          this.uploadProgress.set(Math.round(progress.percentage));
        }
      }
    }).then(() => {
      console.log('Upload complete!');
      this.uploadProgress.set(100);
    }).catch(err => {
      console.error('Upload failed:', err);
    });
  }
  
  // Observable-based approach
  uploadAsObservable(file: File): Observable<number> {
    return new Observable(observer => {
      this.http.fetch({
        method: 'POST',
        url: '/api/upload',
        body: file,
        onUploadProgress: (progress) => {
          if (progress.percentage !== undefined) {
            observer.next(progress.percentage);
          }
        }
      }).then(() => {
        observer.complete();
      }).catch(err => {
        observer.error(err);
      });
    });
  }
}
```

## FormData Upload

Track progress with multiple files:

```typescript
const formData = new FormData();
formData.append('file1', file1);
formData.append('file2', file2);
formData.append('description', 'Multiple files');

await client.fetch({
  method: 'POST',
  url: '/api/upload-multiple',
  body: formData,
  onUploadProgress: (progress) => {
    console.log(`Uploading: ${progress.percentage}%`);
  }
});
```

## Large File Download

Download with progress indicator:

```typescript
const response = await client.fetch<Uint8Array>({
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

Progress tracking works differently on each platform:

| Platform | Upload | Download | Implementation |
|----------|--------|----------|----------------|
| **Browser** | ✅ Full | ✅ Full | XMLHttpRequest with progress events |
| **Node.js** | ⚠️ Limited | ✅ Full | Stream monitoring |
| **Bun** | ⚠️ Limited | ✅ Full | Stream monitoring |
| **Deno** | ⚠️ Limited | ✅ Full | Stream monitoring |

**Notes:**
- Browser has the best upload progress support via XMLHttpRequest
- All platforms support download progress through stream monitoring
- Upload progress outside browser may require server-side implementation

## Handling Unknown Total Size

When the server doesn't send `Content-Length` header:

```typescript
await client.fetch({
  method: 'GET',
  url: '/api/stream-data',
  onDownloadProgress: (progress) => {
    if (progress.total) {
      // Total is known
      progressBar.style.width = `${progress.percentage}%`;
    } else {
      // Total is unknown - show indeterminate progress
      const kb = (progress.loaded / 1024).toFixed(0);
      progressText.textContent = `Downloaded: ${kb} KB`;
      progressBar.classList.add('indeterminate');
    }
  }
});
```

## Best Practices

### Throttle Progress Updates

Avoid updating UI too frequently:

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
let startTime = Date.now();
let lastLoaded = 0;
let lastTime = Date.now();

await client.fetch({
  method: 'GET',
  url: '/api/file',
  onDownloadProgress: (progress) => {
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000; // seconds
    const bytesDiff = progress.loaded - lastLoaded;
    
    // Calculate speed (bytes per second)
    const speed = bytesDiff / timeDiff;
    const speedMB = (speed / (1024 * 1024)).toFixed(2);
    
    // Calculate time remaining
    if (progress.total && speed > 0) {
      const remaining = (progress.total - progress.loaded) / speed;
      const minutes = Math.floor(remaining / 60);
      const seconds = Math.floor(remaining % 60);
      
      console.log(`Speed: ${speedMB} MB/s, Time remaining: ${minutes}m ${seconds}s`);
    }
    
    lastLoaded = progress.loaded;
    lastTime = now;
  }
});
```

### Handle Errors

```typescript
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
  showError('Upload failed: ' + error.message);
  resetProgress();
}
```

## Next Steps

- Learn about [Streaming](/features/streaming) for chunk-by-chunk processing
- Explore [Server-Sent Events](/features/sse) for real-time updates
- Check out the [Angular Integration](/integrations/angular) guide
