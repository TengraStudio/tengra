/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Message, SystemMode, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { sanitizeString } from '@shared/utils/sanitize.util';

import { sanitizeConversationTools } from './session-prompt-builder';

type UnsafeValue = ReturnType<typeof JSON.parse>;

interface ConversationRequestParams {
    messages: UnsafeValue[];
    model: string;
    provider: string;
    tools?: UnsafeValue[];
    workspaceId?: string;
    systemMode?: SystemMode;
    chatId?: string;
    assistantId?: string;
    streamId?: string;
    optionsJson?: UnsafeValue;
}

interface ConversationStreamParams extends ConversationRequestParams {
    chatId: string;
}

export function sanitizeConversationRequestParams(params: ConversationRequestParams): {
    messages: Message[];
    model: string;
    provider: string;
    workspaceId?: string;
    tools?: ToolDefinition[];
    systemMode?: SystemMode;
    chatId?: string;
    assistantId?: string;
    streamId?: string;
    optionsJson?: UnsafeValue;
} {

    const { messages, model, provider, tools, workspaceId, systemMode, chatId, assistantId, streamId, optionsJson } = params;
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('error.chat.invalid_messages');
    }
    if (!model) {
        throw new Error('error.chat.invalid_model');
    }
    if (!provider) {
        throw new Error('error.chat.invalid_provider');
    }

    return {
        messages: messages.map(sanitizeConversationMessage),
        model: sanitizeString(model, { maxLength: 200, allowNewlines: false, trimWhitespace: true }),
        provider: sanitizeString(provider, { maxLength: 50, allowNewlines: false, trimWhitespace: true }),
        workspaceId: workspaceId
            ? sanitizeString(workspaceId, { maxLength: 100, allowNewlines: false, trimWhitespace: true })
            : undefined,
        tools: sanitizeConversationTools(tools),
        systemMode,
        chatId: chatId
            ? sanitizeString(chatId, { maxLength: 100, allowNewlines: false, trimWhitespace: true })
            : undefined,
        assistantId: assistantId
            ? sanitizeString(assistantId, { maxLength: 100, allowNewlines: false, trimWhitespace: true })
            : undefined,
        streamId: streamId
            ? sanitizeString(streamId, { maxLength: 100, allowNewlines: false, trimWhitespace: true })
            : undefined,
        optionsJson
    };
}

export function sanitizeConversationStreamInputs(params: ConversationStreamParams): {
    messages: Message[];
    model: string;
    provider: string;
    workspaceId?: string;
    tools?: ToolDefinition[];
    systemMode?: SystemMode;
    chatId: string;
    assistantId?: string;
    streamId?: string;
    optionsJson?: UnsafeValue;
} {
    const { chatId } = params;
    if (!chatId) {
        throw new Error('error.chat.invalid_id');
    }

    return {
        ...sanitizeConversationRequestParams(params),
        chatId: sanitizeString(chatId, { maxLength: 100, allowNewlines: false, trimWhitespace: true }),
    };
}

export function extractConversationReasoningEffort(optionsJson?: UnsafeValue): string | undefined {
    const raw = optionsJson?.['reasoningEffort'];
    if (typeof raw !== 'string') {
        return undefined;
    }
    return sanitizeString(raw, { maxLength: 20, allowNewlines: false });
}

export function extractConversationAccountId(optionsJson?: UnsafeValue): string | undefined {
    const raw = optionsJson?.['accountId'];
    if (typeof raw !== 'string') {
        return undefined;
    }
    return sanitizeString(raw, { maxLength: 128, allowNewlines: false, trimWhitespace: true });
}

function sanitizeConversationMessage(message: UnsafeValue): Message {
    const id = message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = message.timestamp instanceof Date ? message.timestamp : new Date();

    if (typeof message.content === 'string') {
        return {
            ...message,
            id,
            timestamp,
            content: sanitizeString(message.content, { maxLength: 1000000, allowNewlines: true }),
        } as Message;
    }

    return {
        ...message,
        id,
        timestamp,
        content: Array.isArray(message.content) 
            ? message.content.map((item: UnsafeValue) => {
                if (item.type === 'text' && typeof item.text === 'string') {
                    return {
                        ...item,
                        text: sanitizeString(item.text, { maxLength: 1000000, allowNewlines: true }),
                    };
                }
                return item;
            })
            : String(message.content),
    } as Message;
}

