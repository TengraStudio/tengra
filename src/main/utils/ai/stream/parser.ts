/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { appLogger } from '@main/logging/logger';
import { JsonToolParser } from '@main/utils/ai/json-tool-parser.util';
import { XmlToolParser } from '@main/utils/ai/xml-tool-parser.util';
import { getErrorMessage } from '@shared/utils/system/error.util';
import { safeJsonParse } from '@shared/utils/system/sanitize.util';

type UnsafeValue = ReturnType<typeof JSON.parse>;
import {
    AntigravityParserStrategy,
    CopilotParserStrategy,
    OpenAIParserStrategy,
    OpenCodeParserStrategy} from './strategies';
import {
    AntigravityStreamState,
    CopilotStreamState,
    CopilotToolCallState,
    InterceptorState,
    IStreamParserStrategy,
    OpenCodeStreamState,
    OpenCodeToolCallState,
    RuntimeValue,
    StreamChunk,
    StreamPayload} from './types';

export class StreamParser {
    private static readonly strategies: Record<string, IStreamParserStrategy> = {
        'openai': new OpenAIParserStrategy(),
        'opencode': new OpenCodeParserStrategy(),
        'copilot': new CopilotParserStrategy(),
        'antigravity': new AntigravityParserStrategy(),
        'google': new AntigravityParserStrategy(),
    };

    /**
     * Parses a chat stream response (SSE) and yields structured chunks.
     */
    static async *parseChatStream(
        input: Response | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
        provider: string = 'openai'
    ): AsyncGenerator<StreamChunk> {
        const body = this.getStreamBody(input);
        const decoder = new TextDecoder();
        let buffer = '';
        
        const openCodeState = this.createOpenCodeStreamState();
        const copilotState = this.createCopilotStreamState();
        const antigravityState = this.createAntigravityStreamState();
        const interceptorState: InterceptorState = { buffer: '', lastUpdateTime: Date.now() };
        
        const strategy = this.strategies[provider] || this.strategies['openai'];
        const state = provider === 'opencode' 
            ? openCodeState 
            : (provider === 'copilot' 
                ? copilotState 
                : (provider === 'antigravity' || provider === 'google' ? antigravityState : null));

        try {
            const parseOptions = {
                decoder,
                setBuf: (b: string) => { buffer = b; },
                getBuf: () => buffer,
                state,
                interceptorState,
                strategy,
            };

            if (this.isWebStream(body)) {
                yield* this.parseWebStream(body, parseOptions);
            } else {
                yield* this.parseNodeStream(body, parseOptions);
            }
        } catch (error) {
            appLogger.error('StreamParser', `Parse error for provider ${provider}`, error as Error);
            throw error;
        }
    }

    private static createOpenCodeStreamState(): OpenCodeStreamState {
        return {
            toolCalls: new Map<string, OpenCodeToolCallState>(),
            processedMessageIds: new Set<string>(),
            lastContent: '',
        };
    }

    private static createCopilotStreamState(): CopilotStreamState {
        return {
            toolCalls: new Map<string, CopilotToolCallState>(),
            lastContent: '',
            lastReasoning: '',
        };
    }

    private static createAntigravityStreamState(): AntigravityStreamState {
        return {
            toolCalls: new Map(),
            lastContent: '',
            lastReasoning: '',
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
            state: UnsafeValue;
            interceptorState: InterceptorState;
            strategy: IStreamParserStrategy;
        }
    ) {
        const { decoder, setBuf, getBuf, state, interceptorState, strategy } = options;
        const reader = body.getReader();
        const MAX_ITERATIONS = 1_000_000;
        let iterationCount = 0;
        let shouldBreak = false;
        try {
            while (iterationCount < MAX_ITERATIONS && !shouldBreak) {
                const { done, value } = await reader.read();
                if (done) { break; }
                const newContent = decoder.decode(value, { stream: true });
                setBuf(getBuf() + newContent);
                for (const chunk of this.processBuffer(getBuf(), setBuf, state, interceptorState, strategy)) {
                    yield chunk;
                    if (chunk.finish_reason != null) {
                        shouldBreak = true;
                    }
                }
                iterationCount++;
            }
        } finally {
            if (interceptorState.buffer.length > 0) {
                yield { content: interceptorState.buffer };
                interceptorState.buffer = '';
            }
            reader.releaseLock();
        }
    }

    private static async *parseNodeStream(
        body: AsyncIterable<Uint8Array>,
        options: {
            decoder: TextDecoder;
            setBuf: (b: string) => void;
            getBuf: () => string;
            state: UnsafeValue;
            interceptorState: InterceptorState;
            strategy: IStreamParserStrategy;
        }
    ) {
        const { decoder, setBuf, getBuf, state, interceptorState, strategy } = options;
        for await (const value of body) {
            const newContent = decoder.decode(value, { stream: true });
            setBuf(getBuf() + newContent);
            let shouldBreak = false;
            for (const chunk of this.processBuffer(getBuf(), setBuf, state, interceptorState, strategy)) {
                yield chunk;
                if (chunk.finish_reason != null) {
                    shouldBreak = true;
                }
            }
            if (shouldBreak) {
                break;
            }
        }

        if (interceptorState.buffer.length > 0) {
            yield { content: interceptorState.buffer };
            interceptorState.buffer = '';
        }
    }

