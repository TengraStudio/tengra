import { AiIntentClassification } from '@shared/types/ai-runtime';
import { Dispatch, SetStateAction } from 'react';

import { Chat, ChatError, Message, ToolCall } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { buildAssistantPresentationMetadata } from './ai-runtime-chat.util';
import { evidenceStore } from './tool-evidence-store.util';
import {
    categorizeError,
    mergeToolCallHistory,
    processStreamChunk,
    StreamChunk,
    StreamChunkResult
} from './utils';

const MAX_STREAMED_MESSAGE_CONTENT = 180000;
const MAX_REASONING_SEGMENT_CONTENT = 60000;
const STREAM_CONTENT_TRUNCATION_NOTICE = '\n\n[Stream stopped: response exceeded Tengra safety limit.]';

/**
 * Robustly extracts reasoning/thought content from message content.
 * Handles both explicit reasoning property and <think> tags (including unclosed ones during streaming).
 */
export function extractReasoning(
    content: string,
    explicitReasoning: string,
    options: { trim?: boolean } = {}
): string {
    const shouldTrim = options.trim ?? true;
    const normalize = (value: string): string => shouldTrim ? value.trim() : value;
    const effectiveReasoning = normalize(explicitReasoning);

    // If explicit reasoning is provided by the provider, use it and append any tag content if needed
    // However, usually providers use EITHER explicit reasoning property OR tags.
    if (effectiveReasoning.length > 0) {
        return effectiveReasoning;
    }

    // Extract from <think> tags
    const thinkStart = content.toLowerCase().indexOf('<think>');
    if (thinkStart !== -1) {
        const contentAfterStart = content.substring(thinkStart + 7);
        const thinkEnd = contentAfterStart.toLowerCase().indexOf('</think>');
        if (thinkEnd !== -1) {
            return normalize(contentAfterStart.substring(0, thinkEnd));
        }
        // Handle unclosed tag during streaming
        return normalize(contentAfterStart);
    }

    // fallback to variants like <thinking>
    const thinkingStart = content.toLowerCase().indexOf('<thinking>');
    if (thinkingStart !== -1) {
        const contentAfterStart = content.substring(thinkingStart + 10);
        const thinkingEnd = contentAfterStart.toLowerCase().indexOf('</thinking>');
        if (thinkingEnd !== -1) {
            return normalize(contentAfterStart.substring(0, thinkingEnd));
        }
        return normalize(contentAfterStart);
    }

    return '';
}

export interface StreamStreamingState {
    content?: string
    reasoning?: string
    extractReasoning?: (content: string, reasoning: string) => string
    speed?: number | null
    sources?: string[]
    variants?: Record<number, { content: string; reasoning: string }>
    toolCalls?: ToolCall[]
    error?: ChatError | null
}

