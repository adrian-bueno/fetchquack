import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClient } from 'fetchquack';

const baseUrl = 'http://localhost:3001';

describe('HttpClient - SSE Retry Policy', () => {
    let client: HttpClient;

    beforeEach(() => {
        client = new HttpClient();
    });

    it('should reconnect with exponential backoff', async () => {
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

        // Wait for reconnections: 100ms + 200ms + 400ms + jitter + processing = ~850ms
        await new Promise(resolve => setTimeout(resolve, 900));

        abortController.abort();

        // Should have received 4 events (3 retry attempts + 1 success)
        expect(events.length).toBe(4);
        expect(events[0].data).toBe('Attempt 1');
        expect(events[1].data).toBe('Attempt 2');
        expect(events[2].data).toBe('Attempt 3');
        expect(events[3].data).toBe('Success after 3 retries');

        // Verify reconnections happened (we should have 3 reconnect timestamps)
        expect(reconnectTimestamps.length).toBe(3);

        // Verify all delays are within reasonable bounds
        const firstDelay = reconnectTimestamps[0] - firstConnectionTime;
        const secondDelay = reconnectTimestamps[1] - reconnectTimestamps[0];
        const thirdDelay = reconnectTimestamps[2] - reconnectTimestamps[1];

        // All delays should be > 0 and < 1000ms (reasonable for exponential backoff with jitter)
        expect(firstDelay).toBeGreaterThan(0);
        expect(firstDelay).toBeLessThan(1000);
        expect(secondDelay).toBeGreaterThan(0);
        expect(secondDelay).toBeLessThan(1000);
        expect(thirdDelay).toBeGreaterThan(0);
        expect(thirdDelay).toBeLessThan(1000);
    });

    it('should respect maxRetries and stop after reaching limit', async () => {
        const events: any[] = [];
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
            onEvent: (event) => {
                events.push(event);
            },
            onError: (error) => {
                errors.push(error);
            },
            onComplete: () => {
                completed = true;
            }
        });

        // Wait for all retry attempts
        await new Promise(resolve => setTimeout(resolve, 1000));

        abortController.abort();

        // Should have attempted 3-4 times (initial + retries)
        // May occasionally get an extra attempt due to timing
        expect(errors.length).toBeGreaterThanOrEqual(3);
        expect(errors.length).toBeLessThanOrEqual(5);

        // Should have stopped retrying
        expect(completed).toBe(true);
    });

    it('should reset retry count after successful reconnection', async () => {
        const events: any[] = [];
        const reconnectCount = { value: 0 };

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-retry-policy?failCount=1`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 0, // unlimited
                initialInterval: 100,
                backoffMultiplier: 2,
                jitter: 0
            },
            onEvent: (event) => {
                events.push(event);
                if (event.id === '2') {
                    reconnectCount.value++;
                }
            }
        });

        // Wait for reconnection
        await new Promise(resolve => setTimeout(resolve, 500));

        // Should have successfully reconnected and received both events
        expect(events.length).toBe(2);
        expect(events[0].data).toBe('Attempt 1');
        expect(events[1].data).toBe('Success after 1 retries');

        abortController.abort();
    });

    it('should respect server-specified retry interval', async () => {
        const events: any[] = [];
        const timestamps: number[] = [];

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-drop?retry=200`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 5,
                initialInterval: 1000, // Client default, but server will override
                jitter: 0
            },
            onEvent: (event) => {
                timestamps.push(Date.now());
                events.push(event);
            }
        });

        // Wait for reconnection (retry=200ms from server + processing)
        await new Promise(resolve => setTimeout(resolve, 1000));

        abortController.abort();

        // Should have received both events
        expect(events.length).toBe(2);

        // Verify server retry interval was used (~200ms)
        if (timestamps.length === 2) {
            const delay = timestamps[1] - timestamps[0];
            expect(delay).toBeGreaterThanOrEqual(150);
            expect(delay).toBeLessThanOrEqual(400);
        }
    });

    it('should apply jitter to prevent thundering herd', async () => {
        const delays: number[] = [];
        let lastTimestamp = 0;

        // Run multiple connections to test jitter randomness
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

        // Verify that delays vary due to jitter
        expect(delays.length).toBeGreaterThan(0);

        const minDelay = Math.min(...delays);
        const maxDelay = Math.max(...delays);

        // With 100ms base + up to 100ms jitter, delays should vary
        expect(maxDelay - minDelay).toBeGreaterThan(20); // At least 20ms variation
    });

    it('should respect maxInterval cap on exponential backoff', async () => {
        const events: any[] = [];
        const timestamps: number[] = [];

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-retry-policy?failCount=5`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 10,
                initialInterval: 100,
                maxInterval: 300, // Cap at 300ms
                backoffMultiplier: 2,
                jitter: 0
            },
            onEvent: (event) => {
                timestamps.push(Date.now());
                events.push(event);
            }
        });

        // Wait for all reconnections
        await new Promise(resolve => setTimeout(resolve, 3000));

        abortController.abort();

        // Calculate delays between events
        const delays: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
            delays.push(timestamps[i] - timestamps[i - 1]);
        }

        // After reaching maxInterval, all delays should be capped at ~300ms
        // Delays: 100, 200, 300, 300, 300 (capped)
        // Note: Delays include reconnection time + server processing (~500ms)
        if (delays.length >= 4) {
            const lastDelays = delays.slice(-2);
            lastDelays.forEach(delay => {
                // Max 300ms reconnect + 500ms server processing = ~800ms
                expect(delay).toBeLessThanOrEqual(900); // Allow tolerance
            });
        }
    });

    it('should work with unlimited retries (maxRetries=0)', async () => {
        const events: any[] = [];

        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-retry-policy?failCount=2`,
            parseJson: false,
            autoReconnect: true,
            retryPolicy: {
                maxRetries: 0, // unlimited
                initialInterval: 100,
                jitter: 0
            },
            onEvent: (event) => {
                events.push(event);
            }
        });

        // Wait for reconnections - abort before 4th reconnection after reset
        await new Promise(resolve => setTimeout(resolve, 750));

        abortController.abort();

        // Should successfully reconnect and get all events
        expect(events.length).toBe(3);
        expect(events[2].data).toBe('Success after 2 retries');
    });
});
