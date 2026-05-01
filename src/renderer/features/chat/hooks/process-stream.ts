/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

const MAX_REASONING_SEGMENT_CONTENT = 60000;
const STREAM_LOG_PREVIEW_LENGTH = 140;

function buildLogPreview(value: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= STREAM_LOG_PREVIEW_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, STREAM_LOG_PREVIEW_LENGTH)}...`;
}

function buildStreamTraceId(chatId: string, assistantId: string): string {
    return `${chatId.slice(0, 8)}:${assistantId.slice(0, 8)}`;
}

function summarizeStreamingStateForLog(state: StreamStreamingState | undefined): string {
    if (!state) {
        return 'none';
    }
    const contentLen = typeof state.content === 'string' ? state.content.length : 0;
    const reasoningLen = typeof state.reasoning === 'string' ? state.reasoning.length : 0;
    const toolCallCount = Array.isArray(state.toolCalls) ? state.toolCalls.length : 0;
    const sourceCount = Array.isArray(state.sources) ? state.sources.length : 0;
    const variantCount = state.variants ? Object.keys(state.variants).length : 0;
    const hasError = Boolean(state.error);
    return `contentLen=${contentLen}, reasoningLen=${reasoningLen}, toolCalls=${toolCallCount}, sources=${sourceCount}, variants=${variantCount}, hasError=${String(hasError)}`;
}

function summarizeChunkForLog(chunk: StreamChunk): string {
    const chunkType = chunk.type ?? 'unknown';
    const chunkIndex = chunk.index ?? 0;
    const contentLength = typeof chunk.content === 'string' ? chunk.content.length : 0;
    const reasoningLength = typeof chunk.reasoning === 'string' ? chunk.reasoning.length : 0;
    const toolCallCount = Array.isArray(chunk.tool_calls) ? chunk.tool_calls.length : 0;
    const imageCount = Array.isArray(chunk.images) ? chunk.images.length : 0;
    const sourceCount = Array.isArray(chunk.sources) ? chunk.sources.length : 0;
    return `type=${chunkType}, index=${chunkIndex}, contentLen=${contentLength}, reasoningLen=${reasoningLength}, toolCalls=${toolCallCount}, images=${imageCount}, sources=${sourceCount}`;
}

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
    const hasMeaningfulExplicitReasoning = explicitReasoning.trim().length > 0;

    // If explicit reasoning is provided by the provider, use it and append any tag content if needed
    // However, usually providers use EITHER explicit reasoning property OR tags.
    if (hasMeaningfulExplicitReasoning && effectiveReasoning.length > 0) {
        appLogger.info(
            'processChatStream',
            `extractReasoning: using explicit reasoning len=${effectiveReasoning.length}, trim=${String(shouldTrim)}`
        );
        return effectiveReasoning;
    }

    return extractReasoningFromTags(content, options);
}

export function extractReasoningFromTags(
    content: string,
    options: { trim?: boolean } = {}
): string {
    const shouldTrim = options.trim ?? true;
    const normalize = (value: string): string => shouldTrim ? value.trim() : value;

    // Extract from <think> tags
    const thinkStart = content.toLowerCase().lastIndexOf('<think>');
    if (thinkStart !== -1) {
        const contentAfterStart = content.substring(thinkStart + 7);
        const thinkEnd = contentAfterStart.toLowerCase().indexOf('</think>');
        if (thinkEnd !== -1) {
            const extracted = normalize(contentAfterStart.substring(0, thinkEnd));
            appLogger.info('processChatStream', `extractReasoning: extracted <think> block len=${extracted.length}`);
            return extracted;
        }
        // Handle unclosed tag during streaming
        const extracted = normalize(contentAfterStart);
        appLogger.info('processChatStream', `extractReasoning: extracted unclosed <think> len=${extracted.length}`);
        return extracted;
    }

    // fallback to variants like <thinking>
    const thinkingStart = content.toLowerCase().lastIndexOf('<thinking>');
    if (thinkingStart !== -1) {
        const contentAfterStart = content.substring(thinkingStart + 10);
        const thinkingEnd = contentAfterStart.toLowerCase().indexOf('</thinking>');
        if (thinkingEnd !== -1) {
            const extracted = normalize(contentAfterStart.substring(0, thinkingEnd));
            appLogger.info('processChatStream', `extractReasoning: extracted <thinking> block len=${extracted.length}`);
            return extracted;
        }
        const extracted = normalize(contentAfterStart);
        appLogger.info('processChatStream', `extractReasoning: extracted unclosed <thinking> len=${extracted.length}`);
        return extracted;
    }

    appLogger.info('processChatStream', 'extractReasoning: no explicit reasoning or think tags found');
    return '';
}

export interface StreamStreamingState {
    content?: string
    reasoning?: string
    extractReasoning?: (content: string, reasoning: string) => string
    speed?: number | null
    sources?: string[]
    variants?: Record<string, { content: string; reasoning?: string }>
    toolCalls?: ToolCall[]
    error?: ChatError | null
}

export interface StreamResult {
    finalContent: string;
    finalReasoning: string;
    finalReasonings?: string[]; // Accumulated reasonings
    finalSources: string[];
    finalVariants: Record<string, { content: string; reasoning?: string }>;
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
    finalVariants: Record<string, { content: string; reasoning?: string }>;
    finalImages: string[];
}

interface ReasoningSegmentState {
    segments: string[];
    isClosed: boolean;
    processedReasoningLen: number;
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

const updateVariantsMap = (context: StateUpdateContext, finalVariants: Record<string, { content: string; reasoning?: string }>): void => {
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
    finalVariants: Record<string, { content: string; reasoning?: string }>;
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
        t('frontend.chat.streamError'),
        toolCallFallbackPrefix
    );
    return { index, result, current };
};

const getChatStateUpdateIntervalMs = (contentLength: number): number => {
    if (contentLength >= 60000) {
        return 180;
    }
    if (contentLength >= 12000) {
        return 120;
    }
    return 50;
};

const shouldUpdateChatsState = (now: number, lastSaveTime: number, contentLength: number): boolean => {
    return now - lastSaveTime >= getChatStateUpdateIntervalMs(contentLength);
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

const hasOpenReasoningTag = (content: string): boolean => {
    const latestThinkStart = content.toLowerCase().lastIndexOf('<think>');
    const latestThinkingStart = content.toLowerCase().lastIndexOf('<thinking>');
    const latestStart = Math.max(latestThinkStart, latestThinkingStart);
    if (latestStart === -1) {
        return false;
    }

    const closingTag = latestThinkingStart > latestThinkStart ? '</thinking>' : '</think>';
    return content.toLowerCase().indexOf(closingTag, latestStart) === -1;
};

const shouldCloseReasoningSegment = (chunk: StreamChunk, content: string): boolean =>
    (chunk.type === 'content'
        && typeof chunk.content === 'string'
        && chunk.content.trim().length > 0
        && !hasOpenReasoningTag(content))
    || chunk.type === 'tool_calls'
    || chunk.type === 'error'
    || (Array.isArray(chunk.tool_calls) && chunk.tool_calls.length > 0);

const truncateReasoningSegment = (value: string): string =>
    value.length <= MAX_REASONING_SEGMENT_CONTENT
        ? value
        : `${value.slice(0, MAX_REASONING_SEGMENT_CONTENT)}\n\n[Reasoning truncated by Tengra.]`;

const getVisibleReasoningSegment = (segments: string[]): string => {
    for (let index = segments.length - 1; index >= 0; index -= 1) {
        const segment = segments[index];
        if (segment && segment.trim().length > 0) {
            return segment;
        }
    }
    return '';
};

const getReasoningReplayPrefixLength = (segments: string[], reasoning: string): number => {
    const visibleSegments = segments.filter(segment => segment.trim().length > 0);
    if (visibleSegments.length === 0 || reasoning.length === 0) {
        return 0;
    }

    const replayCandidates = new Set<string>([
        visibleSegments[visibleSegments.length - 1],
        visibleSegments.join(''),
        visibleSegments.join('\n'),
    ]);

    let matchedPrefixLength = 0;
    for (const candidate of replayCandidates) {
        if (candidate.length > matchedPrefixLength && reasoning.startsWith(candidate)) {
            matchedPrefixLength = candidate.length;
        }
    }

    return matchedPrefixLength;
};

const appendReasoningSegment = (
    state: ReasoningSegmentState,
    reasoning: string,
    isAccumulated: boolean = true
): ReasoningSegmentState => {
    if (reasoning.length === 0) {
        return state;
    }
    if (reasoning.trim().length === 0 && state.segments.length === 0) {
        return state;
    }

    const segments = [...state.segments];
    let processedReasoningLen = state.processedReasoningLen;
    const isOpeningSegment = segments.length === 0 || state.isClosed;

    if (isOpeningSegment) {
        segments.push('');
        processedReasoningLen = isAccumulated
            ? getReasoningReplayPrefixLength(state.segments, reasoning)
            : 0;
    }

    const lastIndex = segments.length - 1;
    let contentToAppend = reasoning;

    if (isAccumulated && processedReasoningLen > 0 && reasoning.length >= processedReasoningLen) {
        contentToAppend = reasoning.slice(processedReasoningLen);
    }

    if (contentToAppend.length > 0) {
        segments[lastIndex] = truncateReasoningSegment(`${segments[lastIndex]}${contentToAppend}`);
    }

    if (isAccumulated) {
        processedReasoningLen = reasoning.length;
    }

    return { 
        segments, 
        isClosed: false, 
        processedReasoningLen 
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
            title = finalContent.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || t('frontend.sidebar.newChat');
        }
        return { ...c, title, messages: c.messages.map((m) => m.id === assistantId ? completedMsg : m), isGenerating: false };
    });
};

interface ProcessStreamChunkUpdatesParams {
    chunk: StreamChunk;
    index: number;
    finalVariants: Record<string, { content: string; reasoning?: string }>;
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
        reasoning: index === 0 ? finalReasoning : (finalVariants[index].reasoning ?? ''),
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
    onMessageUpdate?: (message: Message) => void
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
    finalVariants: Record<string, { content: string; reasoning?: string }>;
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
        const nextState = buildNewStreamingState(updateData, state);
        appLogger.info(
            'processChatStream',
            `[${chatId.slice(0, 8)}] streaming-state apply index=${index}, prev={${summarizeStreamingStateForLog(state)}}, next={${summarizeStreamingStateForLog(nextState)}}`
        );
        return { ...prev, [chatId]: nextState };
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
    selectedProvider: string;
    finalReasoning: string;
    finalVariants: Record<string, { content: string; reasoning?: string }>;
    finalSources: string[];
    finalImages: string[];
    finalToolCalls: ToolCall[];
    setChats: Dispatch<SetStateAction<Chat[]>>;
    queueDbSave: (options: SaveToDbOptions) => void;
    initialReasonings?: string[];
    reasoningSegments?: string[];
    initialToolCalls?: ToolCall[];
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    onMessageUpdate?: (message: Message) => void;
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
        selectedProvider,
        finalReasoning,
        finalVariants,
        finalSources,
        finalImages,
        finalToolCalls,
        setChats,
        queueDbSave,
        initialToolCalls,
        reasoningSegments,
        onMessageUpdate,
    } = params;

    const effectiveReasoning = finalReasoning.trim().length > 0
        ? finalReasoning
        : extractReasoning(finalContent, '', { trim: false });

    let updatedLastSaveTime = lastSaveTime;
    let updatedLastDbSaveTime = lastDbSaveTime;

    const currentReasonings = reasoningSegments && reasoningSegments.length > 0
        ? mergeReasoningSegments(params.initialReasonings, reasoningSegments)
        : mergeReasoningHistory(params.initialReasonings, effectiveReasoning);

    if (shouldUpdateChatsState(now, lastSaveTime, finalContent.length)) {
        updatedLastSaveTime = now;
        const mergedToolCalls = mergeToolCallHistory(initialToolCalls || [], finalToolCalls);
        appLogger.info(
            'processChatStream',
            `[${chatId.slice(0, 8)}] chat-state throttle-update contentLen=${finalContent.length}, reasoningLen=${effectiveReasoning.length}, mergedToolCalls=${mergedToolCalls.length}, reasonings=${currentReasonings?.length ?? 0}, intervalMs=${getChatStateUpdateIntervalMs(finalContent.length)}`
        );
        updateChatsState({
            setChats,
            chatId,
            assistantId,
            intentClassification,
            language,
            model: activeModel,
            provider: selectedProvider,
            content: finalContent,
            reasoning: effectiveReasoning,
            reasonings: currentReasonings,
            variants: finalVariants,
            sources: finalSources,
            images: finalImages,
            toolCalls: mergedToolCalls,
            onMessageUpdate,
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
    let providerReasoningBuffer = '';
    let finalReasoning = '';
    let finalSources: string[] = [];
    let finalImages: string[] = [];
    let finalToolCalls: ToolCall[] = [];
    let finalUsage: { promptTokens: number; completionTokens: number; totalTokens: number } = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const finalVariants: Record<string, { content: string; reasoning?: string }> = {};
    const toolCallFallbackPrefix = `${assistantId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    let lastSaveTime = Date.now();
    let lastDbSaveTime = Date.now();
    let pendingDbSave: Promise<void> | null = null;
    let queuedDbSave: SaveToDbOptions | null = null;
    let hasPrimaryContentChunk = false;
    let reasoningState: ReasoningSegmentState = { 
        segments: [...(initialReasonings ?? [])], 
        isClosed: Boolean(initialReasonings && initialReasonings.length > 0),
        processedReasoningLen: 0
    };
    const traceId = buildStreamTraceId(chatId, assistantId);
    let chunkCount = 0;

    appLogger.info(
        'processChatStream',
        `[${traceId}] stream-start model=${activeModel}, provider=${selectedProvider}, initialContentLen=${finalContent.length}, initialReasonings=${reasoningState.segments.length}`
    );

    const queueDbSave = (saveOptions: SaveToDbOptions): void => {
        if (pendingDbSave) {
            queuedDbSave = saveOptions;
            appLogger.info(
                'processChatStream',
                `[${traceId}] db-save queued while previous save in-flight contentLen=${saveOptions.content.length}, reasoningLen=${saveOptions.reasoning.length}`
            );
            return;
        }
        appLogger.info(
            'processChatStream',
            `[${traceId}] db-save start contentLen=${saveOptions.content.length}, reasoningLen=${saveOptions.reasoning.length}`
        );
        pendingDbSave = saveMessageToDb(saveOptions)
            .catch((error: RendererDataValue) => {
                const err = error instanceof Error ? error : new Error(String(error));
                appLogger.error('processChatStream', 'Failed to save streamed message', err);
            })
            .finally(() => {
                pendingDbSave = null;
                appLogger.info('processChatStream', `[${traceId}] db-save completed`);
                if (queuedDbSave) {
                    const nextSave = queuedDbSave;
                    queuedDbSave = null;
                    queueDbSave(nextSave);
                }
            });
    };

    // Process stream chunks
    for await (const chunk of stream) {
        chunkCount += 1;
        appLogger.info('processChatStream', `[${traceId}] chunk#${chunkCount} ${summarizeChunkForLog(chunk)}`);
        const isReasoningChunk = isReasoningStreamChunk(chunk);
        const iterationReasoning = isReasoningChunk && reasoningState.isClosed ? '' : providerReasoningBuffer;
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
            appLogger.info(
                'processChatStream',
                `[${traceId}] chunk#${chunkCount} updated index=${index}, hasContent=${result.newContent !== undefined}, hasReasoning=${typeof result.newReasoning === 'string'}, hasToolCalls=${Array.isArray(result.newToolCalls)}`
            );
            if (result.streamError && index === 0) {
                const suffix = buildStreamInterruptedSuffix(result.streamError);
                if (!finalContent.includes(suffix)) {
                    finalContent = `${finalContent}${suffix}`.trim();
                }
                appLogger.warn(
                    'processChatStream',
                    `[${traceId}] stream error appended to content error=${buildLogPreview(result.streamError)}`
                );
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
                providerReasoningBuffer = updates.finalReasoning;
                reasoningState = appendReasoningSegment(reasoningState, providerReasoningBuffer, true);
                finalReasoning = getVisibleReasoningSegment(reasoningState.segments);
                appLogger.info(
                    'processChatStream',
                    `[${traceId}] explicit reasoning update len=${providerReasoningBuffer.length}, visibleLen=${finalReasoning.length}, segments=${reasoningState.segments.length}, preview=${buildLogPreview(finalReasoning)}`
                );
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
                appLogger.info(
                    'processChatStream',
                    `[${traceId}] content update len=${finalContent.length}, preview=${buildLogPreview(finalContent)}`
                );
            }
            if (updates.finalImages) {
                finalImages = updates.finalImages;
            }
            if (updates.finalToolCalls) {
                finalToolCalls = updates.finalToolCalls;
                appLogger.info(
                    'processChatStream',
                    `[${traceId}] tool-calls update count=${finalToolCalls.length}`
                );
            }

            // Extract reasoning from content if not explicitly provided
            if (!updates.finalReasoning) {
                const newlyExtractedReasoning = extractReasoningFromTags(finalContent, { trim: false });
                if (newlyExtractedReasoning && newlyExtractedReasoning !== providerReasoningBuffer) {
                    providerReasoningBuffer = newlyExtractedReasoning;
                    reasoningState = appendReasoningSegment(reasoningState, providerReasoningBuffer, true);
                    finalReasoning = getVisibleReasoningSegment(reasoningState.segments);
                    appLogger.info(
                        'processChatStream',
                        `[${traceId}] tag reasoning update len=${providerReasoningBuffer.length}, visibleLen=${finalReasoning.length}, segments=${reasoningState.segments.length}, preview=${buildLogPreview(finalReasoning)}`
                    );
                } else {
                    providerReasoningBuffer = newlyExtractedReasoning;
                    finalReasoning = getVisibleReasoningSegment(reasoningState.segments);
                }
            } else {
                finalReasoning = getVisibleReasoningSegment(reasoningState.segments);
            }

            if (updates.finalReasoning) {
                appLogger.info(
                    'processChatStream',
                    `[${traceId}] visible reasoning sync len=${finalReasoning.length}, segments=${reasoningState.segments.length}, preview=${buildLogPreview(finalReasoning)}`
                );
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
        if (shouldCloseReasoningSegment(chunk, finalContent)) {
            reasoningState = { ...reasoningState, isClosed: true };
            appLogger.info(
                'processChatStream',
                `[${traceId}] reasoning-segment closed by chunkType=${chunk.type ?? 'unknown'}, totalSegments=${reasoningState.segments.length}`
            );
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
            selectedProvider,
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
            onMessageUpdate: options.onMessageUpdate,
        });
        lastSaveTime = throttleResult.lastSaveTime;
        lastDbSaveTime = throttleResult.lastDbSaveTime;
    }

    const pendingSave = pendingDbSave;
    if (pendingSave) {
        await Promise.resolve(pendingSave);
    }

    const effectiveFinalReasoning = finalReasoning.trim().length > 0
        ? finalReasoning
        : extractReasoning(finalContent, providerReasoningBuffer);

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

    if (options.onMessageUpdate) {
        options.onMessageUpdate(completedMsg);
    }

    if (autoReadEnabled && finalContent) { handleSpeak(assistantId, finalContent); }

    appLogger.info(
        'processChatStream',
        `[${traceId}] stream-finished chunks=${chunkCount}, finalContentLen=${finalContent.length}, finalReasoningLen=${effectiveFinalReasoning.length}, reasonings=${allReasonings?.length ?? 0}, toolCalls=${finalToolCalls.length}, usageTotal=${finalUsage.totalTokens}`
    );

    return { finalContent, finalReasoning: effectiveFinalReasoning, finalReasonings: allReasonings, finalSources, finalVariants, finalToolCalls, finalUsage };
};

