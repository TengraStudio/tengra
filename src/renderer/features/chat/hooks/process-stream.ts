import { Dispatch, SetStateAction } from 'react';

import { Chat, ChatError, Message, ToolCall } from '@/types';

import { categorizeError, processStreamChunk, StreamChunk, StreamChunkResult } from './utils';

export interface StreamStreamingState {
    content?: string
    reasoning?: string
    speed?: number | null
    sources?: string[]
    variants?: Record<number, { content: string; reasoning: string }>
    toolCalls?: ToolCall[]
    error?: ChatError | null
}

export interface StreamResult {
    finalContent: string;
    finalReasoning: string;
    finalSources: string[];
    finalVariants: Record<number, { content: string; reasoning: string }>;
    finalToolCalls: ToolCall[];
}

interface StateUpdateContext {
    index: number;
    chatId: string;
    result: StreamChunkResult;
    finalSources: string[];
    finalReasoning: string;
    finalContent: string;
    finalToolCalls: ToolCall[];
    finalVariants: Record<number, { content: string; reasoning: string }>;
    finalImages: string[];
}

interface StreamingStateUpdate extends Omit<StateUpdateContext, 'result'> {
    result: StreamChunkResult;
    activeModel?: string;
}

// Update handlers for variant data
interface UpdateHandlers {
    sources: (result: StreamChunkResult, state: StreamStreamingState, finalSources: string[]) => StreamStreamingState;
    reasoning: (result: StreamChunkResult, state: StreamStreamingState, finalReasoning: string) => StreamStreamingState;
    content: (result: StreamChunkResult, state: StreamStreamingState, finalContent: string, speed: number | null) => StreamStreamingState;
    toolCalls: (result: StreamChunkResult, state: StreamStreamingState, finalToolCalls: ToolCall[]) => StreamStreamingState;
}

const updateHandlers: UpdateHandlers = {
    sources: (result, state, finalSources) => {
        if (result.newSources) {
            return { ...state, sources: finalSources };
        }
        return state;
    },
    reasoning: (result, state, finalReasoning) => {
        if (result.newReasoning) {
            return { ...state, reasoning: finalReasoning };
        }
        return state;
    },
    content: (result, state, finalContent, speed) => {
        if (result.newContent !== undefined) {
            return { ...state, content: finalContent, speed: speed ?? null };
        }
        return state;
    },
    toolCalls: (result, state, finalToolCalls) => {
        if (result.newToolCalls) {
            return { ...state, toolCalls: finalToolCalls };
        }
        return state;
    }
};

const applyUpdateHandlers = (update: StreamingStateUpdate, state: StreamStreamingState, activeModel: string): StreamStreamingState => {
    const { result, finalSources, finalReasoning, finalContent, finalToolCalls } = update;
    let newState = updateHandlers.sources(result, state, finalSources);
    newState = updateHandlers.reasoning(result, newState, finalReasoning);
    newState = updateHandlers.content(result, newState, finalContent, result.speed ?? null);
    newState = updateHandlers.toolCalls(result, newState, finalToolCalls);

    if (result.streamError) {
        newState.error = categorizeError(result.streamError, activeModel);
    } else {
        newState.error = null;
    }

    return newState;
};

const updateVariantsMap = (context: StateUpdateContext, finalVariants: Record<number, { content: string; reasoning: string }>): void => {
    const { index, result } = context;

    if (result.newReasoning) {
        finalVariants[index].reasoning = result.newReasoning;
    }
    if (result.newContent !== undefined) {
        finalVariants[index].content = result.newContent;
    }
};

interface ChunkIterationParams {
    chunk: StreamChunk;
    finalVariants: Record<number, { content: string; reasoning: string }>;
    finalContent: string;
    finalReasoning: string;
    finalSources: string[];
    finalImages: string[];
    streamStartTime: number;
}

