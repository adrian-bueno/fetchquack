/**
 * Server entry point (Node.js, Deno, Bun)
 * Uses Fetch API with ReadableStream for progress tracking
 */
import { registerStrategy } from '../common/fetch-with-progress-registry';
import { ServerFetchWithProgress } from './fetch-with-progress';

// Register server strategy on module load
registerStrategy(new ServerFetchWithProgress());

export * from '../common/index';
