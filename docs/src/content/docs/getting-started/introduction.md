---
title: Introduction
description: Learn about fetchquack and what makes it special
---

Welcome to **fetchquack** 🦆 — a lightweight, universal HTTP client built on the standard Fetch API.

## What is fetchquack?

fetchquack is a modern HTTP client library designed for developers who need powerful features without the bloat. It's built on top of the standard Fetch API, which means it works everywhere JavaScript runs.

## Why fetchquack?

### Built on Web Standards
fetchquack uses the native Fetch API under the hood, ensuring compatibility and future-proof code. No proprietary abstractions—just enhanced functionality on top of what browsers and runtimes already provide.

### Universal Runtime Support
Write once, run anywhere:
- **Browser** — Modern browsers with full feature support
- **Node.js** — Version 18+ with native fetch
- **Bun** — Full compatibility with Bun's optimized runtime
- **Deno** — Works seamlessly in Deno's secure runtime

### First-Class Streaming Support
Unlike traditional HTTP clients, fetchquack treats streaming as a first-class citizen:
- Stream text and binary responses
- Server-Sent Events (SSE) with auto-reconnect
- Progress tracking for uploads and downloads
- Cancellation via AbortController

### Zero Dependencies
fetchquack has **zero runtime dependencies**. The core library is just ~4KB minified and gzipped, making it perfect for bundle-size-conscious applications.

### TypeScript First
Written in TypeScript with complete type definitions. Get full IntelliSense support and type safety out of the box.

## Key Features

- 🌐 **Universal** — Browser, Node.js, Bun, Deno
- 🌊 **Streaming** — Text and binary streaming support
- 📡 **SSE** — Full Server-Sent Events implementation
- ⏳ **Progress** — Upload/download progress tracking
- 🔄 **Interceptors** — Powerful middleware system
- 🅰️ **Angular** — RxJS integration for Angular apps
- 🔒 **Type-Safe** — Complete TypeScript definitions
- 📦 **Lightweight** — ~4KB minified + gzipped

## Next Steps

Ready to get started? Check out the [Installation](/getting-started/installation) guide.
