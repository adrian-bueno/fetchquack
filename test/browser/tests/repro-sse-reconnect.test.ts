import { test, expect } from '@playwright/test';

const baseUrl = 'http://localhost:3004';
const testPageUrl = 'http://localhost:3004/test-page.esm.html';

test.describe('HttpClient - SSE Reconnection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(testPageUrl);
        await page.waitForFunction(() => (window as any).testReady === true, { timeout: 10000 });
    });

    test('should reconnect when server closes connection', async ({ page }) => {
        const result = await page.evaluate(async (url) => {
            const client = new (window as any).FetchStreamSSE.HttpClient();
            const events: any[] = [];

            const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                method: 'GET',
                url: `${url}/sse-drop?retry=50`,
                parseJson: false,
                autoReconnect: true,
                onEvent: (event: any) => {
                    events.push(event);
                },
                onError: (err: any) => {
                    console.log('SSE Error:', err);
                }
            });

            // Wait for initial event, disconnection, retry delay, and reconnection
            await new Promise(resolve => setTimeout(resolve, 1500));

            abortController.abort();

            return events;
        }, baseUrl);

        expect(result.length).toBe(2);
        expect(result[0].data).toBe('First');
        expect(result[0].id).toBe('1');

        // This part fails if reconnection is not implemented
        expect(result[1]).toBeDefined();
        expect(result[1].data).toBe('Second');
        expect(result[1].id).toBe('2');
    });

    test('should NOT reconnect by default (autoReconnect=false)', async ({ page }) => {
        const result = await page.evaluate(async (url) => {
            const client = new (window as any).FetchStreamSSE.HttpClient();
            const events: any[] = [];

            const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                method: 'GET',
                url: `${url}/sse-drop?retry=50`,
                parseJson: false,
                // autoReconnect defaults to false
                onEvent: (event: any) => {
                    events.push(event);
                }
            });

            await new Promise(resolve => setTimeout(resolve, 1500));

            abortController.abort();

            return events;
        }, baseUrl);

        expect(result.length).toBe(1);
        expect(result[0].data).toBe('First');
    });
});
