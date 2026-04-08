import { appLogger } from '@main/logging/logger';
import { XmlToolParser } from '@main/utils/xml-tool-parser.util';
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
    finish_reason?: string | null;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

type OpenCodeToolCallState = {
    id: string;
    name: string;
    arguments: string;
};

type OpenCodeStreamState = {
    toolCalls: Map<string, OpenCodeToolCallState>;
};

type XmlParserState = {
    buffer: string;
    lastUpdateTime: number;
};

type OpenAIStreamDelta = {
    content?: string;
    reasoning_content?: string;
    reasoning?: string;
    images?: Array<string | { image_url: { url: string } }>;
    tool_calls?: ToolCall[];
};

type OpenAIStreamPayload = {
    choices?: Array<{ 
        delta?: OpenAIStreamDelta; 
        index?: number;
        finish_reason?: string | null;
    }>;
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
        const openCodeState = this.createOpenCodeStreamState();
        const xmlState: XmlParserState = { buffer: '', lastUpdateTime: Date.now() };

        try {
            appLogger.debug('stream-parser.util', `[StreamParser] Starting parse. Input type: ${input.constructor.name}`);
            const parseOptions = {
                decoder,
                setBuf: (b: string) => { buffer = b; },
                getBuf: () => buffer,
                openCodeState,
                xmlState,
            };

            if (this.isWebStream(body)) {
                yield* this.parseWebStream(body, parseOptions);
            } else {
                yield* this.parseNodeStream(body, parseOptions);
            }
        } catch (error) {
            appLogger.error('StreamParser', 'Parse error', error as Error);
            throw error;
        }
    }

    private static createOpenCodeStreamState(): OpenCodeStreamState {
        return {
            toolCalls: new Map<string, OpenCodeToolCallState>(),
        };
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

    private static async *parseWebStream(
        body: ReadableStream<Uint8Array>,
        options: {
            decoder: TextDecoder;
            setBuf: (b: string) => void;
            getBuf: () => string;
            openCodeState: OpenCodeStreamState;
            xmlState: XmlParserState;
        }
    ) {
        const { decoder, setBuf, getBuf, openCodeState, xmlState } = options;
        const reader = body.getReader();
        const MAX_ITERATIONS = 1_000_000;
        let iterationCount = 0;
        try {
            while (iterationCount < MAX_ITERATIONS) {
                const { done, value } = await reader.read();
                if (done) { break; }
                const newContent = decoder.decode(value, { stream: true });
                setBuf(getBuf() + newContent);
                yield* this.processBuffer(getBuf(), setBuf, openCodeState, xmlState);
                iterationCount++;
            }
        } finally {
            reader.releaseLock();
        }
    }

    private static async *parseNodeStream(
        body: AsyncIterable<Uint8Array>,
        options: {
            decoder: TextDecoder;
            setBuf: (b: string) => void;
            getBuf: () => string;
            openCodeState: OpenCodeStreamState;
            xmlState: XmlParserState;
        }
    ) {
        const { decoder, setBuf, getBuf, openCodeState, xmlState } = options;
        appLogger.debug('stream-parser.util', '[StreamParser] Using AsyncIterable iteration');
        for await (const value of body) {
            const newContent = decoder.decode(value, { stream: true });
            setBuf(getBuf() + newContent);
            yield* this.processBuffer(getBuf(), setBuf, openCodeState, xmlState);
        }
    }

    private static *processBuffer(
        buffer: string,
        updateBuffer: (b: string) => void,
        openCodeState: OpenCodeStreamState,
        xmlState: XmlParserState
    ): Generator<StreamChunk> {
        const lines = buffer.split('\n');
        const lastLine = lines.pop();
        updateBuffer(lastLine ?? '');

        for (const line of lines) {
            const data = this.extractDataPayload(line);
            if (!data) { continue; }
            if (data === '[DONE]') {
                appLogger.debug('stream-parser.util', '[StreamParser] Received [DONE] signal');
                continue;
            }

            try {
                const json = safeJsonParse<StreamPayload>(data, { choices: [] });
                yield* this.handlePayload(json, openCodeState, xmlState);
            } catch (error) {
                appLogger.error('stream-parser.util', `[StreamParser] Error parsing JSON: ${getErrorMessage(error)}, data: ${data.slice(0, 50)}...`);
            }
        }
    }

    private static extractDataPayload(line: string): string | null {
        const lineWithoutNewline = line.replace(/\r$/, '');
        const firstNonSpace = lineWithoutNewline.search(/\S/);
        if (firstNonSpace < 0) { return null; }
        const withoutIndent = lineWithoutNewline.slice(firstNonSpace);
        if (!withoutIndent.startsWith('data:')) { return null; }

        // Keep payload whitespace untouched to avoid collapsing model-emitted spaces.
        let jsonData = withoutIndent.slice(5);
        while (jsonData.startsWith('data:')) {
            jsonData = jsonData.slice(5);
        }
        return jsonData;
    }

    private static *handlePayload(json: StreamPayload, openCodeState: OpenCodeStreamState, xmlState: XmlParserState): Generator<StreamChunk> {
        // 1. OPENCODE /responses format
        if (json.type?.startsWith('response.')) {
            yield* this.handleOpenCodePayload(json, openCodeState);
            return;
        }

        if (json.type === 'error' && json.message) {
            throw new Error(json.message);
        }

        // 2. STANDARD OpenAI format
        for (const chunk of this.handleOpenAIPayload(json)) {
            yield* this.interceptXmlToolCalls(chunk, xmlState);
        }
    }

    private static *handleOpenCodePayload(json: StreamPayload, openCodeState: OpenCodeStreamState): Generator<StreamChunk> {
        const type = json.type;

        if (this.isOpenCodeDoneEvent(json)) {
            const contentItems = json.item?.content;
            if (contentItems) {
                yield* this.handleOpenCodeDone(contentItems);
            }
            return;
        }

        if (!type) { return; }
        if (
            !json.delta
            && type !== 'response.output_item.added'
            && type !== 'response.output_item.done'
            && type !== 'response.function_call_arguments.done'
        ) {
            return;
        }

        yield* this.dispatchOpenCodeDelta(json, openCodeState);
    }

    private static isOpenCodeDoneEvent(json: StreamPayload): boolean {
        return json.type === 'response.output_item.done' && !!json.item?.content;
    }

    private static *dispatchOpenCodeDelta(json: StreamPayload, openCodeState: OpenCodeStreamState): Generator<StreamChunk> {
        if (json.type === 'response.output_text.delta' && json.delta) {
            yield* this.handleOpenCodeText(json.delta);
        } else if (json.type === 'response.reasoning_summary_text.delta' && json.delta) {
            yield* this.handleOpenCodeReasoning(json.delta);
        } else if (
            json.type === 'response.function_call_arguments.delta'
            || json.type === 'response.output_item.added'
            || json.type === 'response.output_item.done'
        ) {
            this.updateOpenCodeToolCallState(json, openCodeState);
            if (json.type === 'response.output_item.done' && this.isOpenCodeFunctionCallItem(json)) {
                const toolCall = this.finalizeOpenCodeToolCall(json, openCodeState, false);
                if (toolCall) {
                    yield toolCall;
                }
            }
        } else if (json.type === 'response.function_call_arguments.done') {
            const toolCall = this.finalizeOpenCodeToolCall(json, openCodeState, true);
            if (toolCall) {
                yield toolCall;
            }
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

    private static updateOpenCodeToolCallState(json: StreamPayload, openCodeState: OpenCodeStreamState): void {
        const toolCallId = this.resolveOpenCodeToolCallId(json);
        if (!toolCallId) {
            return;
        }

        const current = openCodeState.toolCalls.get(toolCallId) ?? {
            id: toolCallId,
            name: '',
            arguments: '',
        };
        const name = this.resolveOpenCodeToolCallName(json);
        if (name) {
            current.name = name;
        }

        const delta = this.resolveOpenCodeToolCallArguments(json);
        if (delta) {
            if (json.type === 'response.function_call_arguments.delta') {
                current.arguments += delta;
            } else if (delta.length >= current.arguments.length) {
                current.arguments = delta;
            }
        }

        openCodeState.toolCalls.set(toolCallId, current);
    }

    private static finalizeOpenCodeToolCall(
        json: StreamPayload,
        openCodeState: OpenCodeStreamState,
        shouldUpdateState: boolean
    ): StreamChunk | null {
        if (shouldUpdateState) {
            this.updateOpenCodeToolCallState(json, openCodeState);
        }
        const toolCallId = this.resolveOpenCodeToolCallId(json);
        if (!toolCallId) {
            return null;
        }

        const current = openCodeState.toolCalls.get(toolCallId);
        if (!current || current.arguments.trim() === '') {
            return null;
        }
        if (current.name.trim() === '') {
            return null;
        }

        openCodeState.toolCalls.delete(toolCallId);
        return {
            type: 'tool_calls',
            tool_calls: [{
                id: current.id,
                type: 'function',
                function: {
                    name: current.name,
                    arguments: current.arguments
                }
            }]
        };
    }

    private static resolveOpenCodeToolCallId(json: StreamPayload): string | null {
        const candidate = json.call_id ?? json.item_id ?? json.item?.call_id ?? json.item?.id;
        if (typeof candidate === 'string' && candidate.trim() !== '') {
            return candidate.trim();
        }
        return null;
    }

    private static resolveOpenCodeToolCallName(json: StreamPayload): string {
        const directCandidate = json.name ?? json.item?.name;
        if (typeof directCandidate === 'string' && directCandidate.trim().length > 0) {
            return directCandidate.trim();
        }

        const functionCandidate = json.item?.function;
        if (
            functionCandidate
            && typeof functionCandidate === 'object'
            && !Array.isArray(functionCandidate)
            && typeof functionCandidate['name'] === 'string'
            && functionCandidate['name'].trim().length > 0
        ) {
            return functionCandidate['name'].trim();
        }
        return '';
    }

    private static resolveOpenCodeToolCallArguments(json: StreamPayload): string {
        if (typeof json.delta === 'string') {
            return json.delta;
        }
        if (typeof json.delta?.text === 'string') {
            return json.delta.text;
        }
        if (typeof json.arguments === 'string') {
            return json.arguments;
        }
        if (typeof json.item?.arguments === 'string') {
            return json.item.arguments;
        }
        if (
            json.item?.function
            && typeof json.item.function === 'object'
            && !Array.isArray(json.item.function)
            && typeof json.item.function.arguments === 'string'
        ) {
            return json.item.function.arguments;
        }
        if (json.item?.arguments && typeof json.item.arguments === 'object' && !Array.isArray(json.item.arguments)) {
            return JSON.stringify(json.item.arguments);
        }
        return '';
    }

    private static isOpenCodeFunctionCallItem(json: StreamPayload): boolean {
        return json.item?.type === 'function_call';
    }

    private static *handleOpenAIPayload(json: StreamPayload): Generator<StreamChunk> {
        const choices = json.choices ?? [];
        if (json.usage && choices.length === 0) {
            yield { index: 0, content: '', usage: json.usage };
            return;
        }

        for (const choice of choices) {
            const delta = choice.delta;
            const finishReason = choice.finish_reason;
            
            // Handle finish_reason even without delta (important for tool_calls signal)
            if (finishReason && !delta) {
                yield { 
                    index: choice.index ?? 0, 
                    content: '', 
                    finish_reason: finishReason,
                    type: finishReason === 'tool_calls' ? 'tool_calls' : undefined
                };
                continue;
            }
            
            if (!delta) { continue; }

            const chunk = this.extractOpenAIChunk(choice.index ?? 0, delta, json.usage, finishReason);
            if (chunk) { yield chunk; }
        }
    }

    private static extractOpenAIChunk(
        choiceIdx: number, 
        delta: OpenAIStreamDelta, 
        usage: StreamPayload['usage'],
        finishReason?: string | null
    ): StreamChunk | null {
        const content = delta.content ?? '';
        const reasoning = delta.reasoning_content ?? delta.reasoning ?? '';

        if (content) {
            return this.createOpenAIChunk({
                idx: choiceIdx,
                content,
                reasoning,
                delta,
                usage,
                finishReason,
            });
        }
        if (reasoning) {
            return this.createOpenAIChunk({
                idx: choiceIdx,
                content,
                reasoning,
                delta,
                usage,
                finishReason,
            });
        }
        if ((delta.images && delta.images.length > 0) || delta.tool_calls || usage || finishReason) {
            return this.createOpenAIChunk({
                idx: choiceIdx,
                content,
                reasoning,
                delta,
                usage,
                finishReason,
            });
        }

        return null;
    }

    private static createOpenAIChunk(options: {
        idx: number;
        content: string;
        reasoning: string;
        delta: OpenAIStreamDelta;
        usage: StreamPayload['usage'];
        finishReason?: string | null;
    }): StreamChunk {
        const {
            idx,
            content,
            reasoning,
            delta,
            usage,
            finishReason,
        } = options;
        // Determine type based on tool_calls presence or finish_reason
        let chunkType: string | undefined;
        if (delta.tool_calls) {
            chunkType = 'tool_calls';
        } else if (finishReason === 'tool_calls') {
            chunkType = 'tool_calls';
        }
        
        return {
            index: idx,
            content,
            reasoning,
            images: Array.isArray(delta.images) ? delta.images : [],
            type: chunkType,
            tool_calls: delta.tool_calls,
            finish_reason: finishReason,
            usage
        };
    }

    private static *interceptXmlToolCalls(chunk: StreamChunk, xmlState: XmlParserState): Generator<StreamChunk> {
        if (!chunk.content) {
            yield chunk;
            return;
        }

        // Buffer timeout protection: if buffer is stale for more than 5 seconds, flush it
        const XML_BUFFER_TIMEOUT_MS = 5000;
        const now = Date.now();
        if (xmlState.buffer.length > 0 && (now - xmlState.lastUpdateTime) > XML_BUFFER_TIMEOUT_MS) {
            appLogger.warn('StreamParser', `XML buffer timeout, flushing stale buffer (${xmlState.buffer.length} chars)`);
            const staleContent = xmlState.buffer;
            xmlState.buffer = '';
            xmlState.lastUpdateTime = now;
            if (staleContent) {
                yield { ...chunk, content: staleContent };
            }
        }

        xmlState.buffer += chunk.content;
        xmlState.lastUpdateTime = now;

        const { toolCalls, cleanedText } = XmlToolParser.parse(xmlState.buffer, { trim: false });

        // Always update buffer if XML blocks were stripped (even empty ones with no <invoke>)
        const xmlBlocksWereStripped = cleanedText !== xmlState.buffer;
        if (xmlBlocksWereStripped) {
            xmlState.buffer = cleanedText;
        }

        if (toolCalls.length > 0) {
            appLogger.info('StreamParser', `Extracted ${toolCalls.length} XML tool calls`);
            yield {
                ...chunk,
                content: '', // XML calls are usually standalone or handled in cleanedText
                type: 'tool_calls',
                tool_calls: toolCalls
            };
        }

        // If we have potential tags, we buffer to avoid flickering
        if (XmlToolParser.hasPotentialXmlCall(xmlState.buffer)) {
            const { content, buffered } = XmlToolParser.stripIncompleteTags(xmlState.buffer);
            if (content) {
                yield { ...chunk, content };
            }
            xmlState.buffer = buffered;
        } else {
            const content = xmlState.buffer;
            xmlState.buffer = '';
            if (content) {
                yield { ...chunk, content };
            }
        }
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
        id?: string;
        type?: string;
        call_id?: string;
        name?: string;
        arguments?: string;
        function?: {
            name?: string;
            arguments?: string;
        };
        content?: StreamItemContent[];
    };
    response_id?: string;
    item_id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
};
