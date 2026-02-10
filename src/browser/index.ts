/**
 * Browser entry point
 * Uses XMLHttpRequest for reliable progress tracking
 */
import { registerStrategy } from '../common/fetch-with-progress-registry';
import { BrowserFetchWithProgress } from './fetch-with-progress';

// Register browser strategy on module load
registerStrategy(new BrowserFetchWithProgress());

export * from '../common/index';
