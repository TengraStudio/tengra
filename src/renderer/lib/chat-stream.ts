import { CatchError, JsonObject } from '@shared/types/common';
import { SessionConversationStreamChunk } from '@shared/types/session-conversation';

import { ChatStreamRequest, ToolCall } from '@/types';

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

function normalizeChunk(chunk: ChatStreamChunk): ChatStreamChunk[] {
    const results: ChatStreamChunk[] = [];
    if (chunk.content !== undefined) {
        results.push({ type: 'content', content: chunk.content });
    }
    if (chunk.reasoning !== undefined) {
        results.push({ type: 'reasoning', content: chunk.reasoning });
    }
    if (chunk.images) {
        results.push({ type: 'images', images: chunk.images });
    }
    if (chunk.type === 'tool_calls') {
        results.push(chunk);
    }
    if (chunk.type === 'metadata') {
        const rawSources = chunk.metadata?.sources;
        const sources = Array.isArray(rawSources)
            ? rawSources.filter((v): v is string => typeof v === 'string')
            : undefined;
        results.push({ ...chunk, sources: chunk.sources ?? sources });
    }
    if (chunk.type === 'error') {
        results.push(chunk);
    }
    return results;
}

export async function* chatStream(
    request: ChatStreamRequest
): AsyncGenerator<ChatStreamChunk> {
    const { messages, model, tools = [], provider, options, chatId, workspaceId } = request;
    let currentResolver: ((value: void | null) => void) | null = null;
    const queue: ChatStreamChunk[] = [];
    const state = {
        isDone: false,
        streamError: null as CatchError
    };

    const listener = (chunk: SessionConversationStreamChunk) => {
        const typedChunk: ChatStreamChunk = {
            chatId: chunk.chatId,
            content: chunk.content,
            reasoning: chunk.reasoning,
            done: chunk.done,
            type: chunk.type,
            sources: chunk.sources,
            tool_calls: chunk.toolCalls,
            error: chunk.error,
        };
        if (state.isDone) {
            return;
        }
        if (chatId && typedChunk.chatId && typedChunk.chatId !== chatId) {
            return;
        }

        if (typedChunk.done) {
            state.isDone = true;
            if (currentResolver) {
                currentResolver();
                currentResolver = null;
            }
            return;
        }

        queue.push(typedChunk);
        if (currentResolver) {
            currentResolver();
            currentResolver = null;
        }
    };

    const sessionConversationBridge = window.electron.session.conversation;
    const unsubscribe = sessionConversationBridge.onStreamChunk(listener);

    void sessionConversationBridge.stream({ messages, model, tools, provider, options, chatId, workspaceId })
        .catch(err => {
            state.streamError = err;
            state.isDone = true;
            if (currentResolver) {
                currentResolver();
                currentResolver = null;
            }
        });

    try {
        const MAX_OUTER_ITERATIONS = 100000;
        let outerIterations = 0;

        while (outerIterations < MAX_OUTER_ITERATIONS) {
            let chunk: ChatStreamChunk | undefined;
            while ((chunk = queue.shift()) !== undefined) {
                for (const normalized of normalizeChunk(chunk)) {
                    yield normalized;
                }
            }

            if (state.isDone) {
                if (state.streamError !== null) {
                    throw state.streamError;
                }
                break;
            }

            await new Promise<void | null>(resolve => {
                currentResolver = resolve;
            });
            outerIterations++;
        }
    } finally {
        if (typeof unsubscribe === 'function') {
            (unsubscribe as () => void)();
        }
    }
}
