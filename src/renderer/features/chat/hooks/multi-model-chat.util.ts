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

import { chatStream } from '@/lib/chat-stream';
import { AppSettings, Chat, Message, ToolDefinition } from '@/types';
import { CatchError } from '@/types/common';

import { buildAssistantPresentationMetadata } from './ai-runtime-chat.util';

interface SelectedModelInfo {
    provider: string;
    model: string;
}

interface PrepareMessagesResult {
    allMessages: Message[];
    presetOptions: Record<string, RendererDataValue>;
}

interface ModelStreamResult {
    model: string;
    provider: string;
    content: string;
    reasoning?: string;
    responseTime?: number;
    error?: string;
}

interface ChatStreamChunk {
    content?: string;
    reasoning?: string;
}

import { 
    getChatSnapshot, 
    updateChatInStore, 
    updateStreamingState
} from '@/store/chat.store';

interface GenerateMultiModelResponseParams {
    chatId: string;
    assistantId: string;
    userMessage: Message;
    models: SelectedModelInfo[];
    allTools: ToolDefinition[];
    chats: Chat[];
    appSettings: AppSettings | undefined;
    language: string;
    selectedPersona: { id: string; name: string; description: string; prompt: string } | null | undefined;
    activeWorkspacePath: string | undefined;
    workspaceId: string | undefined;
    autoReadEnabled: boolean;
    handleSpeak: (id: string, content: string) => void;
    t: (key: string) => string;
    formatChatError: (err: CatchError) => string;
    systemMode: 'thinking' | 'agent' | 'fast';
    intentClassification: AiIntentClassification;
    getReasoningEffort: (modelId: string, appSettings: AppSettings | undefined) => string | undefined;
    createModelToolList: (allTools: ToolDefinition[]) => ToolDefinition[];
    prepareMessages: (options: {
        chatId: string;
        chats: Chat[];
        userMessage: Message;
        appSettings: AppSettings | undefined;
        selectedModel: string;
        selectedProvider: string;
        language: string;
        selectedPersona?: { id: string; name: string; description: string; prompt: string } | null | undefined;
        activeWorkspacePath?: string | undefined;
        systemMode: 'thinking' | 'agent' | 'fast';
    }) => PrepareMessagesResult;
}

interface HandleModelStreamIterationParams {
    stream: AsyncIterable<ChatStreamChunk>;
    chatId: string;
    assistantId: string;
    index: number;
    modelInfo: SelectedModelInfo;
    intentClassification: AiIntentClassification;
    language: string;
    streamStartTime: number;
}

interface FinalizeMultiModelResponseParams {
    results: ModelStreamResult[];
    chatId: string;
    assistantId: string;
    streamStartTime: number;
    autoReadEnabled: boolean;
    handleSpeak: (id: string, content: string) => void;
    language: string;
    t: (key: string) => string;
    intentClassification: AiIntentClassification;
}

export async function generateMultiModelResponse(params: GenerateMultiModelResponseParams): Promise<void> {
    const {
        chatId,
        assistantId,
        userMessage,
        models,
        allTools,
        chats,
        appSettings,
        language,
        selectedPersona,
        activeWorkspacePath,
        workspaceId,
        autoReadEnabled,
        handleSpeak,
        t,
        formatChatError,
        systemMode,
        intentClassification,
        getReasoningEffort,
        createModelToolList,
        prepareMessages,
    } = params;

    const streamStartTime = performance.now();
    const results = await Promise.all(models.map(async (modelInfo, index) => {
        const streamId = `${chatId}-model-${index}-${Date.now()}`;
        try {
            const { allMessages, presetOptions } = prepareMessages({
                chatId,
                chats,
                userMessage,
                appSettings,
                selectedModel: modelInfo.model,
                selectedProvider: modelInfo.provider,
                language,
                selectedPersona,
                activeWorkspacePath,
                systemMode,
            });
            const reasoningEffort = getReasoningEffort(modelInfo.model, appSettings);
            const tools = systemMode === 'agent' ? createModelToolList(allTools ?? []) : [];

            const stream = chatStream({
                messages: allMessages,
                model: modelInfo.model,
                tools,
                provider: modelInfo.provider,
                options: {
                    ...presetOptions,
                    workspaceRoot: activeWorkspacePath,
                    systemMode,
                    thinking: systemMode === 'thinking',
                    agentToolsEnabled: systemMode === 'agent',
                    reasoningEffort,
                },
                chatId: streamId,
                assistantId,
                workspaceId,
                systemMode,
            });

            return await handleModelStreamIteration({
                stream,
                chatId,
                assistantId,
                index,
                modelInfo,
                intentClassification,
                language,
                streamStartTime,
            });
        } catch (error) {
            const errText = `${t('chat.error')}: ${formatChatError(error as CatchError)}`;
            return {
                model: modelInfo.model,
                provider: modelInfo.provider,
                content: errText,
                error: errText,
            };
        }
    }));

    await finalizeMultiModelResponse({
        results,
        chatId,
        assistantId,
        streamStartTime,
        autoReadEnabled,
        handleSpeak,
        language,
        t,
        intentClassification,
    });
}

