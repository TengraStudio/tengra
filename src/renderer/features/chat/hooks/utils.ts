/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { normalizeChatError } from '@/features/chat/utils/chat-error-normalizer.util';
import { AppSettings, ChatError, Message, ToolCall } from '@/types';

export interface StreamChunk {
    index?: number
    type?: string
    content?: string
    reasoning?: string
    sources?: string[]
    images?: string[]
    tool_calls?: ToolCall[]
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export interface MergeToolCallOptions {
    fallbackIdPrefix?: string;
    allowIndexMatch?: boolean;
}

export interface StreamChunkResult {
    updated: boolean
    newContent?: string
    newReasoning?: string
    newSources?: string[]
    newImages?: string[]
    newToolCalls?: ToolCall[]
    streamError?: string
    speed?: number | null
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

const buildFallbackToolCallId = (toolCall: ToolCall, options?: MergeToolCallOptions): string => {
    const fallbackPrefix = typeof options?.fallbackIdPrefix === 'string' && options.fallbackIdPrefix.trim().length > 0
        ? options.fallbackIdPrefix.trim()
        : null;
    const functionName = typeof toolCall.function?.name === 'string' && toolCall.function.name.trim().length > 0
        ? toolCall.function.name.trim()
        : 'tool';
    const indexPart = typeof toolCall.index === 'number' ? toolCall.index : 0;
    if (fallbackPrefix) {
        return `${fallbackPrefix}-${indexPart}`;
    }
    return `${functionName}-${indexPart}`;
};

const normalizeToolCallFunction = (toolCall: ToolCall): ToolCall['function'] => {
    const functionValue = toolCall.function;
    const functionObject = functionValue && typeof functionValue === 'object'
        ? functionValue
        : { name: '', arguments: '' };
    return {
        ...functionObject,
        name: typeof functionObject.name === 'string' ? functionObject.name : '',
        arguments: typeof functionObject.arguments === 'string' ? functionObject.arguments : '',
    };
};

const hasAnyToolCallPayload = (toolCall: ToolCall): boolean => {
    const functionValue = toolCall.function;
    const functionObject = functionValue && typeof functionValue === 'object'
        ? functionValue
        : { name: '', arguments: '' };
    const id = typeof toolCall.id === 'string' ? toolCall.id : '';
    const name = typeof functionObject.name === 'string' ? functionObject.name : '';
    const args = typeof functionObject.arguments === 'string' ? functionObject.arguments : '';
    return id.trim().length > 0 || name.trim().length > 0 || args.trim().length > 0;
};

const normalizeToolCallIdentity = (toolCall: ToolCall, options?: MergeToolCallOptions): ToolCall => {
    const normalizedFunction = normalizeToolCallFunction(toolCall);
    const normalizedId = typeof toolCall.id === 'string' && toolCall.id.trim().length > 0
        ? toolCall.id
        : buildFallbackToolCallId(toolCall, options);
    return {
        ...toolCall,
        id: normalizedId,
        type: 'function',
        function: normalizedFunction,
    };
};

export const mergeToolCalls = (
    currentToolCalls: ToolCall[],
    incomingToolCalls: ToolCall[],
    options: MergeToolCallOptions = {}
): ToolCall[] => {
    const mergedToolCalls = [...currentToolCalls];
    const allowIndexMatch = options.allowIndexMatch ?? true;

    for (const rawIncomingToolCall of incomingToolCalls) {
        if (!hasAnyToolCallPayload(rawIncomingToolCall)) {
            continue;
        }
        const incomingHadExplicitId = typeof rawIncomingToolCall.id === 'string' && rawIncomingToolCall.id.trim().length > 0;
        const incomingToolCall = normalizeToolCallIdentity(rawIncomingToolCall, options);
        const existingIndex = mergedToolCalls.findIndex(toolCall =>
            toolCall.id === incomingToolCall.id
            || (
                allowIndexMatch
                && incomingToolCall.index !== undefined
                && toolCall.index !== undefined
                && toolCall.index === incomingToolCall.index
            )
        );

        if (existingIndex === -1) {
            mergedToolCalls.push(incomingToolCall);
            continue;
        }

        const existingToolCall = normalizeToolCallIdentity(mergedToolCalls[existingIndex], options);
        mergedToolCalls[existingIndex] = {
            ...existingToolCall,
            ...incomingToolCall,
            id: incomingHadExplicitId ? incomingToolCall.id : existingToolCall.id,
            function: {
                ...existingToolCall.function,
                ...incomingToolCall.function,
                name: incomingToolCall.function.name || existingToolCall.function.name,
                arguments: (existingToolCall.function.arguments || '') + (incomingToolCall.function.arguments || ''),
            },
        };
    }

    return mergedToolCalls;
};

const createUniqueToolCallId = (baseId: string, usedIds: Set<string>): string => {
    if (!usedIds.has(baseId)) {
        return baseId;
    }
    let suffix = 1;
    let candidate = `${baseId}~${suffix}`;
    while (usedIds.has(candidate)) {
        suffix += 1;
        candidate = `${baseId}~${suffix}`;
    }
    return candidate;
};

export const mergeToolCallHistory = (historyToolCalls: ToolCall[], incomingToolCalls: ToolCall[]): ToolCall[] => {
    const mergedToolCalls = [...historyToolCalls];
    const usedIds = new Set(
        mergedToolCalls
            .map(toolCall => toolCall.id)
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    );

    for (const incomingToolCall of incomingToolCalls) {
        const normalizedIncoming = normalizeToolCallIdentity(incomingToolCall);
        const uniqueId = createUniqueToolCallId(normalizedIncoming.id, usedIds);
        usedIds.add(uniqueId);
        mergedToolCalls.push({
            ...normalizedIncoming,
            id: uniqueId,
        });
    }

    return mergedToolCalls;
};

export const formatMessageContent = (msg: Message): Message['content'] => {
    let content = msg.content;
    const text = typeof msg.content === 'string' ? msg.content : '';

    if (msg.images && msg.images.length > 0) {
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
        if (text) { contentParts.push({ type: 'text', text }); }
        for (const img of msg.images) { contentParts.push({ type: 'image_url', image_url: { url: img } }); }
        content = contentParts;
    }
    return content;
};

export const getPresetOptions = (appSettings: AppSettings | undefined, modelConfig: { presetId?: string }) => {
    const modelPresets = appSettings?.presets ?? [];
    const preset = modelPresets.find((p) => p.id === modelConfig.presetId);
    return preset ? {
        temperature: preset.temperature,
        top_p: preset.topP,
        frequency_penalty: preset.frequencyPenalty,
        presence_penalty: preset.presencePenalty,
        max_tokens: preset.maxTokens
    } : {};
};

const handleMetadataChunk = (chunk: StreamChunk): StreamChunkResult => {
    return { updated: true, newSources: chunk.sources ?? [] };
};

const handleReasoningChunk = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }, _streamStartTime: number): StreamChunkResult => {
    // Use chunk.reasoning if available, fallback to chunk.content for backwards compatibility
    const reasoningContent = chunk.reasoning ?? chunk.content ?? '';
    return { updated: true, newReasoning: current.reasoning + reasoningContent };
};

