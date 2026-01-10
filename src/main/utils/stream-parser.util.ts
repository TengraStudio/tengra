import { ToolCall } from '../../shared/types/chat';
import { getErrorMessage } from '../../shared/utils/error.util';

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
            if ('getReader' in body && typeof body.getReader === 'function') {
                // Web Standard ReadableStream
                const reader = body.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        yield* this.processBuffer(buffer, (newBuf) => buffer = newBuf);
                    }
                } finally {
                    reader.releaseLock();
                }
            } else {
                // Node.js Stream
                for await (const value of body as AsyncIterable<Uint8Array>) {
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
            while (jsonData.startsWith('data:')) {
                jsonData = jsonData.slice(5).trim();
            }
            if (jsonData === '[DONE]') continue;

            try {
                const json = JSON.parse(jsonData) as OpenAIStreamPayload;
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
