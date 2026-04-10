import { Message, SystemMode, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { sanitizeString } from '@shared/utils/sanitize.util';

import { sanitizeConversationTools } from './session-conversation-prompt.util';

interface ConversationRequestParams {
    messages: Message[];
    model: string;
    provider: string;
    tools?: ToolDefinition[];
    workspaceId?: string;
    systemMode?: SystemMode;
    chatId?: string;
    assistantId?: string;
    streamId?: string;
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
} {
    const { messages, model, provider, tools, workspaceId, systemMode, chatId, assistantId, streamId } = params;
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

export function extractConversationReasoningEffort(optionsJson?: JsonObject): string | undefined {
    const raw = optionsJson?.['reasoningEffort'];
    if (typeof raw !== 'string') {
        return undefined;
    }
    return sanitizeString(raw, { maxLength: 20, allowNewlines: false });
}

export function extractConversationAccountId(optionsJson?: JsonObject): string | undefined {
    const raw = optionsJson?.['accountId'];
    if (typeof raw !== 'string') {
        return undefined;
    }
    return sanitizeString(raw, { maxLength: 128, allowNewlines: false, trimWhitespace: true });
}

function sanitizeConversationMessage(message: Message): Message {
    if (typeof message.content === 'string') {
        return {
            ...message,
            content: sanitizeString(message.content, { maxLength: 1000000, allowNewlines: true }),
        };
    }

    return {
        ...message,
        content: message.content.map(item => {
            if (item.type === 'text' && typeof item.text === 'string') {
                return {
                    ...item,
                    text: sanitizeString(item.text, { maxLength: 1000000, allowNewlines: true }),
                };
            }
            return item;
        }),
    };
}
