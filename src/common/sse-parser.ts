import { SseEvent } from './types';

/** Pre-compiled regex for line splitting (performance optimization) @internal */
const LINE_BREAK_REGEX = /\r\n|\r|\n/;

/**
 * Configuration for SSE parser behavior.
 */
export interface SseParserOptions {
    /** Parse event data as JSON. @default false */
    parseJson?: boolean;

    /**
     * Strip optional leading space from field values.
     * SSE spec allows "data: value" or "data:value".
     * @default true
     */
    stripOptionalSpace?: boolean;
}

/**
 * Streaming SSE parser implementing the W3C Server-Sent Events specification.
 *
 * Parses raw SSE stream data into structured event objects.
 * Handles all SSE protocol features:
 * - Multi-line data fields (concatenated with newlines)
 * - Event types (event:)
 * - Event IDs (id:) for Last-Event-ID tracking
 * - Retry intervals (retry:) for reconnection
 * - BOM handling at stream start
 * - Comment lines (ignored)
 * - Robust CRLF/LF/CR line ending handling
 *
 * @typeParam T - Type of parsed event data (string by default, custom if parseJson=true)
 *
 * @example
 * ```typescript
 * // Basic usage
 * const parser = new SseParser<{ message: string }>({ parseJson: true });
 * parser.onEvent = (event) => {
 *   console.log(`Event: ${event.event}, Data:`, event.data);
 * };
 *
 * // Feed data as it arrives from stream
 * parser.feedBytes(chunk1);
 * parser.feedBytes(chunk2);
 *
 * // Call finish() when stream ends to emit any pending event
 * parser.finish();
 * ```
 *
 * @example
 * ```typescript
 * // Manual text feeding
 * const parser = new SseParser();
 * parser.onEvent = console.log;
 * parser.feedText('event: update\ndata: hello\n\n');
 * // Emits: { event: 'update', data: 'hello' }
 * ```
 */
export class SseParser<T = any> {
    private readonly parseJson: boolean;
    private readonly stripOptionalSpace: boolean;
    private readonly decoder = new TextDecoder();

    /** Incomplete line buffer (data between line endings) */
    private buffer = '';
    /** Current event being built from parsed fields */
    private eventBuffer: Partial<SseEvent<any>> = {};
    /** Flag for BOM handling on first chunk */
    private isFirstChunk = true;

    /** Callback invoked when a complete event is parsed */
    public onEvent?: (event: SseEvent<T>) => void;

    constructor(options: SseParserOptions = {}) {
        this.parseJson = options.parseJson ?? false;
        this.stripOptionalSpace = options.stripOptionalSpace ?? true;
    }

    /**
     * Feed raw bytes from stream to parser.
     * Decodes UTF-8 and processes text.
     */
    public feedBytes(chunk: Uint8Array): void {
        const text = this.decoder.decode(chunk, { stream: true });
        this.feedText(text);
    }

    /**
     * Feed decoded text to parser.
     * Can be called multiple times with partial data.
     */
    public feedText(text: string): void {
        let chunkText = text;

        // SSE spec: ignore BOM (U+FEFF) at stream start
        if (this.isFirstChunk) {
            if (chunkText.charCodeAt(0) === 0xFEFF) {
                chunkText = chunkText.slice(1);
            }
            this.isFirstChunk = false;
        }

        this.buffer += chunkText;
        this.processBuffer();
    }

    /**
     * Finish parsing and emit any pending event.
     * Call when stream ends to process remaining buffer.
     */
    public finish(): void {
        // Process any remaining incomplete line
        if (this.buffer.length > 0) {
            this.processLine(this.buffer);
            this.buffer = '';
        }

        // Emit pending event not followed by empty line
        this.emitEventIfPending();
    }

    /**
     * Reset parser state for reuse.
     */
    public reset(): void {
        this.buffer = '';
        this.eventBuffer = {};
        this.isFirstChunk = true;
    }

    /**
     * Process buffer and extract complete lines.
     * @internal
     */
    private processBuffer(): void {
        // Handle potential CRLF split across chunks
        let processingBuffer = this.buffer;
        let keepTrailingCR = false;

        if (this.buffer.endsWith('\r')) {
            // Keep trailing \r to check if next chunk starts with \n
            keepTrailingCR = true;
            processingBuffer = this.buffer.slice(0, -1);
        }

        const lines = processingBuffer.split(LINE_BREAK_REGEX);

        // Keep incomplete last line in buffer
        const incompleteLine = lines.pop() || '';
        this.buffer = keepTrailingCR ? incompleteLine + '\r' : incompleteLine;

        // Process all complete lines
        for (const line of lines) {
            this.processLine(line);
        }
    }

    /**
     * Process single line per SSE specification.
     * @internal
     */
    private processLine(line: string): void {
        // Empty line: dispatch accumulated event
        if (line === '') {
            this.emitEventIfPending();
            return;
        }

        // Comment line (starts with :): ignore
        if (line.startsWith(':')) {
            return;
        }

        // Parse field:value or field-only format
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            const field = line.slice(0, colonIndex);
            const value = line.slice(colonIndex + 1);
            this.processField(field, value);
        } else {
            // No colon: entire line is field name with empty value
            this.processField(line, '');
        }
    }

    /**
     * Process field:value according to SSE spec.
     * @internal
     */
    private processField(field: string, value: string): void {
        let processedValue = value;

        // SSE spec: if value starts with space, remove it (optional space after colon)
        if (this.stripOptionalSpace && processedValue.startsWith(' ')) {
            processedValue = processedValue.slice(1);
        }

        switch (field) {
            case 'event':
                this.eventBuffer.event = processedValue;
                break;

            case 'data':
                // Multiple data fields are concatenated with newlines
                this.eventBuffer.data = (this.eventBuffer.data || '') + processedValue + '\n';
                break;

            case 'id':
                // SSE spec: ignore if contains null character
                if (processedValue.indexOf('\0') === -1) {
                    this.eventBuffer.id = processedValue;
                }
                break;

            case 'retry':
                // SSE spec: only set if value is all ASCII digits
                const ms = parseInt(processedValue, 10);
                if (!isNaN(ms) && /^\d+$/.test(processedValue)) {
                    this.eventBuffer.retry = ms;
                }
                break;

            default:
                // Unknown field: ignore per SSE spec
                break;
        }
    }

    /**
     * Emit current event if any fields were set.
     * @internal
     */
    private emitEventIfPending(): void {
        // Only emit if at least one field was set
        if (
            this.eventBuffer.data === undefined &&
            !this.eventBuffer.id &&
            !this.eventBuffer.event &&
            this.eventBuffer.retry === undefined
        ) {
            return;
        }

        // SSE spec: remove trailing newline from data
        if (this.eventBuffer.data && this.eventBuffer.data.endsWith('\n')) {
            this.eventBuffer.data = this.eventBuffer.data.slice(0, -1);
        }

        // Parse JSON if configured
        let finalData: T | string | undefined = this.eventBuffer.data;
        if (this.parseJson && typeof finalData === 'string') {
            try {
                finalData = JSON.parse(finalData);
            } catch {
                // Keep as string if JSON parsing fails (intentional design)
            }
        }

        // Emit event via callback
        this.onEvent?.({
            id: this.eventBuffer.id,
            event: this.eventBuffer.event,
            data: finalData,
            retry: this.eventBuffer.retry,
        } as SseEvent<T>);

        // Clear buffer for next event
        this.eventBuffer = {};
    }
}
