import { FetchWithProgressStrategy } from './fetch-with-progress';

let strategyInstance: FetchWithProgressStrategy | null = null;

export function registerStrategy(strategy: FetchWithProgressStrategy): void {
    strategyInstance = strategy;
}

export function getStrategy(): FetchWithProgressStrategy {
    if (!strategyInstance) {
        throw new Error(
            'No fetch strategy registered. Ensure you are importing the package through an environment-specific entry point (e.g., via correct package.json exports).'
        );
    }
    return strategyInstance;
}
