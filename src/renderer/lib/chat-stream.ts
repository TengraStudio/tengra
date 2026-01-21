import { CatchError, JsonObject, JsonValue } from '@shared/types/common'

import { Message, ToolCall, ToolDefinition } from '@/types'

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
    done?: boolean
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
        if (isDone) {
            console.warn(`[ChatStream] Received chunk after isDone=true for chatId: ${chatId}. Ignoring.`);
            return;
        }

        // If chatId is provided and chunk has chatId, filter it. 
        if (chatId && typedChunk.chatId && typedChunk.chatId !== chatId) {
            console.warn(`[ChatStream] Ignoring chunk for different chatId: ${typedChunk.chatId} (expected ${chatId})`);
            return;
        }

        console.warn(`[ChatStream] Received chunk for ${chatId}:`, typedChunk);

        if (typedChunk.done) {
            console.warn(`[ChatStream] Received DONE signal for chatId: ${chatId}`);
            isDone = true;
            if (currentResolver) {
                console.warn(`[ChatStream] Resolving currentResolver (DONE) for chatId: ${chatId}`);
                currentResolver();
                currentResolver = null;
            }
            return;
        }

        queue.push(typedChunk);
        console.warn(`[ChatStream] Pushed chunk to queue. Queue size: ${queue.length}`);

        if (currentResolver) {
            console.warn(`[ChatStream] Resolving currentResolver for chatId: ${chatId}`);
            currentResolver(); // Signal that data is available
            currentResolver = null;
        }
    };

    // Subscribe using the exposed bridge method
    const unsubscribe = window.electron.onStreamChunk(listener);
    console.warn(`[ChatStream] Subscribed to streams for chatId: ${chatId}`);

    // Start the stream via IPC
    window.electron.chatStream(messages, model, tools, provider, options, chatId, projectId)
        .then(() => {
            // Request successfully sent/queued. Completion will be signaled via 'done' chunk.
        })
        .catch(err => {
            error = err;
            isDone = true;
            if (currentResolver) {
                currentResolver();
                currentResolver = null;
            }
        });

    try {
        const MAX_OUTER_ITERATIONS = 100000;
        const MAX_QUEUE_ITERATIONS = 1000;
        let outerIterations = 0;

        while (outerIterations < MAX_OUTER_ITERATIONS) {
            let queueIterations = 0;
            while (queue.length > 0 && queueIterations < MAX_QUEUE_ITERATIONS) {
                const chunk = queue.shift();
                if (!chunk) {continue;}
                queueIterations++;

                console.warn(`[ChatStream] Yielding chunk from queue:`, chunk);

                // Inspect chunk structure and normalize keys
                if (chunk.content !== undefined && chunk.content !== null) {
                    yield { type: 'content', content: chunk.content };
                }
                if (chunk.reasoning !== undefined && chunk.reasoning !== null) {
                    yield { type: 'reasoning', content: chunk.reasoning };
                }
                if (chunk.images) {yield { type: 'images', images: chunk.images };}
                if (chunk.type === 'tool_calls') {yield chunk;}
                if (chunk.type === 'metadata') {
                    const rawSources = chunk.metadata?.sources
                    const sources = Array.isArray(rawSources)
                        ? rawSources.filter((value): value is string => typeof value === 'string')
                        : undefined
                    yield { ...chunk, sources: chunk.sources || sources };
                }
                if (chunk.type === 'error') {yield chunk;}
            }

            if (isDone) {
                if (error) {throw error;}
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
        // Clean up listener using the unsubscribe function
        if (typeof unsubscribe === 'function') {
            (unsubscribe as () => void)();
            console.warn(`[ChatStream] Unsubscribed from streams for chatId: ${chatId}`);
        } else {
            // Fallback for older versions of the bridge
            window.electron.removeStreamChunkListener(listener);
        }
    }
}