async function handleModelStreamIteration(params: HandleModelStreamIterationParams): Promise<ModelStreamResult> {
    const {
        stream,
        chatId,
        assistantId,
        index,
        modelInfo,
        intentClassification,
        language,
        streamStartTime,
    } = params;
    let variantContent = '';
    let variantReasoning = '';
    let lastUpdate = 0;
    let lastStreamingStateUpdate = 0;

    for await (const chunk of stream) {
        if (chunk.content) {
            variantContent += chunk.content;
        }
        if (chunk.reasoning) {
            variantReasoning += chunk.reasoning;
        }

        const now = Date.now();
        const isMain = index === 0;
        if (now - lastStreamingStateUpdate >= 80 || !chunk.content) {
            lastStreamingStateUpdate = now;
            
            const state = getChatSnapshot().streamingStates[chatId] ?? { content: '', reasoning: '', speed: null, variants: {} };
            const variants = { ...state.variants };
            variants[index] = { content: variantContent, reasoning: variantReasoning };
            
            updateStreamingState(chatId, {
                content: isMain ? variantContent : state.content,
                reasoning: isMain ? variantReasoning : state.reasoning,
                variants,
            });
        }

        if (now - lastUpdate > 200 || !chunk.content) {
            lastUpdate = now;
            
            // Re-fetch chat from store snapshot
            const chat = getChatSnapshot().chats.find(c => c.id === chatId);
            if (!chat) {continue;}

            const updatedMessages = chat.messages.map(message => {
                if (message.id !== assistantId) {
                    return message;
                }
                const currentVariants = [...(message.variants ?? [])];
                if (!currentVariants[index]) {
                    currentVariants[index] = {
                        id: `${assistantId}-v${index}`,
                        content: '',
                        model: modelInfo.model,
                        provider: modelInfo.provider,
                        timestamp: new Date(),
                        label: modelInfo.model,
                        isSelected: isMain,
                    };
                }
                currentVariants[index] = { ...currentVariants[index], content: variantContent };
                return {
                    ...message,
                    content: isMain ? variantContent : message.content,
                    reasoning: isMain ? variantReasoning : message.reasoning,
                    metadata: isMain
                        ? buildAssistantPresentationMetadata({
                            intent: intentClassification,
                            content: variantContent,
                            reasoning: variantReasoning,
                            isStreaming: true,
                            language,
                        })
                        : message.metadata,
                    variants: currentVariants,
                };
            });

            updateChatInStore(chatId, { messages: updatedMessages });
        }
    }

    return {
        model: modelInfo.model,
        provider: modelInfo.provider,
        content: variantContent,
        reasoning: variantReasoning,
        responseTime: Math.round(performance.now() - streamStartTime),
    };
}

async function finalizeMultiModelResponse(params: FinalizeMultiModelResponseParams): Promise<void> {
    const {
        results,
        chatId,
        assistantId,
        streamStartTime,
        autoReadEnabled,
        handleSpeak,
        language,
        t,
        intentClassification,
    } = params;
    const finalResponseTime = Math.round(performance.now() - streamStartTime);
    const finalVariants = results.map((result, index) => ({
        id: `${assistantId}-v${index}`,
        content: result.content,
        model: result.model,
        provider: result.provider,
        timestamp: new Date(),
        label: result.model,
        isSelected: index === 0,
        error: result.error,
    }));

    const finalContent = results[0]?.content ?? '';
    const finalReasoning = results[0]?.reasoning;
    const metadata = buildAssistantPresentationMetadata({
        intent: intentClassification,
        content: finalContent,
        reasoning: finalReasoning,
        language,
    });

    // Re-fetch chat from store snapshot
    const chat = getChatSnapshot().chats.find(c => c.id === chatId);
    if (chat) {
        let title = chat.title;
        if (chat.messages.length <= 2 && finalContent) {
            title = finalContent.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || t('sidebar.newChat');
        }
        updateChatInStore(chatId, {
            title,
            isGenerating: false,
            messages: chat.messages.map(message => message.id === assistantId
                ? {
                    ...message,
                    content: finalContent,
                    reasoning: finalReasoning,
                    responseTime: finalResponseTime,
                    metadata,
                    variants: finalVariants.length > 1 ? finalVariants : undefined,
                }
                : message),
        });
    }

    await window.electron.db.updateMessage(assistantId, {
        content: finalContent,
        reasoning: finalReasoning,
        responseTime: finalResponseTime,
        metadata,
        variants: finalVariants.length > 1 ? finalVariants : undefined,
    });

    if (autoReadEnabled && finalContent) {
        handleSpeak(assistantId, finalContent);
    }
}
