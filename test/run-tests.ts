#!/usr/bin/env bun

/**
 * Cross-platform test runner for all runtimes
 * Each runtime gets its own mock server instance to allow parallel execution
 *
 * Usage:
 *   bun test/run-tests.ts                 # Run all runtimes
 *   bun test/run-tests.ts node            # Run specific runtime
 *   bun test/run-tests.ts node deno       # Run multiple runtimes
 */

import { spawn, type Subprocess } from 'bun';
import * as path from 'path';
import * as fs from 'fs';

// Runtime configurations
interface RuntimeConfig {
  name: string;
  mockServer: {
    port: number;
    needsStatic: boolean;
  };
  testDir: string;
  setupCommand?: string[];
  testCommand: string[];
  displayName: string;
}

const RUNTIMES: Record<string, RuntimeConfig> = {
  node: {
    name: 'node',
    mockServer: {
      port: 3001,
      needsStatic: false
    },
    testDir: 'test/node',
    setupCommand: ['npm', 'install'],
    testCommand: ['npm', 'test'],
    displayName: 'Node.js'
  },
  deno: {
    name: 'deno',
    mockServer: {
      port: 3002,
      needsStatic: false
    },
    testDir: 'test/deno',
    testCommand: ['deno', 'task', 'test'],
    displayName: 'Deno'
  },
  bun: {
    name: 'bun',
    mockServer: {
      port: 3003,
      needsStatic: false
    },
    testDir: 'test/bun',
    setupCommand: ['bun', 'install'],
    testCommand: ['bun', 'test'],
    displayName: 'Bun'
  },
  browser: {
    name: 'browser',
    mockServer: {
      port: 3004,
      needsStatic: true
    },
    testDir: 'test/browser',
    setupCommand: ['sh', '-c', 'npm install && npx playwright install chromium --with-deps'],
    testCommand: ['npm', 'test'],
    displayName: 'Browser'
  }
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

function logHeader(message: string) {
  console.log('');
  log('='.repeat(60), 'cyan');
  log(message, 'bright');
  log('='.repeat(60), 'cyan');
  console.log('');
}

function logStep(message: string) {
  log(`▶ ${message}`, 'blue');
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

// Check if a command exists
async function commandExists(command: string): Promise<boolean> {
  try {
    const proc = spawn(['which', command], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

// Start mock server for a runtime
async function startMockServer(config: RuntimeConfig): Promise<Subprocess | null> {
  const serverScript = path.resolve(import.meta.dir, 'mock-server/server.ts');

  const args = ['--port', config.mockServer.port.toString()];
  if (config.mockServer.needsStatic) {
    args.push('--static');
  }

  logStep(`Starting mock server on port ${config.mockServer.port}${config.mockServer.needsStatic ? ' (with static serving)' : ''}...`);

  try {
    const server = spawn(['bun', serverScript, ...args], {
      stdout: 'pipe',
      stderr: 'pipe'
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if server is still running
    if (server.killed) {
      logError(`Mock server failed to start on port ${config.mockServer.port}`);
      return null;
    }

    logSuccess(`Mock server started on http://localhost:${config.mockServer.port}`);
    return server;
  } catch (error) {
    logError(`Failed to start mock server: ${error}`);
    return null;
  }
}

// Stop mock server
async function stopMockServer(server: Subprocess | null, port: number) {
  if (!server) return;

  logStep(`Stopping mock server on port ${port}...`);
  try {
    server.kill();
    await server.exited;
    logSuccess('Mock server stopped');
  } catch (error) {
    logWarning(`Error stopping mock server: ${error}`);
  }
}

// Check if setup is needed
async function needsSetup(config: RuntimeConfig): Promise<boolean> {
  const testDirPath = path.resolve(import.meta.dir, '..', config.testDir);

  if (config.name === 'node' || config.name === 'browser') {
    const nodeModulesPath = path.join(testDirPath, 'node_modules');
    return !fs.existsSync(nodeModulesPath);
  }

  if (config.name === 'bun') {
    const nodeModulesPath = path.join(testDirPath, 'node_modules');
    return !fs.existsSync(nodeModulesPath);
  }

  return false;
}

// Run setup for a runtime
async function runSetup(config: RuntimeConfig): Promise<boolean> {
  if (!config.setupCommand) return true;

  const testDirPath = path.resolve(import.meta.dir, '..', config.testDir);

  logStep(`Running setup: ${config.setupCommand.join(' ')}...`);

  try {
    const proc = spawn(config.setupCommand, {
      cwd: testDirPath,
      stdout: 'inherit',
      stderr: 'inherit'
    });

    await proc.exited;

    if (proc.exitCode === 0) {
      logSuccess('Setup completed');
      return true;
    } else {
      logError(`Setup failed with exit code ${proc.exitCode}`);
      return false;
    }
  } catch (error) {
    logError(`Setup error: ${error}`);
    return false;
  }
}

// Run tests for a runtime
async function runTests(config: RuntimeConfig): Promise<boolean> {
  const testDirPath = path.resolve(import.meta.dir, '..', config.testDir);

  logStep(`Running tests: ${config.testCommand.join(' ')}...`);

  try {
    const proc = spawn(config.testCommand, {
      cwd: testDirPath,
      stdout: 'inherit',
      stderr: 'inherit',
      env: {
        ...process.env,
        FORCE_COLOR: '1'
      }
    });

    await proc.exited;

    if (proc.exitCode === 0) {
      logSuccess(`${config.displayName} tests passed`);
      return true;
    } else {
      logError(`${config.displayName} tests failed with exit code ${proc.exitCode}`);
      return false;
    }
  } catch (error) {
    logError(`Test execution error: ${error}`);
    return false;
  }
}

// Run tests for a single runtime
async function runRuntimeTests(config: RuntimeConfig): Promise<boolean> {
  logHeader(`Testing ${config.displayName}`);

  let mockServer: Subprocess | null = null;

  try {
    // Start mock server
    mockServer = await startMockServer(config);
    if (!mockServer) {
      logError('Failed to start mock server');
      return false;
    }

    // Check if setup is needed
    if (await needsSetup(config)) {
      logStep('Setup required...');
      const setupSuccess = await runSetup(config);
      if (!setupSuccess) {
        return false;
      }
    } else {
      logStep('Setup not needed (dependencies already installed)');
    }

    // Run tests
    const testSuccess = await runTests(config);

    return testSuccess;

  } finally {
    // Always stop the mock server
    await stopMockServer(mockServer, config.mockServer.port);
  }
}

// Check runtime availability
async function checkRuntimeAvailability(config: RuntimeConfig): Promise<boolean> {
  if (config.name === 'deno') {
    return await commandExists('deno');
  }
  return true;
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  // Determine which runtimes to test
  let runtimesToTest: RuntimeConfig[];

  if (args.length === 0) {
    // Run all runtimes
    runtimesToTest = Object.values(RUNTIMES);
  } else {
    // Run specified runtimes
    runtimesToTest = args
      .map(name => RUNTIMES[name.toLowerCase()])
      .filter(config => {
        if (!config) {
          logWarning(`Unknown runtime: ${name}`);
          return false;
        }
        return true;
      });
  }

  if (runtimesToTest.length === 0) {
    logError('No valid runtimes specified');
    log('Available runtimes: ' + Object.keys(RUNTIMES).join(', '));
    process.exit(1);
  }

  logHeader('Test Suite Runner');
  log(`Runtimes to test: ${runtimesToTest.map(r => r.displayName).join(', ')}`);

  const results: { runtime: string; success: boolean; skipped: boolean }[] = [];

  // Run tests for each runtime sequentially
  for (const config of runtimesToTest) {
    // Check if runtime is available
    const isAvailable = await checkRuntimeAvailability(config);

    if (!isAvailable) {
      logWarning(`${config.displayName} is not installed, skipping...`);
      results.push({ runtime: config.displayName, success: false, skipped: true });
      continue;
    }

    const success = await runRuntimeTests(config);
    results.push({ runtime: config.displayName, success, skipped: false });
  }

  // Print summary
  logHeader('Test Summary');

  let allPassed = true;
  for (const result of results) {
    if (result.skipped) {
      logWarning(`${result.runtime}: SKIPPED`);
    } else if (result.success) {
      logSuccess(`${result.runtime}: PASSED`);
    } else {
      logError(`${result.runtime}: FAILED`);
      allPassed = false;
    }
  }

  console.log('');
  if (allPassed) {
    logSuccess('All tests passed! 🎉');
    process.exit(0);
  } else {
    logError('Some tests failed');
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  logError(`Unexpected error: ${error}`);
  process.exit(1);
});
