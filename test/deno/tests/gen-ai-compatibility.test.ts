import { assertEquals, assert } from "@std/assert";
import { HttpClient } from 'fetchquack';

// Mock server should be running on port 3002
const baseUrl = 'http://localhost:3002';

Deno.test("HttpClient - GenAI API Compatibility", async () => {
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
            // In Deno, parsed JSON object keys are standard
            if (typeof event.data === 'object' && event.data.choices && event.data.choices[0].delta.content) {
                chunks.push(event.data.choices[0].delta.content);
            }
        },
        onError: (err) => {
            console.error("SSE Error:", err);
        }
    });

    // Wait for stream to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    abortController.abort();

    assertEquals(doneReceived, true, "Should have received [DONE] message");
    assert(chunks.length > 0, "Should have received chunks");

    const fullText = chunks.join('');
    assert(fullText.includes('Hello world from AI'), `Expected "${fullText}" to include "Hello world from AI"`);
});
