/**
 * Simple static file server for serving the browser bundle
 * Serves dist/browser/index.js on port 3005
 */

import * as fs from 'fs';
import * as path from 'path';

const PORT = 3005;
const bundleEsmPath = path.resolve(import.meta.dir, '../../dist/browser/index.js');
const bundleIifePath = path.resolve(import.meta.dir, '../../dist/browser/index.iife.js');
const htmlEsmPath = path.resolve(import.meta.dir, './test-page.esm.html');
const htmlIifePath = path.resolve(import.meta.dir, './test-page.iife.html');

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (url.pathname === '/index.js' || url.pathname === '/') {
      const bundle = fs.readFileSync(bundleEsmPath, 'utf-8');
      return new Response(bundle, {
        headers: {
          'Content-Type': 'application/javascript',
          ...corsHeaders,
        },
      });
    }

    if (url.pathname === '/index.iife.js') {
      const bundle = fs.readFileSync(bundleIifePath, 'utf-8');
      return new Response(bundle, {
        headers: {
          'Content-Type': 'application/javascript',
          ...corsHeaders,
        },
      });
    }

    if (url.pathname === '/test-page.iife.html') {
      const bundle = fs.readFileSync(htmlIifePath, 'utf-8');
      return new Response(bundle, {
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders,
        },
      });
    }

    if (url.pathname === '/test-page.esm.html') {
      const bundle = fs.readFileSync(htmlEsmPath, 'utf-8');
      return new Response(bundle, {
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders,
        },
      });
    }

    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders,
    });
  },
});

console.log(`Static server running on http://localhost:${PORT}`);
console.log(`Serving bundle from: ${bundleEsmPath}`);
