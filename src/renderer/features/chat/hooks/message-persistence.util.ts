import { AiIntentClassification } from '@shared/types/ai-runtime';

import { generateId } from '@/lib/utils';
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
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    toolCalls: NonNullable<Message['toolCalls']>;
    toolMessages: Message[];
    selectedProvider: string;
    activeModel: string;
    intentClassification: AiIntentClassification;
    language?: string;
    reasonings?: string[];
}): Promise<void> {
    const {
        chatId,
        assistantId,
        setChats,
        toolCalls,
        toolMessages,
        selectedProvider,
        activeModel,
        intentClassification,
        language,
        reasonings,
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
            toolCalls,
            toolResults: storedToolResults,
            language,
            reasonings,
        }),
    };

    setChats(prev => prev.map(chat => (
        chat.id === chatId
            ? {
                ...chat,
                messages: upsertMessageInChat(chat.messages, assistantId, existing => ({
                    id: assistantId,
                    role: 'assistant',
                    timestamp: existing?.timestamp ?? new Date(),
                    provider: selectedProvider,
                    model: activeModel,
                    ...existing,
                    ...updates,
                    content: existing?.content ?? '',
                })),
            }
            : chat
    )));

    await persistAssistantMessage(assistantId, chatId, updates);
}

export async function completeDirectImageMessage(options: {
    assistantId: string;
    chatId: string;
    prompt: string;
    requestedCount: number;
    activeModel: string;
    selectedProvider: string;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
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
        setChats,
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
        throw new Error(t('chat.error'));
    }

    if (!toolResult.success) {
        throw new Error(toolResult.error ?? t('chat.error'));
    }

    const images = readToolResultImages(toolResult);
    if (images.length === 0) {
        throw new Error(t('chat.imageGenerationNoImages'));
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

    setChats(prev => prev.map(chat => (
        chat.id === chatId
            ? {
                ...chat,
                isGenerating: false,
                messages: upsertMessageInChat(chat.messages, assistantId, existing => ({
                    id: assistantId,
                    role: 'assistant',
                    timestamp: existing?.timestamp ?? new Date(),
                    provider: selectedProvider,
                    model: activeModel,
                    ...existing,
                    ...updates,
                    content: '',
                })),
            }
            : chat
    )));

    await persistAssistantMessage(assistantId, chatId, updates);
}
