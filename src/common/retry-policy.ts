import { RetryPolicyConfig } from "./types";

/**
 * Default values for retry policy configuration.
 * Used when options are not explicitly provided.
 */
export const RETRY_DEFAULTS = {
  /** Initial delay before first retry (3 seconds) */
  INITIAL_INTERVAL: 3000,
  /** Maximum delay between retries (30 seconds) */
  MAX_INTERVAL: 30000,
  /** Multiplier for exponential backoff (doubles each retry) */
  BACKOFF_MULTIPLIER: 2,
  /** Random jitter range to prevent thundering herd (1 second) */
  JITTER: 1000,
  /** Maximum retry attempts (0 = unlimited) */
  MAX_RETRIES: 0,
} as const;


/**
 * Manages retry timing with exponential backoff and jitter.
 *
 * Used internally by SSE connections to handle reconnection delays.
 * Implements exponential backoff to reduce server load during outages,
 * with jitter to prevent synchronized retry storms.
 *
 * **Backoff formula:**
 * ```
 * delay = min(initialInterval × multiplier^retryCount, maxInterval) + random(0, jitter)
 * ```
 *
 * @example
 * ```typescript
 * const policy = new RetryPolicy({
 *   initialInterval: 1000,
 *   maxInterval: 30000,
 *   backoffMultiplier: 2,
 *   jitter: 500,
 *   maxRetries: 10
 * });
 *
 * while (policy.shouldRetry()) {
 *   const delay = policy.getNextInterval();
 *   await sleep(delay);
 *
 *   if (await tryConnect()) {
 *     policy.reset();  // Reset on success
 *     break;
 *   }
 * }
 * ```
 *
 * @internal Used by fetchSse for auto-reconnect
 */
export class RetryPolicy {
  private readonly maxRetries: number;
  private readonly initialInterval: number;
  private readonly maxInterval: number;
  private readonly backoffMultiplier: number;
  private readonly jitter: number;

  private retryCount: number = 0;
  private currentInterval: number;

  constructor(config: RetryPolicyConfig = {}) {
    this.maxRetries = config.maxRetries ?? RETRY_DEFAULTS.MAX_RETRIES;
    this.initialInterval = config.initialInterval ?? RETRY_DEFAULTS.INITIAL_INTERVAL;
    this.maxInterval = config.maxInterval ?? RETRY_DEFAULTS.MAX_INTERVAL;
    this.backoffMultiplier = config.backoffMultiplier ?? RETRY_DEFAULTS.BACKOFF_MULTIPLIER;
    this.jitter = config.jitter ?? RETRY_DEFAULTS.JITTER;
    this.currentInterval = this.initialInterval;
  }

  /**
   * Checks if another retry attempt is allowed.
   * @returns true if maxRetries not reached (or unlimited)
   */
  shouldRetry(): boolean {
    // maxRetries = 0 means unlimited retries
    return this.maxRetries === 0 || this.retryCount < this.maxRetries;
  }

  /**
   * Gets delay for next retry with exponential backoff and jitter.
   * Automatically increments retry count.
   * @returns Delay in milliseconds
   */
  getNextInterval(): number {
    if (this.retryCount === 0) {
      // First retry: use current interval (may have been set by server)
      this.retryCount++;
      return this.addJitter(this.currentInterval);
    }

    // Apply exponential backoff, capped at maxInterval
    this.currentInterval = Math.min(
      this.currentInterval * this.backoffMultiplier,
      this.maxInterval
    );

    this.retryCount++;
    return this.addJitter(this.currentInterval);
  }

  /**
   * Resets policy to initial state (call on successful connection).
   */
  reset(): void {
    this.retryCount = 0;
    this.currentInterval = this.initialInterval;
  }

  /**
   * Gets current retry attempt number.
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Sets custom interval (e.g., from SSE retry: field).
   * Capped at maxInterval.
   * @param interval - Server-suggested interval in milliseconds
   */
  setCustomInterval(interval: number): void {
    this.currentInterval = Math.min(interval, this.maxInterval);
  }

  /**
   * Adds random jitter to prevent thundering herd.
   * @internal
   */
  private addJitter(interval: number): number {
    if (this.jitter === 0) return interval;
    return interval + Math.random() * this.jitter;
  }
}