    private static *processBuffer(
        buffer: string,
        updateBuffer: (b: string) => void,
        state: UnsafeValue,
        interceptorState: InterceptorState,
        strategy: IStreamParserStrategy
    ): Generator<StreamChunk> {
        const lines = buffer.split('\n');
        const lastLine = lines.pop();
        updateBuffer(lastLine ?? '');

        for (const line of lines) {
            const data = this.extractDataPayload(line);
            if (!data) { continue; }
            if (data === '[DONE]') {
                yield { finish_reason: 'stop' };
                continue;
            }

            try {
                const json = safeJsonParse<StreamPayload>(data, { choices: [] } as UnsafeValue);
                yield* strategy.parse(json, state, interceptorState);
            } catch (error) {
                appLogger.error('StreamParser', `Error parsing JSON: ${getErrorMessage(error)}, data: ${data.slice(0, 50)}...`);
            }
        }
    }

    private static extractDataPayload(line: string): string | null {
        const lineWithoutNewline = line.replace(/\r$/, '');
        const firstNonSpace = lineWithoutNewline.search(/\S/);
        if (firstNonSpace < 0) { return null; }
        const withoutIndent = lineWithoutNewline.slice(firstNonSpace);
        if (!withoutIndent.startsWith('data:')) { return null; }

        let jsonData = withoutIndent.slice(5);
        while (jsonData.startsWith('data:')) {
            jsonData = jsonData.slice(5);
        }
        return jsonData;
    }

    /**
     * Intercepts tool calls embedded in content (XML/JSON tags).
     */
    public static *interceptEmbeddedToolCalls(chunk: StreamChunk, state: InterceptorState): Generator<StreamChunk> {
        if (!chunk.content) {
            yield chunk;
            return;
        }

        const INTERCEPT_BUFFER_TIMEOUT_MS = 5000;
        const now = Date.now();
        if (state.buffer.length > 0 && (now - state.lastUpdateTime) > INTERCEPT_BUFFER_TIMEOUT_MS) {
            appLogger.warn('StreamParser', `Interceptor buffer timeout, flushing stale buffer (${state.buffer.length} chars)`);
            const staleContent = state.buffer;
            state.buffer = '';
            state.lastUpdateTime = now;
            if (staleContent) {
                yield { ...chunk, content: staleContent };
            }
        }

        state.buffer += chunk.content;
        state.lastUpdateTime = now;

        const { toolCalls: jsonCalls, cleanedText: afterJson } = JsonToolParser.parse(state.buffer, { trim: false });
        if (jsonCalls.length > 0) {
            appLogger.info('StreamParser', `Extracted ${jsonCalls.length} JSON tool calls from content`);
            yield {
                ...chunk,
                content: '',
                type: 'tool_calls',
                tool_calls: jsonCalls,
                finish_reason: 'tool_calls'
            };
            state.buffer = afterJson;
        }

        const { toolCalls: xmlCalls, cleanedText: afterXml } = XmlToolParser.parse(state.buffer, { trim: false });
        if (xmlCalls.length > 0) {
            appLogger.info('StreamParser', `Extracted ${xmlCalls.length} XML tool calls from content`);
            yield {
                ...chunk,
                content: '',
                type: 'tool_calls',
                tool_calls: xmlCalls,
                finish_reason: 'tool_calls'
            };
            state.buffer = afterXml;
        }

        const hasPotentialXml = XmlToolParser.hasPotentialXmlCall(state.buffer);
        const hasPotentialJson = JsonToolParser.hasPotentialJsonCall(state.buffer);

        if (hasPotentialXml || hasPotentialJson) {
            if (hasPotentialXml) {
                const { content, buffered } = XmlToolParser.stripIncompleteTags(state.buffer);
                if (content) {
                    yield { ...chunk, content };
                }
                state.buffer = buffered;
            } else {
                const partial = JsonToolParser.tryExtractPartialName(state.buffer);
                if (partial && partial.name !== state.lastEmittedToolName) {
                    state.lastEmittedToolName = partial.name;
                    yield { 
                        ...chunk,
                        content: '',
                        type: 'tool_calls', 
                        tool_name: partial.name,
                        ...(partial.id ? { tool_id: partial.id } : {})
                    };
                }
            }
        } else {
            const content = state.buffer;
            state.buffer = '';
            if (content) {
                yield { ...chunk, content };
            }
        }
    }
}
