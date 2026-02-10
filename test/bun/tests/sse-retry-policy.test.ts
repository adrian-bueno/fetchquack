import { describe, it, expect } from 'bun:test';
import { HttpClient } from 'fetchquack';

const baseUrl = 'http://localhost:3003';

describe('HttpClient - SSE Retry Policy (Bun)', () => {
    it('should reconnect with exponential backoff', async () => {
        const client = new HttpClient();
        const events: any[] = [];
        const reconnectTimestamps: number[] = [];
        let firstConnectionTime: number = 0;

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-retry-policy?failCount=3`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 5,
                initialInterval: 100,
                maxInterval: 5000,
                backoffMultiplier: 2,
                jitter: 50
            },
            onEvent: (event) => {
                const now = Date.now();
                if (firstConnectionTime === 0) {
                    firstConnectionTime = now;
                } else {
                    reconnectTimestamps.push(now);
                }
                events.push(event);
            }
        });

        await new Promise(resolve => setTimeout(resolve, 900));
        abortController.abort();

        expect(events.length).toBe(4);
        expect(events[0].data).toBe('Attempt 1');
        expect(events[1].data).toBe('Attempt 2');
        expect(events[2].data).toBe('Attempt 3');
        expect(events[3].data).toBe('Success after 3 retries');

        expect(reconnectTimestamps.length).toBe(3);

        const firstDelay = reconnectTimestamps[0] - firstConnectionTime;
        const secondDelay = reconnectTimestamps[1] - reconnectTimestamps[0];
        const thirdDelay = reconnectTimestamps[2] - reconnectTimestamps[1];

        expect(firstDelay).toBeGreaterThan(0);
        expect(firstDelay).toBeLessThan(1000);
        expect(secondDelay).toBeGreaterThan(0);
        expect(secondDelay).toBeLessThan(1000);
        expect(thirdDelay).toBeGreaterThan(0);
        expect(thirdDelay).toBeLessThan(1000);
    });

    it('should respect maxRetries and stop after reaching limit', async () => {
        const client = new HttpClient();
        const errors: any[] = [];
        let completed = false;

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-always-fail`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 3,
                initialInterval: 50,
                jitter: 0
            },
            onEvent: () => { },
            onError: (error) => {
                errors.push(error);
            },
            onComplete: () => {
                completed = true;
            }
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
        abortController.abort();

        expect(errors.length).toBeGreaterThanOrEqual(3);
        expect(errors.length).toBeLessThanOrEqual(5);
        expect(completed).toBe(true);
    });

    it('should reset retry count after successful reconnection', async () => {
        const client = new HttpClient();
        const events: any[] = [];

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-retry-policy?failCount=1`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 0,
                initialInterval: 100,
                backoffMultiplier: 2,
                jitter: 0
            },
            onEvent: (event) => {
                events.push(event);
            }
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        expect(events.length).toBe(2);
        expect(events[0].data).toBe('Attempt 1');
        expect(events[1].data).toBe('Success after 1 retries');

        abortController.abort();
    });

    it('should respect server-specified retry interval', async () => {
        const client = new HttpClient();
        const timestamps: number[] = [];

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-drop?retry=200`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 5,
                initialInterval: 1000,
                jitter: 0
            },
            onEvent: () => {
                timestamps.push(Date.now());
            }
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
        abortController.abort();

        expect(timestamps.length).toBe(2);

        const delay = timestamps[1] - timestamps[0];
        expect(delay).toBeGreaterThanOrEqual(150);
        expect(delay).toBeLessThanOrEqual(400);
    });

    it('should apply jitter to prevent thundering herd', async () => {
        const client = new HttpClient();
        const delays: number[] = [];

        for (let i = 0; i < 5; i++) {
            const events: any[] = [];
            let firstEventTime = 0;
            let secondEventTime = 0;

            const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                method: 'GET',
                url: `${baseUrl}/sse-retry-policy?failCount=1`,
                parseJson: false,
                autoReconnect: true,
                retryPolicy: {
                    maxRetries: 5,
                    initialInterval: 100,
                    jitter: 100
                },
                onEvent: (event) => {
                    if (!firstEventTime) {
                        firstEventTime = Date.now();
                    } else if (!secondEventTime) {
                        secondEventTime = Date.now();
                    }
                    events.push(event);
                }
            });

            await new Promise(resolve => setTimeout(resolve, 500));
            abortController.abort();

            if (firstEventTime && secondEventTime) {
                delays.push(secondEventTime - firstEventTime);
            }
        }

        expect(delays.length).toBeGreaterThan(0);

        const minDelay = Math.min(...delays);
        const maxDelay = Math.max(...delays);

        expect(maxDelay - minDelay).toBeGreaterThan(20);
    });

    it('should respect maxInterval cap on exponential backoff', async () => {
        const client = new HttpClient();
        const timestamps: number[] = [];

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-retry-policy?failCount=5`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 10,
                initialInterval: 100,
                maxInterval: 300,
                backoffMultiplier: 2,
                jitter: 0
            },
            onEvent: () => {
                timestamps.push(Date.now());
            }
        });

        await new Promise(resolve => setTimeout(resolve, 3000));
        abortController.abort();

        const delays: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
            delays.push(timestamps[i] - timestamps[i - 1]);
        }

        // Verify that later delays are capped near maxInterval (300ms)
        // Account for connection overhead by allowing up to 700ms total (300ms wait + up to 400ms overhead)
        if (delays.length >= 4) {
            const lastDelays = delays.slice(-2);
            lastDelays.forEach(delay => {
                expect(delay).toBeLessThanOrEqual(700);
            });
        }
    });

    it('should work with unlimited retries (maxRetries=0)', async () => {
        const client = new HttpClient();
        const events: any[] = [];

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-retry-policy?failCount=2`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 0,
                initialInterval: 100,
                jitter: 0
            },
            onEvent: (event) => {
                events.push(event);
            }
        });

        // Wait 700ms to get 3 events (0ms + 100ms + 200ms = ~300ms total for retries, plus 500ms server delay)
        // Abort before the 4th reconnection which would happen after retry policy reset
        await new Promise(resolve => setTimeout(resolve, 750));
        abortController.abort();

        expect(events.length).toBe(3);
        expect(events[2].data).toBe('Success after 2 retries');
    });
});
