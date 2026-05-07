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

import { generateId } from '@/lib/utils';
import { getChatSnapshot,updateChatInStore } from '@/store/chat.store';
import { Chat, Message } from '@/types';

import {
    buildAssistantPresentationMetadata,
    buildStoredToolResults,
    readToolResultImages,
} from './ai-runtime-chat.util';

export function upsertMessageInChat(
    messages: Message[],
    messageId: string,
    buildMessage: (existing?: Message) => Message
): Message[] {
    const messageIndex = messages.findIndex(message => message.id === messageId);
    if (messageIndex === -1) {
        return [...messages, buildMessage()];
    }

    const nextMessages = [...messages];
    nextMessages[messageIndex] = buildMessage(nextMessages[messageIndex]);
    return nextMessages;
}

export async function persistAssistantMessage(
    assistantId: string,
    chatId: string,
    updates: Partial<Message>
): Promise<void> {
    const updateResult = await window.electron.db.updateMessage(assistantId, updates);
    if (updateResult.success) {
        return;
    }

    await window.electron.db.addMessage({
        id: assistantId,
        chatId,
        role: 'assistant',
        content: typeof updates.content === 'string' ? updates.content : '',
        timestamp: new Date(),
        ...updates,
    });
}

export async function persistToolExecutionMetadata(options: {
    chatId: string;
    assistantId: string;
    toolCalls: NonNullable<Message['toolCalls']>;
    toolMessages: Message[];
    selectedProvider: string;
    activeModel: string;
    intentClassification: AiIntentClassification;
    language?: string;
    reasonings?: string[];
    content?: string;
    reasoning?: string;
    images?: string[];
    sources?: string[];
    onMessageUpdate?: (updates: Partial<Message>) => void;
}): Promise<void> {
    const {
        chatId,
        assistantId,
        toolCalls,
        toolMessages,
        selectedProvider,
        activeModel,
        intentClassification,
        language,
        reasonings,
        content,
        reasoning,
        images,
        sources,
        onMessageUpdate,
    } = options;
    if (toolCalls.length === 0) {
        return;
    }

    const storedToolResults = buildStoredToolResults(toolCalls, toolMessages);
    const updates: Partial<Message> = {
        toolCalls,
        toolResults: storedToolResults,
        reasonings,
        metadata: buildAssistantPresentationMetadata({
            intent: intentClassification,
            content,
            reasoning,
            toolCalls,
            toolResults: storedToolResults,
            images,
            sources,
            language,
            reasonings,
        }),
    };
    if (content !== undefined) {
        updates.content = content;
    }
    if (reasoning !== undefined) {
        updates.reasoning = reasoning;
    }
    if (images && images.length > 0) {
        updates.images = images;
    }
    if (sources && sources.length > 0) {
        updates.sources = sources;
    }

    updateChatInStore(chatId, (chat: Chat) => ({
        messages: upsertMessageInChat(chat.messages, assistantId, existing => ({
            id: assistantId,
            role: 'assistant',
            timestamp: existing?.timestamp ?? new Date(),
            provider: selectedProvider,
            model: activeModel,
            ...existing,
            ...updates,
            content: content ?? existing?.content ?? '',
        })),
    }));
    onMessageUpdate?.(updates);

    await persistAssistantMessage(assistantId, chatId, updates);
}

export async function completeDirectImageMessage(options: {
    assistantId: string;
    chatId: string;
    prompt: string;
    requestedCount: number;
    activeModel: string;
    selectedProvider: string;
    t: (key: string) => string;
    intentClassification: AiIntentClassification;
    language?: string;
}): Promise<void> {
    const {
        assistantId,
        chatId,
        prompt,
        requestedCount,
        activeModel,
        selectedProvider,
        t,
        intentClassification,
        language,
    } = options;
    const startedAt = performance.now();
    const toolResult = await window.electron.executeTools(
        'generate_image',
        { prompt, count: requestedCount },
        generateId(),
        chatId
    );

    if (!toolResult || typeof toolResult !== 'object') {
        throw new Error(t('frontend.chat.error'));
    }

    if (!toolResult.success) {
        throw new Error(toolResult.error ?? t('frontend.chat.error'));
    }

    const images = readToolResultImages(toolResult);
    if (images.length === 0) {
        throw new Error(t('frontend.chat.imageGenerationNoImages'));
    }

    const responseTime = Math.round(performance.now() - startedAt);
    const updates: Partial<Message> = {
        content: '',
        images,
        responseTime,
        toolResults: [toolResult],
        metadata: buildAssistantPresentationMetadata({
            intent: intentClassification,
            toolResults: [toolResult],
            images,
            language,
        }),
    };

    updateChatInStore(chatId, {
        isGenerating: false,
        messages: upsertMessageInChat(getChatSnapshot().chats.find(c => c.id === chatId)?.messages ?? [], assistantId, existing => ({
            id: assistantId,
            role: 'assistant',
            timestamp: existing?.timestamp ?? new Date(),
            provider: selectedProvider,
            model: activeModel,
            ...existing,
            ...updates,
            content: '',
        })),
    });

    await persistAssistantMessage(assistantId, chatId, updates);
}

