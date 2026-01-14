import { ToolCall } from '@shared/types/chat';
import { getErrorMessage } from '@shared/utils/error.util';

export interface StreamChunk {
    content?: string
    reasoning?: string
    images?: Array<string | { image_url: { url: string } }>
    type?: string
    tool_calls?: ToolCall[]
}

type OpenAIStreamDelta = {
    content?: string
    reasoning_content?: string
    reasoning?: string
    images?: Array<string | { image_url: { url: string } }>
    tool_calls?: ToolCall[]
}

type OpenAIStreamPayload = {
    choices?: Array<{ delta?: OpenAIStreamDelta }>
}

export class StreamParser {
    /**
     * Parses a chat stream response (SSE) and yields structured chunks.
     * Supports both Web Streams (ReadableStream) and Node.js Streams (AsyncIterable).
     */
    static async *parseChatStream(response: Response): AsyncGenerator<StreamChunk> {
        if (!response.body) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        const body = response.body as ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;

        try {
            console.log(`[StreamParser] Starting parse. Body type: ${response.body?.constructor.name}`);
            if ('getReader' in body && typeof body.getReader === 'function') {
                // Web Standard ReadableStream
                const reader = body.getReader();
                const MAX_STREAM_ITERATIONS = 10000;
                let iterations = 0;
                try {
                    while (iterations < MAX_STREAM_ITERATIONS) {
                        const { done, value } = await reader.read();
                        if (done) {
                            console.log('[StreamParser] Reader done');
                            break;
                        }
                        console.debug(`[StreamParser] Received ${value.length} bytes`);
                        buffer += decoder.decode(value, { stream: true });
                        yield* this.processBuffer(buffer, (newBuf) => buffer = newBuf);
                        iterations++;
                    }
                    if (iterations >= MAX_STREAM_ITERATIONS) {
                        throw new Error('Stream parsing exceeded maximum iterations');
                    }
                } finally {
                    reader.releaseLock();
                }
            } else {
                // Node.js Stream
                console.log('[StreamParser] Using AsyncIterable iteration');
                for await (const value of body as AsyncIterable<Uint8Array>) {
                    console.debug(`[StreamParser] Received ${value.length} bytes`);
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
        updateBuffer(lastLine || '');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;

            // Handle nested data: prefix issue
            let jsonData = data;
            const MAX_DATA_PREFIX_ITERATIONS = 100;
            let prefixIterations = 0;
            while (jsonData.startsWith('data:') && prefixIterations < MAX_DATA_PREFIX_ITERATIONS) {
                jsonData = jsonData.slice(5).trim();
                prefixIterations++;
            }
            if (jsonData === '[DONE]') continue;

            try {
                const json = JSON.parse(jsonData) as OpenAIStreamPayload & { type?: string; delta?: string | { text?: string }; message?: string };

                // 1. OPENCODE /responses format
                if (json.type === 'response.output_text.delta' && json.delta) {
                    const content = typeof json.delta === 'string' ? json.delta : json.delta?.text || '';
                    if (content) {
                        yield { content };
                    }
                    continue;
                }

                if (json.type === 'response.reasoning_summary_text.delta' && json.delta) {
                    const reasoning = typeof json.delta === 'string' ? json.delta : json.delta?.text || '';
                    if (reasoning) {
                        yield { reasoning };
                    }
                    continue;
                }

                if (json.type === 'response.output_item.done' && (json as any).item?.content) {
                    const contentValues = (json as any).item.content
                        .filter((c: any) => c.type === 'output_text')
                        .map((c: any) => c.text)
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
                            id: 'opencode-tc-' + (json as any).response_id || 'unknown',
                            type: 'function',
                            function: {
                                name: (json as any).name || 'unknown',
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
                const delta = json.choices?.[0]?.delta;
                if (!delta) continue;

                const content = delta.content || '';
                const reasoning = delta.reasoning_content || delta.reasoning || '';
                const images = Array.isArray(delta.images) ? delta.images : [];

                if (content || reasoning || images.length > 0 || delta.tool_calls) {
                    yield {
                        content,
                        reasoning,
                        images,
                        type: delta.tool_calls ? 'tool_calls' : undefined,
                        tool_calls: delta.tool_calls
                    };
                }
            } catch (error) {
                // Silent catch for malformed JSON chunks
                console.debug('[StreamParser] Skipping malformed chunk:', getErrorMessage(error));
            }
        }
    }
}
