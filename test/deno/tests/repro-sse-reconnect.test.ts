import { assertEquals, assert } from "@std/assert";
import { HttpClient } from 'fetchquack';

// Mock server should be running on port 3002
const baseUrl = 'http://localhost:3002';

Deno.test("HttpClient - SSE Reconnection", async () => {
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
    assertEquals(events.length, 2);
    assertEquals(events[0].data, 'First');
    assertEquals(events[0].id, '1');

    // This part fails if reconnection is not implemented
    assert(events[1] !== undefined, "Expected second event");
    assertEquals(events[1].data, 'Second');
    assertEquals(events[1].id, '2');
});

Deno.test("HttpClient - SSE Reconnection (Default autoReconnect=false)", async () => {
    const client = new HttpClient();
    const events: any[] = [];

    const abortController = new AbortController(); client.sse({ signal: abortController.signal,
        method: 'GET',
        url: `${baseUrl}/sse-drop?retry=50`,
        parseJson: false,
        // autoReconnect defaults to false
        onEvent: (event) => {
            events.push(event);
        },
        onError: (err) => {
            // Ignore expectation of error vs close
        }
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    abortController.abort();

    assertEquals(events.length, 1);
    assertEquals(events[0].data, 'First');
});
