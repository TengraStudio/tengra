import { Message, ToolCall, ToolDefinition } from '@/types'
import { CatchError, JsonObject, JsonValue } from '../../shared/types/common'

export interface ChatStreamChunk {
    type?: 'content' | 'reasoning' | 'images' | 'tool_calls' | 'metadata' | 'error'
    content?: string
    reasoning?: string
    images?: string[]
    tool_calls?: ToolCall[]
    chatId?: string
    metadata?: JsonObject
    sources?: string[]
    error?: string
}

export async function* chatStream(
    messages: Message[],
    model: string,
    tools: ToolDefinition[] = [],
    provider?: string,
    options?: JsonObject,
    chatId?: string,
    projectId?: string
): AsyncGenerator<ChatStreamChunk> {
    let currentResolver: ((value: void | null) => void) | null = null;
    const queue: ChatStreamChunk[] = [];
    let isDone = false;
    let error: CatchError = null;

    // Type for the listener callback
    const listener = (chunk: JsonValue) => {
        const typedChunk = chunk as ChatStreamChunk;
        if (isDone) return;
        // If chatId is provided and chunk has chatId, filter it. 
        if (chatId && typedChunk.chatId && typedChunk.chatId !== chatId) return;

        queue.push(typedChunk);

        if (currentResolver) {
            currentResolver(); // Signal that data is available
            currentResolver = null;
        }
    };

    // Subscribe using the exposed bridge method
    window.electron.onStreamChunk(listener);

    // Start the stream via IPC
    window.electron.chatStream(messages, model, tools, provider, options, chatId, projectId)
        .then(() => {
            isDone = true;
            if (currentResolver) currentResolver();
        })
        .catch(err => {
            error = err;
            isDone = true;
            if (currentResolver) currentResolver();
        });

    try {
        while (true) {
            while (queue.length > 0) {
                const chunk = queue.shift();
                if (!chunk) continue;

                // Inspect chunk structure and normalize keys
                if (chunk.content) yield { type: 'content', content: chunk.content };
                if (chunk.reasoning) yield { type: 'reasoning', content: chunk.reasoning };
                if (chunk.images) yield { type: 'images', images: chunk.images };
                if (chunk.type === 'tool_calls') yield chunk;
                if (chunk.type === 'metadata') {
                    const rawSources = chunk.metadata?.sources
                    const sources = Array.isArray(rawSources)
                        ? rawSources.filter((value): value is string => typeof value === 'string')
                        : undefined
                    yield { ...chunk, sources: chunk.sources || sources };
                }
                if (chunk.type === 'error') yield chunk;
            }

            if (isDone) {
                if (error) throw error;
                break;
            }

            // Wait for next chunk or completion
            await new Promise<void | null>(resolve => currentResolver = resolve);
        }
    } finally {
        // Clean up listener
        window.electron.removeStreamChunkListener(listener);
    }
}