const processChunkIteration = (params: ChunkIterationParams): { index: number; result: StreamChunkResult; current: Record<string, string | string[]> } => {
    const { chunk, finalVariants, finalContent, finalReasoning, finalSources, finalImages, streamStartTime } = params;
    const index = chunk.index ?? 0;
    finalVariants[index] = finalVariants[index] ?? { content: '', reasoning: '' };
    const current = processStreamChunkUpdates({ chunk, index, finalVariants, finalContent, finalReasoning, finalSources, finalImages });
    const result = processStreamChunk(chunk, current, streamStartTime);
    return { index, result, current };
};

const shouldUpdateChatsState = (now: number, lastSaveTime: number): boolean => {
    return now - lastSaveTime >= 100;
};

const shouldSaveToDb = (now: number, lastDbSaveTime: number, finalContent: string): boolean => {
    return now - lastDbSaveTime >= 2000 && finalContent.length > 0;
};

interface UpdateChatTitlesParams {
    prev: Chat[];
    chatId: string;
    assistantId: string;
    completedMsg: Message;
    finalContent: string;
    t: (key: string) => string;
}

const updateChatTitles = (params: UpdateChatTitlesParams): Chat[] => {
    const { prev, chatId, assistantId, completedMsg, finalContent, t } = params;
    return prev.map((c) => {
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
    });
};

interface ProcessStreamChunkUpdatesParams {
    chunk: StreamChunk;
    index: number;
    finalVariants: Record<number, { content: string; reasoning: string }>;
    finalContent: string;
    finalReasoning: string;
    finalSources: string[];
    finalImages: string[];
}

const processStreamChunkUpdates = (params: ProcessStreamChunkUpdatesParams): {
    content: string;
    reasoning: string;
    sources: string[];
    images: string[];
} => {
    const { index, finalVariants, finalContent, finalReasoning, finalSources, finalImages } = params;
    return {
        content: index === 0 ? finalContent : finalVariants[index].content,
        reasoning: index === 0 ? finalReasoning : finalVariants[index].reasoning,
        sources: index === 0 ? finalSources : [],
        images: index === 0 ? finalImages : []
    };
};

const buildNewStreamingState = (update: StreamingStateUpdate, state: StreamStreamingState): StreamStreamingState => {
    const { index, finalVariants } = update;
    const existingVariants = state.variants ?? {};

    // Apply update handlers only for index 0 (primary variant)
    const updatedState = index === 0 ? applyUpdateHandlers(update, state, update.activeModel ?? '') : { ...state };

    // Update variants for this specific index
    updatedState.variants = {
        ...existingVariants,
        [index]: { content: finalVariants[index].content, reasoning: finalVariants[index].reasoning }
    };

    return updatedState;
};

