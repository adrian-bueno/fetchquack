import { FetchWithProgressStrategy } from './fetch-with-progress';

/** The singleton strategy instance, set by the environment-specific entry point. */
let strategyInstance: FetchWithProgressStrategy | null = null;

/**
 * Registers the runtime-specific fetch strategy for progress tracking.
 *
 * Called automatically by the environment entry points (`fetchquack/browser`,
 * `fetchquack/server`) on module load. Should not be called directly by consumers.
 *
 * @param strategy - The platform-specific strategy (Browser uses XHR, Server uses ReadableStream)
 * @internal
 */
export function registerStrategy(strategy: FetchWithProgressStrategy): void {
    strategyInstance = strategy;
}

/**
 * Returns the registered fetch strategy for the current runtime.
 *
 * @returns The registered {@link FetchWithProgressStrategy}
 * @throws {Error} If no strategy has been registered (wrong entry point imported)
 * @internal
 */
export function getStrategy(): FetchWithProgressStrategy {
    if (!strategyInstance) {
        throw new Error(
            'No fetch strategy registered. Ensure you are importing the package through an environment-specific entry point (e.g., via correct package.json exports).'
        );
    }
    return strategyInstance;
}
