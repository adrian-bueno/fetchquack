/**
 * Configuration for automatic retry with exponential backoff.
 *
 * Used by SSE connections to handle disconnections gracefully.
 *
 * **Algorithm:**
 * ```
 * interval = min(initialInterval * (backoffMultiplier ^ retryCount), maxInterval)
 * actualDelay = interval + random(0, jitter)
 * ```
 *
 * **Default behavior (3s → 6s → 12s → 24s → 30s max):**
 * - Starts at 3 seconds
 * - Doubles each retry
 * - Caps at 30 seconds
 * - Adds 0-1s random jitter
 * - Retries indefinitely
 *
 * @example
 * ```typescript
 * // Aggressive retry for critical connections
 * const policy: RetryPolicyConfig = {
 *   maxRetries: 0,        // unlimited
 *   initialInterval: 500, // start at 500ms
 *   maxInterval: 5000,    // cap at 5s
 *   backoffMultiplier: 1.5,
 *   jitter: 500
 * };
 *
 * // Conservative retry with limit
 * const policy: RetryPolicyConfig = {
 *   maxRetries: 5,
 *   initialInterval: 5000,
 *   maxInterval: 60000,
 *   backoffMultiplier: 2,
 *   jitter: 2000
 * };
 * ```
 */
export interface RetryPolicyConfig {
  /**
   * Maximum retry attempts. 0 = unlimited.
   * @default 0
   */
  maxRetries?: number;

  /**
   * Initial delay before first retry (milliseconds).
   * @default 3000
   */
  initialInterval?: number;

  /**
   * Maximum delay between retries (milliseconds).
   * Prevents exponential growth from causing excessive waits.
   * @default 30000
   */
  maxInterval?: number;

  /**
   * Multiplier for exponential backoff.
   * Set to 1 for constant interval (no exponential growth).
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Random jitter range (milliseconds) to prevent thundering herd.
   * Actual jitter is random value between 0 and this value.
   * @default 1000
   */
  jitter?: number;
}
