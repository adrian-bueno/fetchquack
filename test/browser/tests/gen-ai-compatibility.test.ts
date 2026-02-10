import { test, expect } from '@playwright/test';

const baseUrl = 'http://localhost:3004';
const testPageUrl = 'http://localhost:3004/test-page.esm.html';

test.describe('HttpClient - GenAI API Compatibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(testPageUrl);
        await page.waitForFunction(() => (window as any).testReady === true, { timeout: 10000 });
    });

    test('should handle OpenAI-style streaming responses', async ({ page }) => {
        const result = await page.evaluate(async (url) => {
            const client = new (window as any).FetchStreamSSE.HttpClient();
            const chunks: string[] = [];
            let doneReceived = false;

            const abortController = new AbortController(); client.sse({ signal: abortController.signal,
                method: 'POST',
                url: `${url}/openai-stream?content=Hello world from AI`,
                parseJson: true,
                onEvent: (event: any) => {
                    // OpenAI sends [DONE] as a data field, not valid JSON
                    if (typeof event.data === 'string' && event.data.trim() === '[DONE]') {
                        doneReceived = true;
                        return;
                    }

                    // Normal chunks are valid JSON
                    if (typeof event.data === 'object' && event.data.choices && event.data.choices[0].delta.content) {
                        chunks.push(event.data.choices[0].delta.content);
                    }
                }
            });

            // Wait for stream to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            abortController.abort();

            return { doneReceived, chunks, fullText: chunks.join('') };
        }, baseUrl);

        expect(result.doneReceived).toBe(true);
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.fullText).toContain('Hello world from AI');
    });
});
