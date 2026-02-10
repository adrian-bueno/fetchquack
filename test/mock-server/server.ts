#!/usr/bin/env bun

/**
 * Standalone Mock HTTP Server for Testing
 * Can be run independently with: bun test/mock-server/server.ts --port=3000
 *
 * Serves both API endpoints for testing and static files for browser tests
 */

import * as fs from 'fs';
import * as path from 'path';

interface MockServerConfig {
  port: number;
  host?: string;
  serveStatic?: boolean;
}

interface ServerInfo {
  port: number;
  baseUrl: string;
}

async function createMockServer(config: MockServerConfig): Promise<{
  info: ServerInfo;
  server: any;
  close: () => Promise<void>;
}> {
  const port = config.port;
  const host = config.host || 'localhost';
  const baseUrl = `http://${host}:${port}`;
  const serveStatic = config.serveStatic || false;

  // Static file paths (only used if serveStatic is true)
  const bundleEsmPath = path.resolve(import.meta.dir, '../../dist/browser/index.js');
  const bundleIifePath = path.resolve(import.meta.dir, '../../dist/browser/index.iife.js');
  const htmlEsmPath = path.resolve(import.meta.dir, './test-page.esm.html');
  const htmlIifePath = path.resolve(import.meta.dir, './test-page.iife.html');

  const server = Bun.serve({
    port,
    hostname: host,
    maxRequestBodySize: 1024 * 1024 * 1024 * 2, // 2GB max request body size
    fetch: async (request: Request) => {
      const url = new URL(request.url);
      const path = url.pathname;

      // CORS headers for all responses
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      };

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            ...corsHeaders,
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      // Static file serving (if enabled)
      if (serveStatic) {
        // Serve ESM bundle
        if (path === '/index.js' || path === '/') {
          try {
            const bundle = fs.readFileSync(bundleEsmPath, 'utf-8');
            return new Response(bundle, {
              headers: {
                'Content-Type': 'application/javascript',
                ...corsHeaders,
              },
            });
          } catch (error) {
            return new Response('Bundle not found', {
              status: 404,
              headers: corsHeaders,
            });
          }
        }

        // Serve IIFE bundle
        if (path === '/index.iife.js') {
          try {
            const bundle = fs.readFileSync(bundleIifePath, 'utf-8');
            return new Response(bundle, {
              headers: {
                'Content-Type': 'application/javascript',
                ...corsHeaders,
              },
            });
          } catch (error) {
            return new Response('Bundle not found', {
              status: 404,
              headers: corsHeaders,
            });
          }
        }

        // Serve ESM test page
        if (path === '/test-page.esm.html') {
          try {
            const html = fs.readFileSync(htmlEsmPath, 'utf-8');
            return new Response(html, {
              headers: {
                'Content-Type': 'text/html',
                ...corsHeaders,
              },
            });
          } catch (error) {
            return new Response('HTML not found', {
              status: 404,
              headers: corsHeaders,
            });
          }
        }

        // Serve IIFE test page
        if (path === '/test-page.iife.html') {
          try {
            const html = fs.readFileSync(htmlIifePath, 'utf-8');
            return new Response(html, {
              headers: {
                'Content-Type': 'text/html',
                ...corsHeaders,
              },
            });
          } catch (error) {
            return new Response('HTML not found', {
              status: 404,
              headers: corsHeaders,
            });
          }
        }
      }

      // Simple JSON response
      if (path === '/json') {
        return new Response(JSON.stringify({ message: 'Hello, World!', timestamp: Date.now() }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // JSON response with delay
      if (path === '/json-delayed') {
        const delay = parseInt(url.searchParams.get('delay') || '100');
        await new Promise(resolve => setTimeout(resolve, delay));
        return new Response(JSON.stringify({ message: 'Delayed response', delay }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Echo back the request body
      if (path === '/echo') {
        const body = await request.text();
        return new Response(body, {
          headers: { 'Content-Type': request.headers.get('Content-Type') || 'text/plain', ...corsHeaders }
        });
      }

      // Echo headers
      if (path === '/headers') {
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return new Response(JSON.stringify(headers), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Different status codes
      if (path === '/status') {
        const code = parseInt(url.searchParams.get('code') || '200');
        return new Response(JSON.stringify({ status: code }), {
          status: code,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Stream endpoint - sends chunks of data
      if (path === '/stream') {
        const chunks = parseInt(url.searchParams.get('chunks') || '5');
        const delay = parseInt(url.searchParams.get('delay') || '50');

        const stream = new ReadableStream({
          async start(controller) {
            for (let i = 1; i <= chunks; i++) {
              const chunk = `Chunk ${i} of ${chunks}\n`;
              controller.enqueue(new TextEncoder().encode(chunk));
              if (i < chunks) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
            controller.close();
          }
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        });
      }

      // Binary stream endpoint
      if (path === '/stream-binary') {
        const chunks = parseInt(url.searchParams.get('chunks') || '5');
        const delay = parseInt(url.searchParams.get('delay') || '50');

        const stream = new ReadableStream({
          async start(controller) {
            for (let i = 0; i < chunks; i++) {
              const buffer = new Uint8Array(10);
              buffer.fill(i);
              controller.enqueue(buffer);
              if (i < chunks - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
            controller.close();
          }
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'application/octet-stream', ...corsHeaders }
        });
      }

      // SSE endpoint - Server-Sent Events
      if (path === '/sse') {
        const count = parseInt(url.searchParams.get('count') || '5');
        const delay = parseInt(url.searchParams.get('delay') || '100');
        const includeId = url.searchParams.get('includeId') === 'true';
        const includeEvent = url.searchParams.get('includeEvent') === 'true';

        const stream = new ReadableStream({
          async start(controller) {
            for (let i = 1; i <= count; i++) {
              let message = '';
              if (includeId) {
                message += `id: ${i}\n`;
              }
              if (includeEvent) {
                message += `event: message\n`;
              }
              message += `data: ${JSON.stringify({ index: i, message: `Event ${i}` })}\n\n`;

              controller.enqueue(new TextEncoder().encode(message));
              if (i < count) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
          }
        });
      }

      // SSE endpoint with plain text data (not JSON)
      if (path === '/sse-text') {
        const count = parseInt(url.searchParams.get('count') || '5');
        const delay = parseInt(url.searchParams.get('delay') || '100');

        const stream = new ReadableStream({
          async start(controller) {
            for (let i = 1; i <= count; i++) {
              const message = `data: Message ${i}\n\n`;
              controller.enqueue(new TextEncoder().encode(message));
              if (i < count) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
          }
        });
      }

      // SSE endpoint with multiline data
      if (path === '/sse-multiline') {
        const count = parseInt(url.searchParams.get('count') || '3');

        const stream = new ReadableStream({
          async start(controller) {
            for (let i = 1; i <= count; i++) {
              const message = `data: Line 1 for event ${i}\ndata: Line 2 for event ${i}\ndata: Line 3 for event ${i}\n\n`;
              controller.enqueue(new TextEncoder().encode(message));
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
          }
        });
      }

      // SSE with custom event types
      if (path === '/sse-custom-events') {
        const stream = new ReadableStream({
          async start(controller) {
            const events = [
              { event: 'start', data: 'Starting process' },
              { event: 'progress', data: JSON.stringify({ percent: 50 }) },
              { event: 'progress', data: JSON.stringify({ percent: 100 }) },
              { event: 'complete', data: 'Process finished' }
            ];

            for (const evt of events) {
              const message = `event: ${evt.event}\ndata: ${evt.data}\n\n`;
              controller.enqueue(new TextEncoder().encode(message));
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
          }
        });
      }

      // SSE with retry field
      if (path === '/sse-retry') {
        const stream = new ReadableStream({
          async start(controller) {
            const message = `retry: 5000\ndata: Event with retry\n\n`;
            controller.enqueue(new TextEncoder().encode(message));
            await new Promise(resolve => setTimeout(resolve, 100));
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
          }
        });
      }

      // Upload endpoint with large body
      if (path === '/upload') {
        const body = await request.text();
        return new Response(JSON.stringify({
          received: body.length,
          contentType: request.headers.get('Content-Type')
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Large download endpoint
      if (path === '/download') {
        const size = parseInt(url.searchParams.get('size') || '1000');
        const data = 'x'.repeat(size);
        return new Response(data, {
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': size.toString(),
            ...corsHeaders
          }
        });
      }

      // Auth endpoint - checks for authorization header
      if (path === '/auth') {
        const auth = request.headers.get('Authorization');
        if (!auth || !auth.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        return new Response(JSON.stringify({
          message: 'Authenticated',
          token: auth.substring(7)
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // CORS endpoint
      if (path === '/cors') {
        return new Response(JSON.stringify({ message: 'CORS enabled' }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
      }

      // SSE that drops connection to test reconnection
      if (path === '/sse-drop') {
        const lastEventId = request.headers.get('Last-Event-ID');
        const retry = parseInt(url.searchParams.get('retry') || '100');

        const stream = new ReadableStream({
          async start(controller) {
            if (!lastEventId) {
              // First connection: Send event 1 and close
              // Send retry field to ensure client reconnects quickly
              const message = `retry: ${retry}\nid: 1\ndata: First\n\n`;
              controller.enqueue(new TextEncoder().encode(message));
              // Close immediately after sending
              controller.close();
            } else if (lastEventId === '1') {
              // Reconnection: Send event 2 and keep open
              const message = `id: 2\ndata: Second\n\n`;
              controller.enqueue(new TextEncoder().encode(message));
              // Keep open for a bit
              await new Promise(resolve => setTimeout(resolve, 500));
              controller.close();
            } else {
              // Unknown ID
              controller.close();
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
          }
        });
      }

      // SSE endpoint for testing retry policy with multiple reconnections
      if (path === '/sse-retry-policy') {
        const lastEventId = request.headers.get('Last-Event-ID');
        const failCount = parseInt(url.searchParams.get('failCount') || '3');

        const stream = new ReadableStream({
          async start(controller) {
            const currentId = lastEventId ? parseInt(lastEventId) : 0;

            if (currentId < failCount) {
              // Send an event and close to trigger retry
              const message = `id: ${currentId + 1}\ndata: Attempt ${currentId + 1}\n\n`;
              controller.enqueue(new TextEncoder().encode(message));
              controller.close();
            } else {
              // Final successful connection
              const message = `id: ${currentId + 1}\ndata: Success after ${failCount} retries\n\n`;
              controller.enqueue(new TextEncoder().encode(message));
              await new Promise(resolve => setTimeout(resolve, 500));
              controller.close();
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
          }
        });
      }

      // SSE endpoint that always fails (for testing max retries)
      if (path === '/sse-always-fail') {
        return new Response('Server Error', {
          status: 500,
          headers: corsHeaders
        });
      }

      // OpenAI-compatible stream simulation
      if (path === '/openai-stream') {
        const content = url.searchParams.get('content') || 'Hello world from AI';
        const model = 'gpt-mock';
        const stream = new ReadableStream({
          async start(controller) {
            const words = content.split(' ');

            // Send chunks
            for (let i = 0; i < words.length; i++) {
              const chunk = {
                id: `chatcmpl-${i}`,
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: model,
                choices: [
                  {
                    index: 0,
                    delta: { content: words[i] + (i < words.length - 1 ? ' ' : '') },
                    finish_reason: null
                  }
                ]
              };

              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Send finish chunk
            const finishChunk = {
              id: `chatcmpl-finish`,
              object: 'chat.completion.chunk',
              created: Date.now(),
              model: model,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: 'stop'
                }
              ]
            };
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finishChunk)}\n\n`));
            await new Promise(resolve => setTimeout(resolve, 20));

            // Send [DONE]
            controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders
          }
        });
      }

      // 404 for unknown paths
      return new Response(JSON.stringify({ error: 'Not found', path }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  });

  return {
    info: {
      port,
      baseUrl
    },
    server,
    close: async () => {
      server.stop();
    }
  };
}

// Parse command line arguments
const args = process.argv.slice(2);
const portArg = args.find(arg => arg.startsWith('--port'));
const staticArg = args.find(arg => arg === '--static');

let port = 3000;
if (portArg) {
  // Handle both --port=3001 and --port 3001
  if (portArg.includes('=')) {
    port = parseInt(portArg.split('=')[1]);
  } else {
    const portIndex = args.indexOf(portArg);
    if (portIndex >= 0 && portIndex + 1 < args.length) {
      port = parseInt(args[portIndex + 1]);
    }
  }
} else if (args.length > 0 && !isNaN(parseInt(args[0]))) {
  // Handle bare port number argument (e.g., "bun server.ts 3001")
  port = parseInt(args[0]);
}

const serveStatic = staticArg !== undefined;

// Start server
const mockServer = await createMockServer({ port, serveStatic });
console.log(`Mock server started at ${mockServer.info.baseUrl}`);
if (serveStatic) {
  console.log('Static file serving enabled for browser bundles');
}
console.log('Press Ctrl+C to stop');

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nStopping mock server...');
  await mockServer.close();
  console.log('Mock server stopped');
  process.exit(0);
});

// Keep the process alive
await new Promise(() => { });

export { };