export interface ProcessStreamOptions {
    stream: AsyncGenerator<StreamChunk, void, RendererDataValue>
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

const updateFinalValues = (
    index: number,
    result: StreamChunkResult
): Partial<{ finalSources: string[]; finalReasoning: string; finalContent: string; finalImages: string[]; finalToolCalls: ToolCall[] }> => {
    if (index !== 0) {
        return {};
    }
    const updates: Partial<{ finalSources: string[]; finalReasoning: string; finalContent: string; finalImages: string[]; finalToolCalls: ToolCall[] }> = {};
    if (result.newSources) { updates.finalSources = result.newSources; }
    if (result.newReasoning) { updates.finalReasoning = result.newReasoning; }
    if (result.newContent !== undefined) { updates.finalContent = result.newContent; }
    if (result.newImages) { updates.finalImages = result.newImages; }
    if (result.newToolCalls) { updates.finalToolCalls = result.newToolCalls; }
    return updates;
};

const buildStreamInterruptedSuffix = (errorMessage: string): string => {
    const trimmed = errorMessage.trim();
    const safe = trimmed.length > 180 ? `${trimmed.slice(0, 180)}...` : trimmed;
    return `\n\n[Stream interrupted: ${safe}]`;
};

const handleChunkUpdate = (params: {
    index: number;
    result: StreamChunkResult;
    chatId: string;
    finalSources: string[];
    finalReasoning: string;
    finalContent: string;
    finalToolCalls: ToolCall[];
    finalVariants: Record<number, { content: string; reasoning: string }>;
    finalImages: string[];
    activeModel: string;
    setStreamingStates: Dispatch<SetStateAction<Record<string, StreamStreamingState>>>;
}): void => {
    const { index, result, chatId, finalSources, finalReasoning, finalContent, finalToolCalls, finalVariants, finalImages, activeModel, setStreamingStates } = params;

    updateVariantsMap(
        { index, chatId, result, finalSources, finalReasoning, finalContent, finalToolCalls, finalVariants, finalImages },
        finalVariants
    );

    const updateData: StreamingStateUpdate = { index, chatId, result, finalSources, finalReasoning, finalContent, finalToolCalls, finalVariants, finalImages, activeModel };
    setStreamingStates((prev) => {
        const state = prev[chatId] ?? {};
        return { ...prev, [chatId]: buildNewStreamingState(updateData, state) };
    });
};

const handleThrottledUpdates = (params: {
    now: number;
    lastSaveTime: number;
    lastDbSaveTime: number;
    finalContent: string;
    chatId: string;
    assistantId: string;
    activeModel: string;
    finalReasoning: string;
    finalVariants: Record<number, { content: string; reasoning: string }>;
    setChats: Dispatch<SetStateAction<Chat[]>>;
    queueDbSave: (options: SaveToDbOptions) => void;
}): { lastSaveTime: number; lastDbSaveTime: number } => {
    const {
        now,
        lastSaveTime,
        lastDbSaveTime,
        finalContent,
        chatId,
        assistantId,
        activeModel,
        finalReasoning,
        finalVariants,
        setChats,
        queueDbSave,
    } = params;

    let updatedLastSaveTime = lastSaveTime;
    let updatedLastDbSaveTime = lastDbSaveTime;

    if (shouldUpdateChatsState(now, lastSaveTime)) {
        updatedLastSaveTime = now;
        updateChatsState({ setChats, chatId, assistantId, model: activeModel, content: finalContent, reasoning: finalReasoning, variants: finalVariants });
    }

    if (shouldSaveToDb(now, lastDbSaveTime, finalContent)) {
        updatedLastDbSaveTime = now;
        queueDbSave({
            assistantId,
            model: activeModel,
            content: finalContent,
            reasoning: finalReasoning,
            variants: finalVariants,
        });
    }

    return { lastSaveTime: updatedLastSaveTime, lastDbSaveTime: updatedLastDbSaveTime };
};

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
    const finalVariants: Record<number, { content: string; reasoning: string }> = {};

    let lastSaveTime = Date.now();
    let lastDbSaveTime = Date.now();
    let pendingDbSave: Promise<void> | null = null;
    let queuedDbSave: SaveToDbOptions | null = null;

    const queueDbSave = (saveOptions: SaveToDbOptions): void => {
        if (pendingDbSave) {
            queuedDbSave = saveOptions;
            return;
        }
        pendingDbSave = saveMessageToDb(saveOptions)
            .catch((error: RendererDataValue) => {
                const err = error instanceof Error ? error : new Error(String(error));
                window.electron.log.error('[processChatStream] Failed to save streamed message', err);
            })
            .finally(() => {
                pendingDbSave = null;
                if (queuedDbSave) {
                    const nextSave = queuedDbSave;
                    queuedDbSave = null;
                    queueDbSave(nextSave);
                }
            });
    };

