import { AppSettings, ChatError, Message, ToolCall } from '@/types';

export interface StreamChunk {
    index?: number
    type?: string
    content?: string
    reasoning?: string
    sources?: string[]
    images?: string[]
    tool_calls?: ToolCall[]
    usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number }
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
}

const buildFallbackToolCallId = (toolCall: ToolCall): string => {
    const functionName = typeof toolCall.function?.name === 'string' && toolCall.function.name.trim().length > 0
        ? toolCall.function.name.trim()
        : 'tool';
    const indexPart = typeof toolCall.index === 'number' ? toolCall.index : 0;
    return `${functionName}-${indexPart}`;
};

const normalizeToolCallIdentity = (toolCall: ToolCall): ToolCall => {
    const normalizedId = typeof toolCall.id === 'string' && toolCall.id.trim().length > 0
        ? toolCall.id
        : buildFallbackToolCallId(toolCall);
    return {
        ...toolCall,
        id: normalizedId,
    };
};

const mergeToolCalls = (currentToolCalls: ToolCall[], incomingToolCalls: ToolCall[]): ToolCall[] => {
    const mergedToolCalls = [...currentToolCalls];

    for (const rawIncomingToolCall of incomingToolCalls) {
        const incomingHadExplicitId = typeof rawIncomingToolCall.id === 'string' && rawIncomingToolCall.id.trim().length > 0;
        const incomingToolCall = normalizeToolCallIdentity(rawIncomingToolCall);
        const existingIndex = mergedToolCalls.findIndex(toolCall =>
            toolCall.id === incomingToolCall.id
            || (
                incomingToolCall.index !== undefined
                && toolCall.index !== undefined
                && toolCall.index === incomingToolCall.index
            )
        );

        if (existingIndex === -1) {
            mergedToolCalls.push(incomingToolCall);
            continue;
        }

        const existingToolCall = normalizeToolCallIdentity(mergedToolCalls[existingIndex]);
        mergedToolCalls[existingIndex] = {
            ...existingToolCall,
            ...incomingToolCall,
            id: incomingHadExplicitId ? incomingToolCall.id : existingToolCall.id,
            function: {
                ...existingToolCall.function,
                ...incomingToolCall.function,
                name: incomingToolCall.function.name || existingToolCall.function.name,
                arguments: incomingToolCall.function.arguments || existingToolCall.function.arguments,
            },
        };
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

const handleErrorChunk = (chunk: StreamChunk): StreamChunkResult => {
    return { updated: true, streamError: chunk.content ?? 'Stream error' };
};

const handleReasoningChunk = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }): StreamChunkResult => {
    return { updated: true, newReasoning: current.reasoning + (chunk.content ?? '') };
};

const handleImagesChunk = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }): StreamChunkResult => {
    const currentImages = current.images ?? [];
    const newImages = [...currentImages, ...(chunk.images ?? [])];
    return { updated: true, newImages };
};

const handleToolCallsChunk = (
    chunk: StreamChunk,
    current: { content: string, reasoning: string, sources: string[], images?: string[], toolCalls?: ToolCall[] }
): StreamChunkResult => {
    const incomingToolCalls = chunk.tool_calls ?? [];
    return {
        updated: true,
        newToolCalls: mergeToolCalls(current.toolCalls ?? [], incomingToolCalls),
    };
};

const handleContentChunk = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }, streamStartTime: number): StreamChunkResult => {
    const newContent = current.content + (chunk.content ?? '');
    const elapsed = (performance.now() - streamStartTime) / 1000;
    const speed = elapsed > 0.5 ? (newContent.length / 4) / elapsed : null;
    return { updated: true, newContent, speed };
};

type ChunkHandler = (
    chunk: StreamChunk,
    current: { content: string, reasoning: string, sources: string[], images?: string[], toolCalls?: ToolCall[] },
    streamStartTime: number
) => StreamChunkResult;

const chunkHandlers: Record<string, ChunkHandler> = {
    metadata: handleMetadataChunk,
    error: handleErrorChunk,
    reasoning: handleReasoningChunk,
    images: handleImagesChunk,
    tool_calls: handleToolCallsChunk,
    content: handleContentChunk,
};

export const processStreamChunk = (
    chunk: StreamChunk,
    current: { content: string, reasoning: string, sources: string[], images?: string[], toolCalls?: ToolCall[] },
    streamStartTime: number
): StreamChunkResult => {
    const chunkType = chunk.type ?? 'content';

    if (chunkType in chunkHandlers) {
        const handler = chunkHandlers[chunkType];
        return handler(chunk, current, streamStartTime);
    }

    // Default case: treat as content if there's content to append
    if (!chunk.type && chunk.content) {
        return handleContentChunk(chunk, current, streamStartTime);
    }

    return { updated: false };
};

/** Categorize an error message into a known error kind */
export function categorizeError(message: string, model: string | null): ChatError {
    const lower = message.toLowerCase();

    if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429') || lower.includes('exceeded')) {
        return { kind: 'quota_exhausted', message, model };
    }
    if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('econnaborted')) {
        return { kind: 'timeout', message, model };
    }
    if (
        lower.includes('econnrefused') || lower.includes('enotfound')
        || lower.includes('unavailable') || lower.includes('503')
        || lower.includes('network') || lower.includes('connect')
    ) {
        return { kind: 'provider_unavailable', message, model };
    }
    return { kind: 'generic', message, model };
}
