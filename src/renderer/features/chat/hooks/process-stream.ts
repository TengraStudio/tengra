import { Dispatch, SetStateAction } from 'react';

import { Chat, Message, ToolCall } from '@/types';

import { processStreamChunk, StreamChunk } from './utils';

export interface StreamStreamingState {
    content?: string
    reasoning?: string
    speed?: number | null
    sources?: string[]
    variants?: Record<number, { content: string; reasoning: string }>
    toolCalls?: ToolCall[]
}

export interface StreamResult {
    finalContent: string;
    finalReasoning: string;
    finalSources: string[];
    finalVariants: Record<number, { content: string; reasoning: string }>;
    finalToolCalls: ToolCall[];
}

export interface ProcessStreamOptions {
    stream: AsyncGenerator<StreamChunk, void, unknown>
    chatId: string
    assistantId: string
    setStreamingStates: Dispatch<SetStateAction<Record<string, StreamStreamingState>>>
    setChats: Dispatch<SetStateAction<Chat[]>>
    streamStartTime: number
    activeModel: string
    selectedProvider: string
    t: (key: string) => string
    autoReadEnabled: boolean
    handleSpeak: (id: string, content: string) => void
}

export const processChatStream = async (options: ProcessStreamOptions): Promise<StreamResult> => {
    const {
        stream, chatId, assistantId, setStreamingStates, setChats, streamStartTime,
        activeModel, selectedProvider, t, autoReadEnabled, handleSpeak
    } = options;

    let finalContent = '';
    let finalReasoning = '';
    let finalSources: string[] = [];
    let finalImages: string[] = [];
    let finalToolCalls: ToolCall[] = [];
    const finalVariants: Record<number, { content: string, reasoning: string }> = {};

    let lastSaveTime = Date.now();
    let lastDbSaveTime = Date.now();

    for await (const chunk of stream) {
        const index = chunk.index ?? 0;

        // Ensure variant object exists
        if (!finalVariants[index]) { finalVariants[index] = { content: '', reasoning: '' }; }

        // Prepare current state for processing (for specific variant)
        const current = {
            content: index === 0 ? finalContent : finalVariants[index].content,
            reasoning: index === 0 ? finalReasoning : finalVariants[index].reasoning,
            sources: index === 0 ? finalSources : [],
            images: index === 0 ? finalImages : []
        };

        const result = processStreamChunk(chunk, current, streamStartTime);

        if (result.updated) {
            // Update local state variables
            if (index === 0) {
                if (result.newSources) { finalSources = result.newSources; }
                if (result.newReasoning) { finalReasoning = result.newReasoning; }
                if (result.newContent !== undefined) { finalContent = result.newContent; }
                if (result.newImages) { finalImages = result.newImages; }
                if (result.newToolCalls) { finalToolCalls = result.newToolCalls; }
            }

            // Update variants map
            if (result.newReasoning) { finalVariants[index].reasoning = result.newReasoning; }
            if (result.newContent !== undefined) { finalVariants[index].content = result.newContent; }

            // Trigger React State Update
            setStreamingStates((prev) => {
                const state = prev[chatId] ?? {};
                const existingVariants = state.variants ?? {};

                const newState: StreamStreamingState = { ...state };

                if (index === 0) {
                    if (result.newSources) { newState.sources = finalSources; }
                    if (result.newReasoning) { newState.reasoning = finalReasoning; }
                    if (result.newContent !== undefined) {
                        newState.content = finalContent;
                        newState.speed = result.speed ?? null;
                    }
                    if (result.newToolCalls) {
                        newState.toolCalls = finalToolCalls;
                    }
                }

                newState.variants = {
                    ...existingVariants,
                    [index]: {
                        content: finalVariants[index].content,
                        reasoning: finalVariants[index].reasoning
                    }
                };

                return { ...prev, [chatId]: newState };
            });
        }

        // Common update logic (throttled)
        const now = Date.now();
        if (now - lastSaveTime >= 100) {
            lastSaveTime = now;
            updateChatsState({ setChats, chatId, assistantId, model: activeModel, content: finalContent, reasoning: finalReasoning, variants: finalVariants });
        }

        if (now - lastDbSaveTime >= 2000 && finalContent) {
            lastDbSaveTime = now;
            void saveMessageToDb({ assistantId, model: activeModel, content: finalContent, reasoning: finalReasoning, variants: finalVariants });
        }
    }

    const responseTime = Math.round(performance.now() - streamStartTime);

    // Final save and update
    const completedMsg = createCompletedMessage({
        assistantId, provider: selectedProvider, model: activeModel, content: finalContent, reasoning: finalReasoning,
        sources: finalSources, images: finalImages, variants: finalVariants, responseTime, toolCalls: finalToolCalls
    });

    await saveMessageToDb({
        assistantId, model: activeModel, content: finalContent, reasoning: finalReasoning,
        variants: finalVariants, responseTime, sources: finalSources, images: finalImages, toolCalls: finalToolCalls
    });
    // ... (rest of the function omitted for brevity in thought, but I will include it)
    setChats((prev) => prev.map((c) => {
        if (c.id !== chatId) { return c; }
        let title = c.title;
        const isFirstResponse = c.messages.length <= 2;
        const userMessages = c.messages.filter(m => m.role === 'user');
        const firstUserContent = typeof userMessages[0]?.content === 'string' ? userMessages[0].content : '';
        const titleLooksLikeUserInput = c.title === firstUserContent.slice(0, 50);
        if ((isFirstResponse || titleLooksLikeUserInput) && finalContent) {
            title = finalContent.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || t('sidebar.newChat');
        }
        return { ...c, title, messages: c.messages.map((m) => m.id === assistantId ? completedMsg : m), isGenerating: false };
    }));

    if (autoReadEnabled && finalContent) { handleSpeak(assistantId, finalContent); }

    return { finalContent, finalReasoning, finalSources, finalVariants, finalToolCalls };
};

