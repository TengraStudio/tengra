import { appLogger } from '@main/logging/logger'
import { ToolCall } from '@shared/types/chat';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export interface StreamChunk {
    index?: number
    content?: string
    reasoning?: string
    images?: Array<string | { image_url: { url: string } }>
    type?: string
    tool_calls?: ToolCall[]
    usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

type OpenAIStreamDelta = {
    content?: string
    reasoning_content?: string
    reasoning?: string
    images?: Array<string | { image_url: { url: string } }>
    tool_calls?: ToolCall[]
}

type OpenAIStreamPayload = {
    choices?: Array<{ delta?: OpenAIStreamDelta; index?: number }>
}

export class StreamParser {
    /**
     * Parses a chat stream response (SSE) and yields structured chunks.
     * Supports both Web Streams (ReadableStream) and Node.js Streams (AsyncIterable).
     */
    static async *parseChatStream(input: Response | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>): AsyncGenerator<StreamChunk> {
        let body: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;

        if ('body' in input && input.body) {
            body = input.body;
        } else if ('body' in input && !input.body) {
            throw new Error('No response body');
        } else {
            body = input as ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            appLogger.info('stream-parser.util', `[StreamParser] Starting parse. Input type: ${input.constructor.name}`);
            if ('getReader' in body && typeof body.getReader === 'function') {
                // Web Standard ReadableStream
                const reader = body.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            appLogger.info('stream-parser.util', '[StreamParser] Reader done');
                            break;
                        }
                        appLogger.debug('stream-parser.util', `[StreamParser] Received ${value.length} bytes`);
                        buffer += decoder.decode(value, { stream: true });
                        yield* this.processBuffer(buffer, (newBuf) => buffer = newBuf);
                    }
                } finally {
                    reader.releaseLock();
                }
            } else {
                // Node.js Stream
                appLogger.info('stream-parser.util', '[StreamParser] Using AsyncIterable iteration');
                for await (const value of body as AsyncIterable<Uint8Array>) {
                    appLogger.debug('stream-parser.util', `[StreamParser] Received ${value.length} bytes`);
                    buffer += decoder.decode(value, { stream: true });
                    yield* this.processBuffer(buffer, (newBuf) => buffer = newBuf);
                }
            }
        } catch (error) {
            console.error('[StreamParser] Parse error:', getErrorMessage(error))
            throw error
        }
    }

    private static *processBuffer(buffer: string, updateBuffer: (b: string) => void): Generator<StreamChunk> {
        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        const lastLine = lines.pop();
        updateBuffer(lastLine ?? '');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed?.startsWith('data:')) { continue; }
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') { continue; }

            // Handle nested data: prefix issue
            let jsonData = data;
            while (jsonData.startsWith('data:')) {
                jsonData = jsonData.slice(5).trim();
            }
            if (jsonData === '[DONE]') { continue; }


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

            try {
                const json = safeJsonParse<StreamPayload>(jsonData, { choices: [] });

                // 1. OPENCODE /responses format
                if (json.type === 'response.output_text.delta' && json.delta) {
                    const content = typeof json.delta === 'string' ? json.delta : json.delta?.text ?? '';
                    if (content) {
                        yield { content };
                    }
                    continue;
                }

                if (json.type === 'response.reasoning_summary_text.delta' && json.delta) {
                    const reasoning = typeof json.delta === 'string' ? json.delta : json.delta?.text ?? '';
                    if (reasoning) {
                        yield { reasoning };
                    }
                    continue;
                }

                if (json.type === 'response.output_item.done' && json.item?.content) {
                    const contentValues = json.item.content
                        .filter((c) => c.type === 'output_text')
                        .map((c) => c.text ?? '')
                        .join('');
                    if (contentValues) {
                        yield { content: contentValues };
                    }
                    continue;
                }

                if (json.type === 'response.function_call_arguments.delta' && json.delta) {
                    const args = typeof json.delta === 'string' ? json.delta : JSON.stringify(json.delta);
                    yield {
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
                    continue;
                }

                if (json.type === 'error' && json.message) {
                    console.error('[StreamParser] API Error Chunk:', json.message);
                    throw new Error(json.message);
                }

                // 2. STANDARD OpenAI format
                const choices = json.choices ?? [];

                // Handle usage-only chunks (common with stream_options: { include_usage: true })
                if (json.usage && choices.length === 0) {
                    yield {
                        index: 0,
                        content: '',
                        usage: json.usage
                    };
                    continue;
                }

                for (const choice of choices) {
                    const delta = choice.delta;
                    if (!delta) { continue; }

                    const content = delta.content ?? '';
                    const reasoning = (delta.reasoning_content || delta.reasoning) ?? '';
                    const images = Array.isArray(delta.images) ? delta.images : [];

                    if (content || reasoning || images.length > 0 || delta.tool_calls || json.usage) {
                        yield {
                            index: choice.index ?? 0,
                            content,
                            reasoning,
                            images,
                            type: delta.tool_calls ? 'tool_calls' : undefined,
                            tool_calls: delta.tool_calls,
                            usage: json.usage
                        };
                    }
                }
            } catch (error) {
                // Silent catch for malformed JSON chunks
                appLogger.debug('stream-parser.util', '[StreamParser] Skipping malformed chunk:', getErrorMessage(error));
            }
        }
    }
}
