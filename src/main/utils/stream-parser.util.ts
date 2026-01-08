
export interface StreamChunk {
    content?: string
    reasoning?: string
    images?: any[]
    type?: string
    tool_calls?: any[]
}

export class StreamParser {
    /**
     * Parses a chat stream response (SSE) and yields structured chunks.
     * Supports both Web Streams (ReadableStream) and Node.js Streams (AsyncIterable).
     */
    static async *parseChatStream(response: any): AsyncGenerator<StreamChunk> {
        if (!response.body) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        const body = response.body;

        try {
            if (typeof body.getReader === 'function') {
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
                for await (const value of body) {
                    buffer += decoder.decode(value, { stream: true });
                    yield* this.processBuffer(buffer, (newBuf) => buffer = newBuf);
                }
            }
        } catch (e) {
            console.error('[StreamParser] Parse error:', e)
            throw e
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
                const json = JSON.parse(jsonData);
                const delta = json.choices?.[0]?.delta;
                if (!delta) continue;

                const content = delta.content || '';
                const reasoning = delta.reasoning_content || delta.reasoning || '';
                const images = delta.images || [];

                if (content || reasoning || images.length > 0 || delta.tool_calls) {
                    yield {
                        content,
                        reasoning,
                        images: images,
                        type: delta.tool_calls ? 'tool_calls' : undefined,
                        tool_calls: delta.tool_calls
                    };
                }
            } catch { }
        }
    }
}