// Helpers to reduce complexity

const createVariantsArray = (assistantId: string, model: string, variantsMap: Record<number, { content: string; reasoning: string }>) => {
    return Object.entries(variantsMap).map(([idx, v]) => ({
        id: `${assistantId}-v${idx}`,
        content: v.content,
        model,
        timestamp: new Date(),
        isSelected: parseInt(idx, 10) === 0
    }));
};

interface UpdateChatsStateOptions {
    setChats: Dispatch<SetStateAction<Chat[]>>
    chatId: string
    assistantId: string
    model: string
    content: string
    reasoning: string
    variants: Record<number, { content: string; reasoning: string }>
}

const updateChatsState = (options: UpdateChatsStateOptions) => {
    const { setChats, chatId, assistantId, model, content, reasoning, variants } = options;
    setChats((prev) => prev.map((c) => c.id === chatId ? {
        ...c,
        messages: c.messages.map((m) => {
            if (m.id !== assistantId) { return m; }
            const currentVariants = createVariantsArray(assistantId, model, variants);
            return {
                ...m,
                content,
                reasoning: reasoning ?? undefined,
                variants: currentVariants.length > 1 ? currentVariants : undefined
            };
        })
    } : c));
};

interface SaveToDbOptions {
    assistantId: string
    model: string
    content: string
    reasoning: string
    variants: Record<number, { content: string; reasoning: string }>
    responseTime?: number
    sources?: string[]
    images?: string[]
    toolCalls?: ToolCall[]
}

const saveMessageToDb = async (options: SaveToDbOptions): Promise<void> => {
    const { assistantId, model, content, reasoning, variants, responseTime, sources, images, toolCalls } = options;
    const currentVariants = createVariantsArray(assistantId, model, variants);
    const updates: Partial<Message> = {
        content,
        reasoning: reasoning ?? undefined
    };
    if (responseTime !== undefined) { updates.responseTime = responseTime; }
    if (sources && sources.length > 0) { updates.sources = sources; }
    if (images && images.length > 0) { updates.images = images; }
    if (toolCalls && toolCalls.length > 0) { updates.toolCalls = toolCalls; }
    if (currentVariants.length > 1) { updates.variants = currentVariants; }
    await window.electron.db.updateMessage(assistantId, updates);
};
// ... (rest of the chunks for other interfaces)
interface CreateCompletedMessageOptions {
    assistantId: string
    provider: string
    model: string
    content: string
    reasoning: string
    sources: string[]
    images: string[]
    variants: Record<number, { content: string; reasoning: string }>
    responseTime: number
    toolCalls?: ToolCall[]
}

const createCompletedMessage = (options: CreateCompletedMessageOptions): Message => {
    const { assistantId, provider, model, content, reasoning, sources, images, variants, responseTime, toolCalls } = options;
    const completedVariants = createVariantsArray(assistantId, model, variants);
    return {
        id: assistantId, role: 'assistant', content, reasoning: reasoning ?? undefined,
        timestamp: new Date(), provider, model, responseTime, sources,
        images: images.length > 0 ? images : undefined,
        variants: completedVariants.length > 1 ? completedVariants : undefined,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined
    };
};
