
import { describe, it, expect } from 'vitest';
import { HttpClient } from 'fetchquack';

// Mock server should be running on port 3001
const baseUrl = 'http://localhost:3001';

describe('HttpClient - SSE Reconnection (Reproduction)', () => {
    it('should reconnect when server closes connection', async () => {
        const client = new HttpClient();
        const events: any[] = [];
        let completed = false;
        let errorOccurred = false;

        // The /sse-drop endpoint sends one event (id:1), closes,
        // and expects reconnection with Last-Event-ID: 1 to send event 2
        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-drop?retry=50`,
            parseJson: false,
            autoReconnect: true,
            onEvent: (event) => {
                events.push(event);
            },
            onError: (err) => {
                console.log('SSE Error:', err);
                errorOccurred = true;
            },
            onComplete: () => {
                console.log('SSE Completed');
                completed = true;
            }
        });

        // Wait for initial event, disconnection, retry delay, and reconnection
        await new Promise(resolve => setTimeout(resolve, 1500));

        abortController.abort();

        // Expect to have received both events
        expect(events.length).toBe(2);
        expect(events[0].data).toBe('First');
        expect(events[0].id).toBe('1');

        expect(events[1]).toBeDefined();
        expect(events[1].data).toBe('Second');
        expect(events[1].id).toBe('2');
    });

    it('should NOT reconnect by default (autoReconnect=false)', async () => {
        const client = new HttpClient();
        const events: any[] = [];

        // The /sse-drop endpoint sends one event, closes.
        const abortController = new AbortController(); client.sse({ signal: abortController.signal,
            method: 'GET',
            url: `${baseUrl}/sse-drop?retry=50`,
            parseJson: false,
            // autoReconnect defaults to false
            onEvent: (event) => {
                events.push(event);
            }
        });

        // Wait for initial event, disconnection, and potential retry
        await new Promise(resolve => setTimeout(resolve, 1500));

        abortController.abort();

        // Expect to have received ONLY the first event
        expect(events.length).toBe(1);
        expect(events[0].data).toBe('First');
    });
});
