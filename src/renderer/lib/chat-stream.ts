/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CatchError, JsonObject } from '@shared/types/common';
import { SessionConversationStreamChunk } from '@shared/types/session-conversation';

import { ChatStreamRequest, ToolCall } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

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
    streamId?: string
}

const STREAM_WAIT_TICK_MS = 1000;
const STREAM_WAIT_LOG_EVERY_TICKS = 10;

function normalizeChunk(chunk: ChatStreamChunk): ChatStreamChunk[] {
    const results: ChatStreamChunk[] = [];
    if (typeof chunk.reasoning === 'string' && chunk.reasoning.length > 0) {
        // Preserve reasoning before visible content so thought accordions render in sequence.
        results.push({ type: 'reasoning', reasoning: chunk.reasoning });
    }
    if (typeof chunk.content === 'string' && chunk.content.length > 0) {
        results.push({ type: 'content', content: chunk.content });
    }
    if (chunk.images) {
        results.push({ type: 'images', images: chunk.images });
    }
    const hasToolCalls = Array.isArray(chunk.tool_calls) && chunk.tool_calls.length > 0;
    if (chunk.type === 'tool_calls' || hasToolCalls) {
        results.push({
            ...chunk,
            type: 'tool_calls',
        });
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
    let currentResolver: ((value: void | null) => void) | null = null;
    const queue: ChatStreamChunk[] = [];
    const state = {
        isDone: false,
        streamError: null as CatchError
    };
    let waitTimer: ReturnType<typeof setTimeout> | null = null;
    let receivedChunkCount = 0;
    let yieldedChunkCount = 0;
    let ignoredChunkCount = 0;
    let waitTickCount = 0;

    const clearWaitTimer = (): void => {
        if (waitTimer) {
            clearTimeout(waitTimer);
            waitTimer = null;
        }
    };

    const resolveWaiter = (): void => {
        if (currentResolver) {
            const resolver = currentResolver;
            currentResolver = null;
            clearWaitTimer();
            resolver();
        }
    };

    const streamId = request.streamId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const listener = (chunk: SessionConversationStreamChunk) => {
        const toolCallsFromChunk = chunk.toolCalls
            ?? (chunk as SessionConversationStreamChunk & { tool_calls?: ToolCall[] }).tool_calls;
        const typedChunk: ChatStreamChunk = {
            chatId: chunk.chatId,
            streamId: chunk.streamId,
            content: chunk.content,
            reasoning: chunk.reasoning,
            done: chunk.done,
            type: chunk.type,
            sources: chunk.sources,
            tool_calls: toolCallsFromChunk,
            error: chunk.error,
        };
        receivedChunkCount++;
        if (state.isDone) {
            ignoredChunkCount++;
            return;
        }
        if (chatId && typedChunk.chatId && typedChunk.chatId !== chatId) {
            ignoredChunkCount++;
            return;
        }
        if (typedChunk.streamId && typedChunk.streamId !== streamId) {
            ignoredChunkCount++;
            return;
        }

        queue.push(typedChunk);

        if (typedChunk.done) {
            state.isDone = true;
            appLogger.info(
                'chatStream',
                `received done chatId=${chatId ?? 'none'} received=${receivedChunkCount} yielded=${yieldedChunkCount} ignored=${ignoredChunkCount}`
            );
        }

        resolveWaiter();
    };

    const { messages, model, tools, provider, options, chatId, assistantId, workspaceId } = request;
    const sessionConversationBridge = window.electron.session.conversation;
    appLogger.info(
        'chatStream',
        `stream start streamId=${streamId} chatId=${chatId ?? 'none'} model=${model} provider=${provider} messages=${messages.length} tools=${tools?.length ?? 0}`
    );
    const unsubscribe = sessionConversationBridge.onStreamChunk(listener);

    void sessionConversationBridge.stream({ messages, model, tools, provider, options, chatId, assistantId, workspaceId, streamId })
        .then(() => {
            appLogger.info(
                'chatStream',
                `stream invoke resolved streamId=${streamId} chatId=${chatId ?? 'none'} received=${receivedChunkCount} yielded=${yieldedChunkCount} ignored=${ignoredChunkCount}`
            );
        })
        .catch(err => {
            state.streamError = err;
            state.isDone = true;
            appLogger.error(
                'chatStream',
                `stream invoke failed chatId=${chatId ?? 'none'}`,
                err instanceof Error ? err : new Error(String(err))
            );
            resolveWaiter();
        });

    try {
        const MAX_OUTER_ITERATIONS = 100000;
        let outerIterations = 0;

        while (outerIterations < MAX_OUTER_ITERATIONS) {
            let chunk: ChatStreamChunk | undefined;
            while ((chunk = queue.shift()) !== undefined) {
                for (const normalized of normalizeChunk(chunk)) {
                    yieldedChunkCount++;
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
                waitTimer = setTimeout(() => {
                    if (currentResolver) {
                        const resolver = currentResolver;
                        currentResolver = null;
                        clearWaitTimer();
                        waitTickCount++;
                        if (waitTickCount % STREAM_WAIT_LOG_EVERY_TICKS === 0) {
                            appLogger.info(
                                'chatStream',
                                `wait tick streamId=${streamId} chatId=${chatId ?? 'none'} ticks=${waitTickCount} queue=${queue.length} received=${receivedChunkCount} yielded=${yieldedChunkCount} ignored=${ignoredChunkCount}`
                            );
                        }
                        resolver();
                    }
                }, STREAM_WAIT_TICK_MS);
            });
            outerIterations++;
        }
    } finally {
        appLogger.info(
            'chatStream',
            `stream end streamId=${streamId} chatId=${chatId ?? 'none'} done=${String(state.isDone)} error=${String(state.streamError !== null)} received=${receivedChunkCount} yielded=${yieldedChunkCount} ignored=${ignoredChunkCount} waitTicks=${waitTickCount}`
        );
        clearWaitTimer();
        if (typeof unsubscribe === 'function') {
            (unsubscribe as () => void)();
        }
    }
}
