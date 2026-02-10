import { describe, it, expect } from 'vitest';
import { HttpClient } from 'fetchquack';

// Shared mock server is running on port 3001 (managed by run-tests.ts)
const baseUrl = 'http://localhost:3001';

describe('HttpClient - GenAI API Compatibility', () => {
    it('should handle OpenAI-style streaming responses', async () => {
        const client = new HttpClient();
        const chunks: string[] = [];
        let doneReceived = false;

        // OpenAI stream sends JSON chunks and ends with data: [DONE]
        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'POST',
            url: `${baseUrl}/openai-stream?content=Hello world from AI`,
            parseJson: true, // We want to parse the JSON chunks
            onEvent: (event) => {
                // OpenAI sends [DONE] as a data field, not valid JSON
                // My parser tries to parse JSON, if it fails, it returns the string
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

        expect(doneReceived).toBe(true);
        expect(chunks.length).toBeGreaterThan(0);

        const fullText = chunks.join('');
        expect(fullText).toContain('Hello world from AI');
    });
});
