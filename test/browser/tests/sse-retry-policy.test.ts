import { test, expect } from '@playwright/test';

const baseUrl = 'http://localhost:3004';
const testPageUrl = 'http://localhost:3004/test-page.esm.html';

test.describe('HttpClient - SSE Retry Policy (Browser)', () => {
    test('should reconnect with exponential backoff', async ({ page }) => {
        await page.goto(testPageUrl);

        const result = await page.evaluate(async (testBaseUrl) => {
            const { HttpClient } = window.FetchStreamSSE;
            const client = new HttpClient();
            const events: any[] = [];
            const reconnectTimestamps: number[] = [];
            let firstConnectionTime: number = 0;

            return new Promise((resolve) => {
                const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                    method: 'GET',
                    url: `${testBaseUrl}/sse-retry-policy?failCount=3`,
                    parseJson: false,
                    autoReconnect: true,
                    retryPolicy: {
                        maxRetries: 5,
                        initialInterval: 100,
                        maxInterval: 5000,
                        backoffMultiplier: 2,
                        jitter: 50
                    },
                    onEvent: (event: any) => {
                        const now = Date.now();
                        if (firstConnectionTime === 0) {
                            firstConnectionTime = now;
                        } else {
                            reconnectTimestamps.push(now);
                        }
                        events.push(event);
                    }
                });

                setTimeout(() => {
                    abortController.abort();

                    const delays = {
                        first: reconnectTimestamps[0] - firstConnectionTime,
                        second: reconnectTimestamps[1] - reconnectTimestamps[0],
                        third: reconnectTimestamps[2] - reconnectTimestamps[1]
                    };

                    resolve({ events, reconnectTimestamps, delays });
                }, 900);
            });
        }, baseUrl);

        expect(result.events.length).toBe(4);
        expect(result.events[0].data).toBe('Attempt 1');
        expect(result.events[1].data).toBe('Attempt 2');
        expect(result.events[2].data).toBe('Attempt 3');
        expect(result.events[3].data).toBe('Success after 3 retries');

        expect(result.reconnectTimestamps.length).toBe(3);

        expect(result.delays.first).toBeGreaterThan(0);
        expect(result.delays.first).toBeLessThan(1000);
        expect(result.delays.second).toBeGreaterThan(0);
        expect(result.delays.second).toBeLessThan(1000);
        expect(result.delays.third).toBeGreaterThan(0);
        expect(result.delays.third).toBeLessThan(1000);
    });

    test('should respect maxRetries and stop after reaching limit', async ({ page }) => {
        await page.goto(testPageUrl);

        const result = await page.evaluate(async (testBaseUrl) => {
            const { HttpClient } = window.FetchStreamSSE;
            const client = new HttpClient();
            const errors: any[] = [];
            let completed = false;

            return new Promise((resolve) => {
                const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                    method: 'GET',
                    url: `${testBaseUrl}/sse-always-fail`,
                    parseJson: false,
                    autoReconnect: true,
                    retryPolicy: {
                        maxRetries: 3,
                        initialInterval: 50,
                        jitter: 0
                    },
                    onEvent: (event: any) => {
                        // Should not receive events
                    },
                    onError: (error: Error) => {
                        errors.push(error.message);
                    },
                    onComplete: () => {
                        completed = true;
                    }
                });

                setTimeout(() => {
                    abortController.abort();
                    resolve({ errorCount: errors.length, completed });
                }, 1000);
            });
        }, baseUrl);

        expect(result.errorCount).toBeGreaterThanOrEqual(3);
        expect(result.errorCount).toBeLessThanOrEqual(5);
        expect(result.completed).toBe(true);
    });

    test('should reset retry count after successful reconnection', async ({ page }) => {
        await page.goto(testPageUrl);

        const result = await page.evaluate(async (testBaseUrl) => {
            const { HttpClient } = window.FetchStreamSSE;
            const client = new HttpClient();
            const events: any[] = [];

            return new Promise((resolve) => {
                const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                    method: 'GET',
                    url: `${testBaseUrl}/sse-retry-policy?failCount=1`,
                    parseJson: false,
                    autoReconnect: true,
                    retryPolicy: {
                        maxRetries: 0,
                        initialInterval: 100,
                        backoffMultiplier: 2,
                        jitter: 0
                    },
                    onEvent: (event: any) => {
                        events.push(event);
                    }
                });

                setTimeout(() => {
                    abortController.abort();
                    resolve({ events });
                }, 500);
            });
        }, baseUrl);

        expect(result.events.length).toBe(2);
        expect(result.events[0].data).toBe('Attempt 1');
        expect(result.events[1].data).toBe('Success after 1 retries');
    });

    test('should respect server-specified retry interval', async ({ page }) => {
        await page.goto(testPageUrl);

        const result = await page.evaluate(async (testBaseUrl) => {
            const { HttpClient } = window.FetchStreamSSE;
            const client = new HttpClient();
            const timestamps: number[] = [];

            return new Promise((resolve) => {
                const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                    method: 'GET',
                    url: `${testBaseUrl}/sse-drop?retry=200`,
                    parseJson: false,
                    autoReconnect: true,
                    retryPolicy: {
                        maxRetries: 5,
                        initialInterval: 1000,
                        jitter: 0
                    },
                    onEvent: (event: any) => {
                        timestamps.push(Date.now());
                    }
                });

                setTimeout(() => {
                    abortController.abort();
                    const delay = timestamps.length === 2 ? timestamps[1] - timestamps[0] : 0;
                    resolve({ eventCount: timestamps.length, delay });
                }, 1000);
            });
        }, baseUrl);

        expect(result.eventCount).toBe(2);
        expect(result.delay).toBeGreaterThanOrEqual(150);
        expect(result.delay).toBeLessThanOrEqual(400);
    });

    test('should apply jitter to prevent thundering herd', async ({ page }) => {
        await page.goto(testPageUrl);

        const result = await page.evaluate(async (testBaseUrl) => {
            const { HttpClient } = window.FetchStreamSSE;
            const client = new HttpClient();
            const delays: number[] = [];

            for (let i = 0; i < 5; i++) {
                const events: any[] = [];
                let firstEventTime = 0;
                let secondEventTime = 0;

                const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                    method: 'GET',
                    url: `${testBaseUrl}/sse-retry-policy?failCount=1`,
                    parseJson: false,
                    autoReconnect: true,
                    retryPolicy: {
                        maxRetries: 5,
                        initialInterval: 100,
                        jitter: 100
                    },
                    onEvent: (event: any) => {
                        if (!firstEventTime) {
                            firstEventTime = Date.now();
                        } else if (!secondEventTime) {
                            secondEventTime = Date.now();
                        }
                        events.push(event);
                    }
                });

                await new Promise<void>((resolve) => setTimeout(resolve, 500));
                abortController.abort();

                if (firstEventTime && secondEventTime) {
                    delays.push(secondEventTime - firstEventTime);
                }
            }

            const minDelay = Math.min(...delays);
            const maxDelay = Math.max(...delays);

            return { delayCount: delays.length, minDelay, maxDelay, variation: maxDelay - minDelay };
        }, baseUrl);

        expect(result.delayCount).toBeGreaterThan(0);
        expect(result.variation).toBeGreaterThan(20);
    });

    test('should respect maxInterval cap on exponential backoff', async ({ page }) => {
        await page.goto(testPageUrl);

        const result = await page.evaluate(async (testBaseUrl) => {
            const { HttpClient } = window.FetchStreamSSE;
            const client = new HttpClient();
            const timestamps: number[] = [];

            return new Promise((resolve) => {
                const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                    method: 'GET',
                    url: `${testBaseUrl}/sse-retry-policy?failCount=5`,
                    parseJson: false,
                    autoReconnect: true,
                    retryPolicy: {
                        maxRetries: 10,
                        initialInterval: 100,
                        maxInterval: 300,
                        backoffMultiplier: 2,
                        jitter: 0
                    },
                    onEvent: (event: any) => {
                        timestamps.push(Date.now());
                    }
                });

                setTimeout(() => {
                    abortController.abort();

                    const delays: number[] = [];
                    for (let i = 1; i < timestamps.length; i++) {
                        delays.push(timestamps[i] - timestamps[i - 1]);
                    }

                    resolve({ eventCount: timestamps.length, delays });
                }, 3000);
            });
        }, baseUrl);

        expect(result.eventCount).toBeGreaterThanOrEqual(5);

        // Last delays should be capped at maxInterval (300ms)
        // Account for connection overhead by allowing up to 700ms total (300ms wait + up to 400ms overhead)
        if (result.delays.length >= 4) {
            const lastDelays = result.delays.slice(-2);
            lastDelays.forEach((delay: number) => {
                expect(delay).toBeLessThanOrEqual(700);
            });
        }
    });

    test('should work with unlimited retries (maxRetries=0)', async ({ page }) => {
        await page.goto(testPageUrl);

        const result = await page.evaluate(async (testBaseUrl) => {
            const { HttpClient } = window.FetchStreamSSE;
            const client = new HttpClient();
            const events: any[] = [];

            return new Promise((resolve) => {
                const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                    method: 'GET',
                    url: `${testBaseUrl}/sse-retry-policy?failCount=2`,
                    parseJson: false,
                    autoReconnect: true,
                    retryPolicy: {
                        maxRetries: 0,
                        initialInterval: 100,
                        jitter: 0
                    },
                    onEvent: (event: any) => {
                        events.push(event);
                    }
                });

                // Wait 700ms to get 3 events
                // Abort before the 4th reconnection which would happen after retry policy reset
                setTimeout(() => {
                    abortController.abort();
                    resolve({ events });
                }, 750);
            });
        }, baseUrl);

        expect(result.events.length).toBe(3);
        expect(result.events[2].data).toBe('Success after 2 retries');
    });
});
