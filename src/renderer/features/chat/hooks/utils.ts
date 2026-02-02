import { AppSettings, Message, ToolCall } from '@/types';

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
    speed?: number | null
}

export const formatMessageContent = (msg: Message): Message['content'] => {
    let content = msg.content;
    const text = typeof msg.content === 'string' ? msg.content : '';

    if (msg.images && msg.images.length > 0) {
        const contentParts: Array<{ type: string, text?: string, image_url?: { url: string } }> = [];
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
    throw new Error(chunk.content);
};

const handleReasoningChunk = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }): StreamChunkResult => {
    return { updated: true, newReasoning: current.reasoning + (chunk.content ?? '') };
};

const handleImagesChunk = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }): StreamChunkResult => {
    const currentImages = current.images ?? [];
    const newImages = [...currentImages, ...(chunk.images ?? [])];
    return { updated: true, newImages };
};

const handleToolCallsChunk = (chunk: StreamChunk): StreamChunkResult => {
    return { updated: true, newToolCalls: chunk.tool_calls };
};

const handleContentChunk = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }, streamStartTime: number): StreamChunkResult => {
    const newContent = current.content + (chunk.content ?? '');
    const elapsed = (performance.now() - streamStartTime) / 1000;
    const speed = elapsed > 0.5 ? (newContent.length / 4) / elapsed : null;
    return { updated: true, newContent, speed };
};

type ChunkHandler = (chunk: StreamChunk, current: { content: string, reasoning: string, sources: string[], images?: string[] }, streamStartTime: number) => StreamChunkResult;

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
    current: { content: string, reasoning: string, sources: string[], images?: string[] },
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