const createVariantsArray = (assistantId: string, model: string, variantsMap: Record<string, { content: string; reasoning?: string }>) => {
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
    provider: string
    content: string
    reasoning: string
    reasonings?: string[]
    variants: Record<string, { content: string; reasoning?: string }>
    sources?: string[]
    images?: string[]
    toolCalls?: ToolCall[]
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
    onMessageUpdate?: (message: Message) => void
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
        provider,
        content,
        reasoning,
        reasonings,
        variants,
        toolCalls,
        usage,
    } = options;
    const buildStreamingMessage = (baseMessage?: Message): Message => {
        const currentVariants = createVariantsArray(assistantId, model, variants);
        return {
            ...baseMessage,
            id: assistantId,
            role: 'assistant' as const,
            content,
            reasoning: reasoning || undefined,
            reasonings,
            usage,
            variants: currentVariants.length > 1 ? currentVariants : undefined,
            ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
            timestamp: baseMessage?.timestamp ?? new Date(),
            provider: baseMessage?.provider ?? provider,
            model: baseMessage?.model ?? model,
        };
    };

    if (options.onMessageUpdate) {
        options.onMessageUpdate(buildStreamingMessage());
    }

    setChats(prev => updateChatById(prev, chatId, (chat) => {
        const updatedMsg = buildStreamingMessage(chat.messages.find(m => m.id === assistantId));
        return {
            ...chat,
            messages: updateMessageById(chat.messages, assistantId, () => updatedMsg)
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
    variants: Record<string, { content: string; reasoning?: string }>
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
    variants: Record<string, { content: string; reasoning?: string }>
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
