/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Language } from '@/i18n';
import { getSystemPrompt } from '@/lib/identity';
import { generateId } from '@/lib/utils';
import { ChatError, Message } from '@/types';

export interface PreparedConversationMessages {
    assistantId: string;
    assistantMessage: Message;
    sessionId: string;
    systemMessage: Message;
    userMessage: Message;
}

export function categorizeConversationError(
    message: string,
    model: string | null
): ChatError {
    const lower = message.toLowerCase();

    if (
        lower.includes('quota')
        || lower.includes('rate limit')
        || lower.includes('429')
        || lower.includes('exceeded')
    ) {
        return { kind: 'quota_exhausted', message, model };
    }
    if (
        lower.includes('timeout')
        || lower.includes('timed out')
        || lower.includes('econnaborted')
    ) {
        return { kind: 'timeout', message, model };
    }
    if (
        lower.includes('econnrefused')
        || lower.includes('enotfound')
        || lower.includes('unavailable')
        || lower.includes('503')
        || lower.includes('network')
        || lower.includes('connect')
    ) {
        return { kind: 'provider_unavailable', message, model };
    }

    return { kind: 'generic', message, model };
}

export function patchAssistantMessage(
    messages: Message[],
    assistantId: string,
    updates: Partial<Message>
): Message[] {
    return messages.map(message => {
        if (message.id !== assistantId) {
            return message;
        }

        return {
            ...message,
            ...updates,
        };
    });
}

export function toTextContent(content: Message['content']): string {
    if (typeof content === 'string') {
        return content;
    }

    return content
        .map(part => (part.type === 'text' ? part.text : part.image_url.url))
        .join('\n');
}

function buildSystemMessage(provider: string, model: string, language: Language): Message {
    return {
        id: generateId(),
        role: 'system',
        content: getSystemPrompt(language, provider, model),
        timestamp: new Date(),
    };
}

export function prepareConversationMessages(
    content: string,
    provider: string,
    model: string,
    language: Language
): PreparedConversationMessages {
    const assistantTimestamp = new Date();
    const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: new Date(),
    };
    const assistantId = generateId();

    return {
        assistantId,
        assistantMessage: {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: assistantTimestamp,
            provider,
            model,
        },
        sessionId: generateId(),
        systemMessage: buildSystemMessage(provider, model, language),
        userMessage,
    };
}

export function formatStreamErrorContent(
    existingContent: string,
    errorMessage: string
): string {
    const normalizedError = errorMessage.toLowerCase().startsWith('error:')
        ? errorMessage
        : `Error: ${errorMessage}`;
    return existingContent
        ? `${existingContent}\n\n[${normalizedError}]`
        : normalizedError;
}
