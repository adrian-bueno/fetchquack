---
title: Angular Integration
description: RxJS integration with dependency injection support for Angular 17+
---

# Angular Integration

FetchQuack provides seamless Angular integration with RxJS Observable support and full dependency injection context for interceptors.

## Installation

```bash
npm install fetchquack
```

FetchQuack requires:
- Angular 17.0.0 or higher
- RxJS 7.0.0 or higher

These are peer dependencies and should already be in your Angular project.

## Setup

Configure FetchQuack in your `app.config.ts`:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideNgxHttpClient } from 'fetchquack/ngx';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxHttpClient({
      globalInterceptors: [
        // Add your interceptors here
      ]
    })
  ]
};
```

## Using NgxHttpClient

Inject `NgxHttpClient` in your components or services:

```typescript
import { Component, inject, signal } from '@angular/core';
import { NgxHttpClient } from 'fetchquack/ngx';

@Component({
  selector: 'app-user-list',
  template: `
    <div *ngFor="let user of users()">
      {{ user.name }}
    </div>
  `
})
export class UserListComponent {
  private http = inject(NgxHttpClient);
  users = signal<User[]>([]);
  
  async ngOnInit() {
    const users = await this.http.fetch<User[]>({
      method: 'GET',
      url: '/api/users'
    });
    this.users.set(users);
  }
}
```

## Promise-based Requests

Use async/await for simple requests:

```typescript
@Component({...})
export class UserComponent {
  private http = inject(NgxHttpClient);
  user = signal<User | null>(null);
  
  async loadUser(id: number) {
    try {
      const user = await this.http.fetch<User>({
        method: 'GET',
        url: `/api/users/${id}`
      });
      this.user.set(user);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  }
  
  async createUser(userData: CreateUserDto) {
    const newUser = await this.http.fetch<User>({
      method: 'POST',
      url: '/api/users',
      body: userData
    });
    return newUser;
  }
}
```

## Observable-based Requests

Use Observables for reactive patterns:

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({...})
export class UserComponent {
  private http = inject(NgxHttpClient);
  user = signal<User | null>(null);
  
  loadUser(id: number) {
    this.http.fetch<User>({
      method: 'GET',
      url: `/api/users/${id}`,
      returnObservable: true  // Returns Observable
    }).pipe(
      takeUntilDestroyed()  // Auto-cleanup
    ).subscribe({
      next: (user) => this.user.set(user),
      error: (err) => console.error(err)
    });
  }
}
```

## Streaming Responses

Stream data with RxJS:

```typescript
@Component({
  selector: 'app-ai-chat',
  template: `<div>{{ response() }}</div>`
})
export class AiChatComponent {
  private http = inject(NgxHttpClient);
  response = signal('');
  
  streamAiResponse(prompt: string) {
    this.response.set('');
    
    this.http.fetchStream({
      method: 'POST',
      url: '/api/ai/chat',
      body: { prompt },
      decodeToString: true
    }).pipe(
      takeUntilDestroyed()
    ).subscribe({
      next: (chunk) => {
        this.response.update(text => text + chunk);
      },
      error: (err) => console.error(err),
      complete: () => console.log('Stream complete')
    });
  }
}
```

## Server-Sent Events

Handle SSE with automatic cleanup:

```typescript
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
      takeUntilDestroyed()  // Auto-disconnect when component destroys
    ).subscribe(event => {
      if (event.data) {
        this.notifications.update(list => [...list, event.data]);
      }
    });
  }
}
```

## Interceptors with Dependency Injection

The key advantage: interceptors can use Angular's `inject()`:

```typescript
// auth.interceptor.ts
import { inject } from '@angular/core';
import { HttpInterceptorFn } from 'fetchquack';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = async (context, next) => {
  // Use inject() to get Angular services!
  const authService = inject(AuthService);
  const token = await authService.getToken();
  
  if (token) {
    context.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return next(context);
};

// error-handler.interceptor.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpInterceptorFn, HttpError } from 'fetchquack';

export const errorHandlerInterceptor: HttpInterceptorFn = async (context, next) => {
  const router = inject(Router);
  
  try {
    return await next(context);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.statusCode === 401) {
        // Unauthorized - redirect to login
        router.navigate(['/login']);
      }
    }
    throw error;
  }
};

// app.config.ts
import { provideNgxHttpClient } from 'fetchquack/ngx';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorHandlerInterceptor } from './interceptors/error-handler.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxHttpClient({
      globalInterceptors: [
        authInterceptor,
        errorHandlerInterceptor
      ]
    })
  ]
};
```

## Progress Tracking

Monitor upload/download progress:

```typescript
@Component({
  selector: 'app-file-upload',
  template: `
    <input type="file" (change)="onFileSelected($event)" />
    <button (click)="upload()">Upload</button>
    <div>{{ uploadProgress() }}%</div>
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
    
