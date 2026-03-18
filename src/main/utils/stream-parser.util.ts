import { appLogger } from '@main/logging/logger';
import { ToolCall } from '@shared/types/chat';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export interface StreamChunk {
    index?: number;
    content?: string;
    reasoning?: string;
    images?: Array<string | { image_url: { url: string } }>;
    type?: string;
    tool_calls?: ToolCall[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

type OpenAIStreamDelta = {
    content?: string;
    reasoning_content?: string;
    reasoning?: string;
    images?: Array<string | { image_url: { url: string } }>;
    tool_calls?: ToolCall[];
};

type OpenAIStreamPayload = {
    choices?: Array<{ delta?: OpenAIStreamDelta; index?: number }>;
};

export class StreamParser {
    /**
     * Parses a chat stream response (SSE) and yields structured chunks.
     * Supports both Web Streams (ReadableStream) and Node.js Streams (AsyncIterable).
     */
    static async *parseChatStream(input: Response | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>): AsyncGenerator<StreamChunk> {
        const body = this.getStreamBody(input);
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            appLogger.info('stream-parser.util', `[StreamParser] Starting parse. Input type: ${input.constructor.name}`);
            if (this.isWebStream(body)) {
                yield* this.parseWebStream(body, decoder, (b) => { buffer = b; }, () => buffer);
            } else {
                yield* this.parseNodeStream(body, decoder, (b) => { buffer = b; }, () => buffer);
            }
        } catch (error) {
            appLogger.error('StreamParser', 'Parse error', error as Error);
            throw error;
        }
    }

    private static getStreamBody(input: RuntimeValue): ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> {
        if (input && typeof input === 'object' && 'body' in input) {
            const body = (input as { body?: RuntimeValue }).body;
            if (body) { return body as ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>; }
        }
        return input as ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;
    }

    private static isWebStream(body: RuntimeValue): body is ReadableStream<Uint8Array> {
        if (!body || typeof body !== 'object') { return false; }
        const maybeWeb = body as { getReader?: RuntimeValue };
        return typeof maybeWeb.getReader === 'function';
    }

    private static async *parseWebStream(body: ReadableStream<Uint8Array>, decoder: TextDecoder, setBuf: (b: string) => void, getBuf: () => string) {
        const reader = body.getReader();
        const MAX_ITERATIONS = 1_000_000;
        let iterationCount = 0;
        try {
            while (iterationCount < MAX_ITERATIONS) {
                const { done, value } = await reader.read();
                if (done) { break; }
                const newContent = decoder.decode(value, { stream: true });
                setBuf(getBuf() + newContent);
                yield* this.processBuffer(getBuf(), setBuf);
                iterationCount++;
            }
        } finally {
            reader.releaseLock();
        }
    }

    private static async *parseNodeStream(body: AsyncIterable<Uint8Array>, decoder: TextDecoder, setBuf: (b: string) => void, getBuf: () => string) {
        appLogger.info('stream-parser.util', '[StreamParser] Using AsyncIterable iteration');
        for await (const value of body) {
            const newContent = decoder.decode(value, { stream: true });
            setBuf(getBuf() + newContent);
            yield* this.processBuffer(getBuf(), setBuf);
        }
    }

    private static *processBuffer(buffer: string, updateBuffer: (b: string) => void): Generator<StreamChunk> {
        const lines = buffer.split('\n');
        const lastLine = lines.pop();
        appLogger.info('stream-parser.util', `[StreamParser] Processing buffer, lines: ${lines.length}, remaining: ${lastLine?.length ?? 0}`);
        updateBuffer(lastLine ?? '');

        for (const line of lines) {
            const data = this.extractDataPayload(line);
            if (!data) { continue; }
            if (data === '[DONE]') {
                appLogger.info('stream-parser.util', '[StreamParser] Received [DONE] signal');
                continue;
            }

            try {
                const json = safeJsonParse<StreamPayload>(data, { choices: [] });
                yield* this.handlePayload(json);
            } catch (error) {
                appLogger.error('stream-parser.util', `[StreamParser] Error parsing JSON: ${getErrorMessage(error)}, data: ${data.slice(0, 50)}...`);
            }
        }
    }

    private static extractDataPayload(line: string): string | null {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) { return null; }

        let jsonData = trimmed.slice(5).trim();
        while (jsonData.startsWith('data:')) {
            jsonData = jsonData.slice(5).trim();
        }
        return jsonData;
    }

    private static *handlePayload(json: StreamPayload): Generator<StreamChunk> {
        // 1. OPENCODE /responses format
        if (json.type?.startsWith('response.')) {
            yield* this.handleOpenCodePayload(json);
            return;
        }

        if (json.type === 'error' && json.message) {
            throw new Error(json.message);
        }

        // 2. STANDARD OpenAI format
        yield* this.handleOpenAIPayload(json);
    }

    private static *handleOpenCodePayload(json: StreamPayload): Generator<StreamChunk> {
        const type = json.type;
        appLogger.info('stream-parser.util', `[StreamParser] OpenCode Event: ${type}`);

        if (this.isOpenCodeDoneEvent(json)) {
            const contentItems = json.item?.content;
            if (contentItems) {
                yield* this.handleOpenCodeDone(contentItems);
            }
            return;
        }

        if (!type || !json.delta) { return; }

        yield* this.dispatchOpenCodeDelta(json);
    }

    private static isOpenCodeDoneEvent(json: StreamPayload): boolean {
        return json.type === 'response.output_item.done' && !!json.item?.content;
    }

    private static *dispatchOpenCodeDelta(json: StreamPayload): Generator<StreamChunk> {
        if (json.type === 'response.output_text.delta' && json.delta) {
            yield* this.handleOpenCodeText(json.delta);
        } else if (json.type === 'response.reasoning_summary_text.delta' && json.delta) {
            yield* this.handleOpenCodeReasoning(json.delta);
        } else if (json.type === 'response.function_call_arguments.delta') {
            yield this.createOpenCodeToolCall(json);
        }
    }

    private static *handleOpenCodeText(delta: string | { text?: string }) {
        const content = typeof delta === 'string' ? delta : delta.text;
        if (content) { yield { content }; }
    }

    private static *handleOpenCodeReasoning(delta: string | { text?: string }) {
        const reasoning = typeof delta === 'string' ? delta : delta.text;
        if (reasoning) { yield { reasoning }; }
    }

    private static *handleOpenCodeDone(contentItems: StreamItemContent[]) {
        const text = contentItems
            .filter((c) => c.type === 'output_text')
            .map((c) => c.text ?? '')
            .join('');
        if (text) { yield { content: text }; }
    }

    private static createOpenCodeToolCall(json: StreamPayload): StreamChunk {
        const args = typeof json.delta === 'string' ? json.delta : JSON.stringify(json.delta);
        return {
            type: 'tool_calls',
            tool_calls: [{
                id: 'opencode-tc-' + (json.response_id ?? 'unknown'),
                type: 'function',
                function: {
                    name: json.name ?? 'unknown',
                    arguments: args
                }
            }]
        };
    }

    private static *handleOpenAIPayload(json: StreamPayload): Generator<StreamChunk> {
        const choices = json.choices ?? [];
        if (json.usage && choices.length === 0) {
            yield { index: 0, content: '', usage: json.usage };
            return;
        }

        for (const choice of choices) {
            const delta = choice.delta;
            if (!delta) { continue; }

            const chunk = this.extractOpenAIChunk(choice.index ?? 0, delta, json.usage);
            if (chunk) { yield chunk; }
        }
    }

    private static extractOpenAIChunk(choiceIdx: number, delta: OpenAIStreamDelta, usage: StreamPayload['usage']): StreamChunk | null {
        const content = delta.content ?? '';
        const reasoning = delta.reasoning_content ?? delta.reasoning ?? '';

        if (content) { return this.createOpenAIChunk(choiceIdx, content, reasoning, delta, usage); }
        if (reasoning) { return this.createOpenAIChunk(choiceIdx, content, reasoning, delta, usage); }
        if ((delta.images && delta.images.length > 0) || delta.tool_calls || usage) {
            return this.createOpenAIChunk(choiceIdx, content, reasoning, delta, usage);
        }

        return null;
    }

    private static createOpenAIChunk(idx: number, content: string, reasoning: string, delta: OpenAIStreamDelta, usage: StreamPayload['usage']): StreamChunk {
        return {
            index: idx,
            content,
            reasoning,
            images: Array.isArray(delta.images) ? delta.images : [],
            type: delta.tool_calls ? 'tool_calls' : undefined,
            tool_calls: delta.tool_calls,
            usage
        };
    }
}

type StreamItemContent = {
    type: string;
    text?: string;
};

type StreamPayload = OpenAIStreamPayload & {
    type?: string;
    delta?: string | { text?: string };
    message?: string;
    item?: {
        content?: StreamItemContent[];
    };
    response_id?: string;
    name?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
};