export interface StreamResult {
    finalContent: string;
    finalReasoning: string;
    finalReasonings?: string[]; // Accumulated reasonings
    finalSources: string[];
    finalVariants: Record<number, { content: string; reasoning: string }>;
    finalToolCalls: ToolCall[];
    finalUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
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

interface ReasoningSegmentState {
    segments: string[];
    isClosed: boolean;
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
        if (result.newReasoning || result.newContent !== undefined) {
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
    finalToolCalls: ToolCall[];
    streamStartTime: number;
    toolCallFallbackPrefix: string;
    t: (key: string) => string;
}

const processChunkIteration = (params: ChunkIterationParams): {
    index: number;
    result: StreamChunkResult;
    current: { content: string; reasoning: string; sources: string[]; images: string[]; toolCalls: ToolCall[] };
} => {
    const {
        chunk,
        finalVariants,
        finalContent,
        finalReasoning,
        finalSources,
        finalImages,
        finalToolCalls,
        streamStartTime,
        toolCallFallbackPrefix,
        t
    } = params;
    const index = chunk.index ?? 0;
    finalVariants[index] = finalVariants[index] ?? { content: '', reasoning: '' };
    const current = processStreamChunkUpdates({
        chunk,
        index,
        finalVariants,
        finalContent,
        finalReasoning,
        finalSources,
        finalImages,
        finalToolCalls,
    });
    const result = processStreamChunk(
        chunk,
        current,
        streamStartTime,
        t('chat.streamError'),
        toolCallFallbackPrefix
    );
    return { index, result, current };
};

const shouldUpdateChatsState = (now: number, lastSaveTime: number): boolean => {
    return now - lastSaveTime >= 50;
};

const shouldSaveToDb = (now: number, lastDbSaveTime: number, finalContent: string): boolean => {
    return now - lastDbSaveTime >= 2000 && finalContent.length > 0;
};

const mergeReasoningHistory = (
    previousReasonings: string[] | undefined,
    latestReasoning: string
): string[] | undefined => {
    const baseReasonings = (previousReasonings ?? [])
        .filter(reasoning => typeof reasoning === 'string' && reasoning.trim().length > 0);
    if (latestReasoning.trim().length === 0) {
        return baseReasonings.length > 0 ? baseReasonings : undefined;
    }
    const latestBase = baseReasonings.length > 0 ? baseReasonings[baseReasonings.length - 1] : undefined;
    if (latestBase?.trim() === latestReasoning.trim()) {
        return baseReasonings;
    }
    return [...baseReasonings, latestReasoning];
};

const mergeReasoningSegments = (
    previousReasonings: string[] | undefined,
    currentSegments: string[]
): string[] | undefined => {
    const merged: string[] = [];
    const addSegment = (segment: string): void => {
        if (segment.trim().length === 0) {
            return;
        }
        const lastSegment = merged[merged.length - 1];
        if (lastSegment?.trim() === segment.trim()) {
            return;
        }
        merged.push(segment);
    };

    for (const segment of previousReasonings ?? []) {
        addSegment(segment);
    }
    for (const segment of currentSegments) {
        addSegment(segment);
    }

    return merged.length > 0 ? merged : undefined;
};

const isReasoningStreamChunk = (chunk: StreamChunk): boolean =>
    chunk.type === 'reasoning' || typeof chunk.reasoning === 'string';

const shouldCloseReasoningSegment = (chunk: StreamChunk): boolean =>
    chunk.type === 'content' || chunk.type === 'tool_calls' || chunk.type === 'error';

const truncateReasoningSegment = (value: string): string =>
    value.length <= MAX_REASONING_SEGMENT_CONTENT
        ? value
        : `${value.slice(0, MAX_REASONING_SEGMENT_CONTENT)}\n\n[Reasoning truncated by Tengra.]`;

const appendReasoningSegment = (
    state: ReasoningSegmentState,
    reasoning: string
): ReasoningSegmentState => {
    if (reasoning.length === 0) {
        return state;
    }
    const segments = [...state.segments];
    if (segments.length === 0 || state.isClosed) {
        segments.push('');
    }
    const lastIndex = segments.length - 1;
    segments[lastIndex] = truncateReasoningSegment(reasoning);
    return { segments, isClosed: false };
};

const clampStreamedContent = (content: string): { content: string; truncated: boolean } => {
    if (content.length <= MAX_STREAMED_MESSAGE_CONTENT) {
        return { content, truncated: false };
    }
    const availableLength = Math.max(0, MAX_STREAMED_MESSAGE_CONTENT - STREAM_CONTENT_TRUNCATION_NOTICE.length);
    return {
        content: `${content.slice(0, availableLength)}${STREAM_CONTENT_TRUNCATION_NOTICE}`,
        truncated: true,
    };
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
    finalToolCalls: ToolCall[];
}

const processStreamChunkUpdates = (params: ProcessStreamChunkUpdatesParams): {
    content: string;
    reasoning: string;
    sources: string[];
    images: string[];
    toolCalls: ToolCall[];
} => {
    const { index, finalVariants, finalContent, finalReasoning, finalSources, finalImages, finalToolCalls } = params;
    return {
        content: index === 0 ? finalContent : finalVariants[index].content,
        reasoning: index === 0 ? finalReasoning : finalVariants[index].reasoning,
        sources: index === 0 ? finalSources : [],
        images: index === 0 ? finalImages : [],
        toolCalls: index === 0 ? finalToolCalls : []
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
    intentClassification: AiIntentClassification
    language?: string
    setStreamingStates: Dispatch<SetStateAction<Record<string, StreamStreamingState>>>
    setChats: Dispatch<SetStateAction<Chat[]>>
    streamStartTime: number
    activeModel: string
    selectedProvider: string
    t: (key: string) => string
    autoReadEnabled: boolean
    handleSpeak: (id: string, content: string) => void
    initialReasonings?: string[]
    initialContent?: string
    initialToolCalls?: ToolCall[]
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
    intentClassification: AiIntentClassification;
    language?: string;
    activeModel: string;
    finalReasoning: string;
    finalVariants: Record<number, { content: string; reasoning: string }>;
    finalSources: string[];
    finalImages: string[];
    finalToolCalls: ToolCall[];
    setChats: Dispatch<SetStateAction<Chat[]>>;
    queueDbSave: (options: SaveToDbOptions) => void;
    initialReasonings?: string[];
    reasoningSegments?: string[];
    initialToolCalls?: ToolCall[];
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}): { lastSaveTime: number; lastDbSaveTime: number } => {
    const {
        now,
        lastSaveTime,
        lastDbSaveTime,
        finalContent,
        chatId,
        assistantId,
        intentClassification,
        language,
        activeModel,
        finalReasoning,
        finalVariants,
        finalSources,
        finalImages,
        finalToolCalls,
        setChats,
        queueDbSave,
        initialToolCalls,
        reasoningSegments,
    } = params;

    const effectiveReasoning = extractReasoning(finalContent, finalReasoning, { trim: false });

    let updatedLastSaveTime = lastSaveTime;
    let updatedLastDbSaveTime = lastDbSaveTime;

    const currentReasonings = reasoningSegments && reasoningSegments.length > 0
        ? mergeReasoningSegments(params.initialReasonings, reasoningSegments)
        : mergeReasoningHistory(params.initialReasonings, effectiveReasoning);

    if (shouldUpdateChatsState(now, lastSaveTime)) {
        updatedLastSaveTime = now;
        updateChatsState({
            setChats,
            chatId,
            assistantId,
            intentClassification,
            language,
            model: activeModel,
            content: finalContent,
            reasoning: effectiveReasoning,
            reasonings: currentReasonings,
            variants: finalVariants,
            sources: finalSources,
            images: finalImages,
            toolCalls: mergeToolCallHistory(initialToolCalls || [], finalToolCalls),
        });
    }

    if (shouldSaveToDb(now, lastDbSaveTime, finalContent)) {
        updatedLastDbSaveTime = now;
        queueDbSave({
            assistantId,
            intentClassification,
            language,
            model: activeModel,
            content: finalContent,
            reasoning: effectiveReasoning,
            reasonings: currentReasonings,
            variants: finalVariants,
            sources: finalSources,
            images: finalImages,
            toolCalls: mergeToolCallHistory(initialToolCalls || [], finalToolCalls),
            usage: params.usage,
        });
    }

    return { lastSaveTime: updatedLastSaveTime, lastDbSaveTime: updatedLastDbSaveTime };
};

export const processChatStream = async (options: ProcessStreamOptions): Promise<StreamResult> => {
    const {
        stream, chatId, assistantId, intentClassification, language, setStreamingStates, setChats, streamStartTime,
        activeModel, selectedProvider, t, autoReadEnabled, handleSpeak, initialReasonings, initialContent
    } = options;

    let finalContent = typeof initialContent === 'string' ? initialContent : '';
    let finalReasoning = '';
    let finalSources: string[] = [];
    let finalImages: string[] = [];
    let finalToolCalls: ToolCall[] = [];
    let finalUsage: { promptTokens: number; completionTokens: number; totalTokens: number } = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const finalVariants: Record<number, { content: string; reasoning: string }> = {};
    const toolCallFallbackPrefix = `${assistantId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    let lastSaveTime = Date.now();
    let lastDbSaveTime = Date.now();
    let pendingDbSave: Promise<void> | null = null;
    let queuedDbSave: SaveToDbOptions | null = null;
    let hasPrimaryContentChunk = false;
    let streamContentTruncated = false;
    let reasoningState: ReasoningSegmentState = { 
        segments: [...(initialReasonings ?? [])], 
        isClosed: Boolean(initialReasonings && initialReasonings.length > 0)
    };

    const queueDbSave = (saveOptions: SaveToDbOptions): void => {
        if (pendingDbSave) {
            queuedDbSave = saveOptions;
            return;
        }
        pendingDbSave = saveMessageToDb(saveOptions)
            .catch((error: RendererDataValue) => {
                const err = error instanceof Error ? error : new Error(String(error));
                appLogger.error('processChatStream', 'Failed to save streamed message', err);
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
        const isReasoningChunk = isReasoningStreamChunk(chunk);
        const iterationReasoning = isReasoningChunk && reasoningState.isClosed ? '' : finalReasoning;
        const { index, result } = processChunkIteration({
            chunk,
            finalVariants,
            finalContent,
            finalReasoning: iterationReasoning,
            finalSources,
            finalImages,
            finalToolCalls,
            streamStartTime,
            toolCallFallbackPrefix,
            t
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
                reasoningState = appendReasoningSegment(reasoningState, finalReasoning);
            }
            if (updates.finalContent !== undefined) {
                if (!hasPrimaryContentChunk) {
                    hasPrimaryContentChunk = true;
                    finalContent = typeof chunk.content === 'string'
                        ? chunk.content
                        : updates.finalContent;
                } else {
                    finalContent = updates.finalContent;
                }
                const clamped = clampStreamedContent(finalContent);
                finalContent = clamped.content;
                streamContentTruncated = streamContentTruncated || clamped.truncated;
            }
            if (updates.finalImages) {
                finalImages = updates.finalImages;
            }
            if (updates.finalToolCalls) {
                finalToolCalls = updates.finalToolCalls;
            }

            // Extract reasoning from content if not explicitly provided
            finalReasoning = extractReasoning(finalContent, updates.finalReasoning || finalReasoning, { trim: false });
            if (updates.finalReasoning) {
                reasoningState = appendReasoningSegment(reasoningState, finalReasoning);
            }

            if (result.usage) {
                finalUsage = {
                    promptTokens: result.usage.prompt_tokens,
                    completionTokens: result.usage.completion_tokens,
                    totalTokens: result.usage.total_tokens,
                };
            }

            handleChunkUpdate({
                index, result, chatId, finalSources, finalReasoning, finalContent, finalToolCalls, finalVariants, finalImages, activeModel, setStreamingStates
            });
        }
        if (shouldCloseReasoningSegment(chunk)) {
            reasoningState = { ...reasoningState, isClosed: true };
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
            intentClassification,
            language,
            activeModel,
            finalReasoning,
            finalVariants,
            finalSources,
            finalImages,
            finalToolCalls,
            setChats,
            queueDbSave,
            initialReasonings,
            reasoningSegments: reasoningState.segments,
            initialToolCalls: options.initialToolCalls,
            usage: finalUsage,
        });
        lastSaveTime = throttleResult.lastSaveTime;
        lastDbSaveTime = throttleResult.lastDbSaveTime;
        if (streamContentTruncated) {
            break;
        }
    }

    const pendingSave = pendingDbSave;
    if (pendingSave) {
        await Promise.resolve(pendingSave);
    }

    const effectiveFinalReasoning = extractReasoning(finalContent, finalReasoning);

    const allReasonings = mergeReasoningSegments(
        initialReasonings,
        reasoningState.segments.length > 0 ? reasoningState.segments : [effectiveFinalReasoning]
    );

    const allToolCalls = mergeToolCallHistory(options.initialToolCalls || [], finalToolCalls);

    // Final updates
    const responseTime = Math.round(performance.now() - streamStartTime);
    const completedMsg = createCompletedMessage({
        assistantId, intentClassification, language, provider: selectedProvider, model: activeModel, content: finalContent, reasoning: effectiveFinalReasoning,
        reasonings: allReasonings,
        sources: finalSources, images: finalImages, variants: finalVariants, responseTime, toolCalls: allToolCalls
    });

    await saveMessageToDb({
        assistantId, intentClassification, language, model: activeModel, content: finalContent, reasoning: effectiveFinalReasoning,
        reasonings: allReasonings,
        variants: finalVariants, responseTime, sources: finalSources, images: finalImages, toolCalls: allToolCalls,
        usage: finalUsage,
    });

    setChats((prev) => updateChatTitles({ prev, chatId, assistantId, completedMsg, finalContent, t }));

    if (autoReadEnabled && finalContent) { handleSpeak(assistantId, finalContent); }

    return { finalContent, finalReasoning: effectiveFinalReasoning, finalReasonings: allReasonings, finalSources, finalVariants, finalToolCalls, finalUsage };
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
    intentClassification: AiIntentClassification
    language?: string
    model: string
    content: string
    reasoning: string
    reasonings?: string[]
    variants: Record<number, { content: string; reasoning: string }>
    sources?: string[]
    images?: string[]
    toolCalls?: ToolCall[]
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
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

const updateChatsState = (options: UpdateChatsStateOptions): void => {
    const {
        setChats,
        chatId,
        assistantId,
        model,
        content,
        reasoning,
        reasonings,
        variants,
        toolCalls,
        usage,
    } = options;
    setChats(prev => updateChatById(prev, chatId, (chat) => {
        const currentVariants = createVariantsArray(assistantId, model, variants);
        return {
            ...chat,
            messages: updateMessageById(chat.messages, assistantId, (message) => ({
                ...message,
                content,
                reasoning: reasoning || undefined,
                reasonings,
                usage,
                variants: currentVariants.length > 1 ? currentVariants : undefined,
                ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
            }))
        };
    }));
};

interface SaveToDbOptions {
    assistantId: string
    intentClassification: AiIntentClassification
    language?: string
    model: string
    content: string
    reasoning: string
    reasonings?: string[]
    variants: Record<number, { content: string; reasoning: string }>
    responseTime?: number
    sources?: string[]
    images?: string[]
    toolCalls?: ToolCall[]
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

const saveMessageToDb = async (options: SaveToDbOptions): Promise<void> => {
    const { assistantId, intentClassification, language, model, content, reasoning, reasonings, variants, responseTime, sources, images, toolCalls } = options;
    const currentVariants = createVariantsArray(assistantId, model, variants);
    const updates: Partial<Message> = {
        content,
        reasoning: reasoning || undefined,
        reasonings,
        metadata: buildAssistantPresentationMetadata({
            intent: intentClassification,
            content,
            reasoning,
            reasonings,
            sources,
            images,
            toolCalls,
            isStreaming: false,
            language,
            evidenceSnapshot: evidenceStore.getSnapshot(),
        }),
    };
    if (responseTime !== undefined) { updates.responseTime = responseTime; }
    if (sources && sources.length > 0) { updates.sources = sources; }
    if (images && images.length > 0) { updates.images = images; }
    if (toolCalls && toolCalls.length > 0) { updates.toolCalls = toolCalls; }
    if (options.usage) { updates.usage = options.usage; }
    if (currentVariants.length > 1) { updates.variants = currentVariants; }
    await window.electron.db.updateMessage(assistantId, updates);
};

interface CreateCompletedMessageOptions {
    assistantId: string
    intentClassification: AiIntentClassification
    language?: string
    provider: string
    model: string
    content: string
    reasoning: string
    sources: string[]
    images: string[]
    variants: Record<number, { content: string; reasoning: string }>
    responseTime: number
    toolCalls?: ToolCall[]
    reasonings?: string[]
    usage?: { promptTokens: number, completionTokens: number, totalTokens: number }
}

const createCompletedMessage = (options: CreateCompletedMessageOptions): Message => {
    const { assistantId, intentClassification, language, provider, model, content, reasoning, sources, images, variants, responseTime, toolCalls, reasonings } = options;
    const completedVariants = createVariantsArray(assistantId, model, variants);
    return {
        id: assistantId, role: 'assistant', content, reasoning: reasoning || undefined,
        reasonings,
        timestamp: new Date(), provider, model, responseTime, sources,
        metadata: buildAssistantPresentationMetadata({
            intent: intentClassification,
            content,
            reasoning,
            reasonings,
            sources,
            images,
            toolCalls,
            language,
            evidenceSnapshot: evidenceStore.getSnapshot(),
        }),
        images: images.length > 0 ? images : undefined,
        variants: completedVariants.length > 1 ? completedVariants : undefined,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        usage: options.usage,
    };
};