    await this.http.fetch({
      method: 'POST',
      url: '/api/upload',
      body: file,
      onUploadProgress: (progress) => {
        if (progress.percentage !== undefined) {
          this.uploadProgress.set(Math.round(progress.percentage));
        }
      }
    });
    
    console.log('Upload complete!');
  }
}
```

## Service Pattern

Create reusable services:

```typescript
// user.service.ts
import { Injectable, inject } from '@angular/core';
import { NgxHttpClient } from 'fetchquack/ngx';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(NgxHttpClient);
  
  getUser(id: number) {
    return this.http.fetch<User>({
      method: 'GET',
      url: `/api/users/${id}`
    });
  }
  
  createUser(userData: CreateUserDto) {
    return this.http.fetch<User>({
      method: 'POST',
      url: '/api/users',
      body: userData
    });
  }
  
  updateUser(id: number, updates: Partial<User>) {
    return this.http.fetch<User>({
      method: 'PATCH',
      url: `/api/users/${id}`,
      body: updates
    });
  }
  
  deleteUser(id: number) {
    return this.http.fetch<void>({
      method: 'DELETE',
      url: `/api/users/${id}`
    });
  }
}

// Component usage
@Component({...})
export class UserComponent {
  private userService = inject(UserService);
  user = signal<User | null>(null);
  
  async loadUser(id: number) {
    this.user.set(await this.userService.getUser(id));
  }
}
```

## Error Handling

Handle errors with RxJS operators:

```typescript
import { catchError, throwError } from 'rxjs';

@Component({...})
export class DataComponent {
  private http = inject(NgxHttpClient);
  
  loadData() {
    this.http.fetch<Data>({
      method: 'GET',
      url: '/api/data',
      returnObservable: true
    }).pipe(
      catchError((error: HttpError) => {
        if (error.statusCode === 404) {
          this.showNotFound();
        } else {
          this.showError(error.message);
        }
        return throwError(() => error);
      }),
      takeUntilDestroyed()
    ).subscribe(data => this.processData(data));
  }
}
```

## Testing

Mock `NgxHttpClient` in tests:

```typescript
import { TestBed } from '@angular/core/testing';
import { NgxHttpClient } from 'fetchquack/ngx';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: jasmine.SpyObj<NgxHttpClient>;
  
  beforeEach(() => {
    const spy = jasmine.createSpyObj('NgxHttpClient', ['fetch']);
    
    TestBed.configureTestingModule({
      providers: [
        UserService,
        { provide: NgxHttpClient, useValue: spy }
      ]
    });
    
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(NgxHttpClient) as jasmine.SpyObj<NgxHttpClient>;
  });
  
  it('should get user', async () => {
    const mockUser = { id: 1, name: 'Test User' };
    httpMock.fetch.and.returnValue(Promise.resolve(mockUser));
    
    const user = await service.getUser(1);
    
    expect(user).toEqual(mockUser);
    expect(httpMock.fetch).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/users/1'
    });
  });
});
```

## Best Practices

### Use takeUntilDestroyed()

Always use `takeUntilDestroyed()` with Observables:

```typescript
// Good
this.http.fetch({...returnObservable: true})
  .pipe(takeUntilDestroyed())
  .subscribe(...);

// Avoid memory leaks - manual cleanup needed
this.http.fetch({...returnObservable: true})
  .subscribe(...);
```

### Prefer Promises for Simple Cases

```typescript
// Good for simple requests
async loadData() {
  const data = await this.http.fetch<Data>({...});
  this.data.set(data);
}

// Overkill for simple case
loadData() {
  this.http.fetch<Data>({...returnObservable: true})
    .pipe(takeUntilDestroyed())
    .subscribe(data => this.data.set(data));
}
```

### Use Services for API Logic

```typescript
// Good - API logic in service
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(NgxHttpClient);
  getUsers() { return this.http.fetch<User[]>({...}); }
}

// Avoid - API logic in component
@Component({...})
export class UserComponent {
  private http = inject(NgxHttpClient);
  async loadUsers() {
    return this.http.fetch<User[]>({...});
  }
}
```

## Next Steps

- Learn about [Interceptors](/core/interceptors) for advanced middleware
- Explore [Streaming](/features/streaming) for real-time data
- Check out [Server-Sent Events](/features/sse) for push notifications