    // Process stream chunks
    for await (const chunk of stream) {
        const { index, result } = processChunkIteration({
            chunk, finalVariants, finalContent, finalReasoning, finalSources, finalImages, streamStartTime
        });

        // Update state if chunk produced changes
        if (result.updated) {
            if (result.streamError && index === 0) {
                const suffix = buildStreamInterruptedSuffix(result.streamError);
                if (!finalContent.includes(suffix)) {
                    finalContent = `${finalContent}${suffix}`.trim();
                }
            }
            if (result.streamError) {
                // Also update one last time to capture the error in streaming state
                handleChunkUpdate({
                    index, result, chatId, finalSources, finalReasoning, finalContent, finalToolCalls, finalVariants, finalImages, activeModel, setStreamingStates
                });
                break;
            }

            const updates = updateFinalValues(index, result);
            if (updates.finalSources) {
                finalSources = updates.finalSources;
            }
            if (updates.finalReasoning) {
                finalReasoning = updates.finalReasoning;
            }
            if (updates.finalContent) {
                finalContent = updates.finalContent;
            }
            if (updates.finalImages) {
                finalImages = updates.finalImages;
            }
            if (updates.finalToolCalls) {
                finalToolCalls = updates.finalToolCalls;
            }

            handleChunkUpdate({
                index, result, chatId, finalSources, finalReasoning, finalContent, finalToolCalls, finalVariants, finalImages, activeModel, setStreamingStates
            });
        }

        // Throttled updates
        const now = Date.now();
        const throttleResult = handleThrottledUpdates({
            now,
            lastSaveTime,
            lastDbSaveTime,
            finalContent,
            chatId,
            assistantId,
            activeModel,
            finalReasoning,
            finalVariants,
            setChats,
            queueDbSave,
        });
        lastSaveTime = throttleResult.lastSaveTime;
        lastDbSaveTime = throttleResult.lastDbSaveTime;
    }

    const pendingSave = pendingDbSave;
    if (pendingSave) {
        await Promise.resolve(pendingSave);
    }

    // Final updates
    const responseTime = Math.round(performance.now() - streamStartTime);
    const completedMsg = createCompletedMessage({
        assistantId, provider: selectedProvider, model: activeModel, content: finalContent, reasoning: finalReasoning,
        sources: finalSources, images: finalImages, variants: finalVariants, responseTime, toolCalls: finalToolCalls
    });

    await saveMessageToDb({
        assistantId, model: activeModel, content: finalContent, reasoning: finalReasoning,
        variants: finalVariants, responseTime, sources: finalSources, images: finalImages, toolCalls: finalToolCalls
    });

    setChats((prev) => updateChatTitles({ prev, chatId, assistantId, completedMsg, finalContent, t }));

    if (autoReadEnabled && finalContent) { handleSpeak(assistantId, finalContent); }

    return { finalContent, finalReasoning, finalSources, finalVariants, finalToolCalls };
};

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

const updateMessageById = (
    messages: Message[],
    messageId: string,
    updater: (message: Message) => Message
): Message[] => {
    const messageIndex = messages.findIndex(message => message.id === messageId);
    if (messageIndex < 0) {
        return messages;
    }
    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = updater(messages[messageIndex]);
    return updatedMessages;
};

const updateChatById = (
    chats: Chat[],
    chatId: string,
    updater: (chat: Chat) => Chat
): Chat[] => {
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    if (chatIndex < 0) {
        return chats;
    }
    const updatedChats = [...chats];
    updatedChats[chatIndex] = updater(chats[chatIndex]);
    return updatedChats;
};

const updateChatsState = (options: UpdateChatsStateOptions) => {
    const { setChats, chatId, assistantId, model, content, reasoning, variants } = options;
    setChats(prev => updateChatById(prev, chatId, (chat) => {
        const currentVariants = createVariantsArray(assistantId, model, variants);
        return {
            ...chat,
            messages: updateMessageById(chat.messages, assistantId, (message) => ({
                ...message,
                content,
                reasoning: reasoning || undefined,
                variants: currentVariants.length > 1 ? currentVariants : undefined
            }))
        };
    }));
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
        reasoning: reasoning || undefined
    };
    if (responseTime !== undefined) { updates.responseTime = responseTime; }
    if (sources && sources.length > 0) { updates.sources = sources; }
    if (images && images.length > 0) { updates.images = images; }
    if (toolCalls && toolCalls.length > 0) { updates.toolCalls = toolCalls; }
    if (currentVariants.length > 1) { updates.variants = currentVariants; }
    await window.electron.db.updateMessage(assistantId, updates);
};

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
        id: assistantId, role: 'assistant', content, reasoning: reasoning || undefined,
        timestamp: new Date(), provider, model, responseTime, sources,
        images: images.length > 0 ? images : undefined,
        variants: completedVariants.length > 1 ? completedVariants : undefined,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined
    };
};
