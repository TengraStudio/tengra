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
        const MAX_OUTER_ITERATIONS = 100000;
        const MAX_QUEUE_ITERATIONS = 1000;
        let outerIterations = 0;
        
        while (outerIterations < MAX_OUTER_ITERATIONS) {
            let queueIterations = 0;
            while (queue.length > 0 && queueIterations < MAX_QUEUE_ITERATIONS) {
                const chunk = queue.shift();
                if (!chunk) continue;
                queueIterations++;

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
            outerIterations++;
        }
        
        if (outerIterations >= MAX_OUTER_ITERATIONS) {
            throw new Error('Chat stream processing exceeded maximum iterations');
        }
    } finally {
        // Clean up listener
        window.electron.removeStreamChunkListener(listener);
    }
}
