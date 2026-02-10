# Tests for fetchquack

Comprehensive test suite for the fetchquack library across all supported runtimes: **Node.js**, **Deno**, **Bun**, and **Browser**.

## Quick Start

### Run All Tests

```bash
# From project root
bun run test

# Or run specific runtime
bun run test node
bun run test deno
bun run test bun
bun run test browser
```

The test runner automatically:
- Starts isolated mock servers for each runtime on dedicated ports
- Installs dependencies if needed
- Runs the test suite
- Cleans up servers on completion or failure

## Structure

```
test/
├── run-tests.ts              # Cross-platform TypeScript test runner
├── mock-server/              # Standalone mock HTTP server
│   ├── server.ts             # Server implementation with static file serving
│   ├── static-server.ts      # Static file server for browser tests
│   ├── test-page.esm.html    # ESM test page for browser tests
│   └── test-page.iife.html   # IIFE test page for browser tests
├── node/                     # Node.js tests (Vitest)
│   ├── package.json
│   ├── vitest.config.ts
│   └── tests/
│       ├── http-client.test.ts
│       ├── sse-retry-policy.test.ts
│       ├── gen-ai-compatibility.test.ts
│       └── repro-sse-reconnect.test.ts
├── deno/                     # Deno tests (Deno.test)
│   ├── deno.json
│   └── tests/
│       └── ...               # Same test files as node/
├── bun/                      # Bun tests (Bun test)
│   ├── package.json
│   └── tests/
│       └── ...               # Same test files as node/
└── browser/                  # Browser tests (Playwright)
    ├── package.json
    ├── playwright.config.ts
    └── tests/
        └── ...               # Same test files as node/
```

## Test Infrastructure

### Mock Server

The mock server (`test/mock-server/server.ts`) provides:

- **API Endpoints**: JSON responses, streaming, SSE, errors, delays
- **Static File Serving**: Browser bundles and test pages
- **CORS Support**: Proper headers for browser tests
- **Configurable Ports**: Via `--port` flag
- **Static Mode**: Via `--static` flag for browser tests

### Port Allocation

Each runtime uses an isolated mock server instance:

| Runtime | Port |
|---------|------|
| Node.js | 3001 |
| Deno    | 3002 |
| Bun     | 3003 |
| Browser | 3004 |

## Development

### Adding New Tests

1. Add the test to `test/node/tests/` (reference implementation)
2. Copy the test to all other runtime test files:
   - `test/deno/tests/`
   - `test/bun/tests/`
   - `test/browser/tests/`
3. Adjust syntax for runtime-specific test framework if needed (Vitest, Deno.test, Bun test, Playwright)
4. Update mock server endpoints if needed in `test/mock-server/server.ts`
5. Run `bun test/run-tests.ts` to verify all runtimes pass

### Test Files

| File | Description |
|------|-------------|
| `http-client.test.ts` | Core HTTP client functionality |
| `sse-retry-policy.test.ts` | SSE retry and reconnection logic |
| `gen-ai-compatibility.test.ts` | Generative AI streaming compatibility |
| `repro-sse-reconnect.test.ts` | SSE reconnection edge cases |

### Debugging

Run with verbose output:

```bash
# Node.js - see full Vitest output
cd test/node && npm test

# Deno - see detailed test results
cd test/deno && deno task test

# Bun - verbose output
cd test/bun && bun test --verbose

# Browser - headed mode with UI
cd test/browser && npx playwright test --headed --ui
```

## Requirements

- **Bun**: Required for test runner script and mock server
- **Node.js 18+**: For Node.js runtime tests (uses Vitest)
- **Deno 1.11+**: For Deno runtime tests
- **Playwright**: For browser testing (automatically installed via npm)

### Before Running Tests

Build the library:

```bash
npm run build
```

This ensures the `dist/` directory contains the latest built files used by the tests.