const handleImagesChunk = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }): StreamChunkResult => {
    const currentImages = current.images ?? [];
    const newImages = [...currentImages, ...(chunk.images ?? [])];
    return { updated: true, newImages };
};

const handleToolCallsChunk = (
    chunk: StreamChunk,
    current: { content: string, reasoning: string, sources: string[], images?: string[], toolCalls?: ToolCall[] },
    _streamStartTime: number,
    toolCallFallbackPrefix?: string
): StreamChunkResult => {
    const incomingToolCalls = chunk.tool_calls ?? [];
    return {
        updated: true,
        newToolCalls: mergeToolCalls(current.toolCalls ?? [], incomingToolCalls, {
            fallbackIdPrefix: toolCallFallbackPrefix,
            allowIndexMatch: true,
        }),
    };
};

const handleContentChunk = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }, streamStartTime: number): StreamChunkResult => {
    const newContent = current.content + (chunk.content ?? '');
    const elapsed = (performance.now() - streamStartTime) / 1000;
    const speed = elapsed > 0.5 ? (newContent.length / 4) / elapsed : null;
    return { updated: true, newContent, speed };
};

const handleUsageChunk = (chunk: StreamChunk): StreamChunkResult => {
    return { updated: true, usage: chunk.usage };
};

type ChunkHandler = (
    chunk: StreamChunk,
    current: { content: string, reasoning: string, sources: string[], images?: string[], toolCalls?: ToolCall[] },
    streamStartTime: number,
    toolCallFallbackPrefix?: string
) => StreamChunkResult;

const chunkHandlers: Record<string, ChunkHandler> = {
    metadata: handleMetadataChunk,
    reasoning: handleReasoningChunk,
    images: handleImagesChunk,
    tool_calls: handleToolCallsChunk,
    content: handleContentChunk,
    usage: handleUsageChunk,
};

export const processStreamChunk = (
    chunk: StreamChunk,
    current: { content: string, reasoning: string, sources: string[], images?: string[], toolCalls?: ToolCall[] },
    streamStartTime: number,
    defaultStreamError: string,
    toolCallFallbackPrefix?: string
): StreamChunkResult => {
    const chunkType = chunk.type;
    const hasToolCalls = Array.isArray(chunk.tool_calls) && chunk.tool_calls.length > 0;

    if (chunkType === 'error') {
        return { updated: true, streamError: chunk.content ?? defaultStreamError };
    }

    if (hasToolCalls) {
        return handleToolCallsChunk(chunk, current, streamStartTime, toolCallFallbackPrefix);
    }

    // Handle explicit type if present
    if (chunkType && chunkType in chunkHandlers) {
        const handler = chunkHandlers[chunkType];
        return handler(chunk, current, streamStartTime, toolCallFallbackPrefix);
    }

    // Handle chunks that have reasoning property but no explicit type (or type is undefined)
    // This handles OpenAI/OpenCode reasoning streams that send reasoning without a type field
    if (chunk.reasoning) {
        return handleReasoningChunk(chunk, current, streamStartTime);
    }

    // Default case: treat as content if there's content to append
    if (chunk.content) {
        return handleContentChunk(chunk, current, streamStartTime);
    }

    return { updated: false };
};

/** Categorize an error message into a known error kind */
export function categorizeError(message: string, model: string | null): ChatError {
    return normalizeChatError(message, model);
}
