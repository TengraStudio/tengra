/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { ChatMessage, ContentPart } from '@main/types/llm.types';
import { sanitizePrompt } from '@main/utils/prompt-sanitizer.util';
import { buildLocaleReinforcementInstruction } from '@shared/instructions';
import { Message, MessageContentPart } from '@shared/types/chat';
import { ValidationError } from '@shared/utils/error.util';

import { getContextWindowService } from './context-window.service';

/**
 * Validates that messages array has correct structure.
 */
export function validateMessagesInput(messages: Array<Message | ChatMessage>): void {
    if (!Array.isArray(messages)) {
        throw new ValidationError('Messages must be an array', { field: 'messages' });
    }

    for (const msg of messages) {
        const role = (msg as { role?: string }).role;
        if (typeof role !== 'string' || role.trim().length === 0) {
            throw new ValidationError('Each message must include a valid role', { field: 'messages.role' });
        }

        const content = (msg as { content?: string | MessageContentPart[] | ContentPart[] }).content;
        const isValidContent = typeof content === 'string' || Array.isArray(content);
        if (!isValidContent) {
            throw new ValidationError('Each message must include string or array content', { field: 'messages.content' });
        }
    }
}

/**
 * Sanitizes user input messages.
 * Safety checks have been removed per user request.
 */
export function sanitizeMessages(messages: Array<Message | ChatMessage>): Array<Message | ChatMessage> {
    return messages.map(msg => {
        if (msg.role === 'user') {
            const checkContent = (content: string) => {
                return sanitizePrompt(content);
            };

            if (typeof msg.content === 'string') {
                return { ...msg, content: checkContent(msg.content) };
            }

            if (Array.isArray(msg.content)) {
                const content = msg.content as Array<ContentPart | MessageContentPart>;
                const sanitizedContent = content.map(part => {
                    if (part.type === 'text' && typeof part.text === 'string') {
                        return { ...part, text: checkContent(part.text) };
                    }
                    return part;
                });
                return { ...msg, content: sanitizedContent };
            }
        }
        return msg;
    });
}

/**
 * Injects locale-specific instructions into the system prompt.
 */
export function applyLocaleInstructions(
    messages: Array<Message | ChatMessage>,
    settingsService: SettingsService
): Array<Message | ChatMessage> {
    const settings = settingsService.getSettings();
    const lang = settings.general?.language ?? 'en';

    if (lang === 'en') { return messages; }
    const instruction = buildLocaleReinforcementInstruction(lang);

    const result = [...messages];
    const systemMsgIndex = result.findIndex(m => m.role === 'system');

    if (systemMsgIndex !== -1) {
        const systemMsg = result[systemMsgIndex];
        if (typeof systemMsg.content === 'string') {
            if (!systemMsg.content.includes(instruction)) {
                result[systemMsgIndex] = {
                    ...systemMsg,
                    content: `${systemMsg.content}\n\nIMPORTANT: ${instruction}`
                } as Message | ChatMessage;
            }
        }
    } else {
        result.unshift({
            role: 'system',
            content: `IMPORTANT: ${instruction}`
        } as Message | ChatMessage);
    }

    return result;
}

/**
 * Prepares messages for context window limits using compaction.
 */
export function prepareMessagesForContextWindow(messages: Message[], model: string): Message[] {
    const contextService = getContextWindowService();
    const compaction = contextService.compactMessages(messages, model, {
        reservedTokens: 1000,
        keepSystemMessages: true,
        keepRecentMessages: 12,
        strategy: 'recent-first'
    });

    if (compaction.removedCount > 0) {
        const mode = compaction.compacted ? 'compacted' : 'truncated';
        appLogger.info(
            'LLMService',
            `Context ${mode} for ${model}. removed=${compaction.removedCount} passes=${compaction.passes} utilization=${compaction.info.utilizationPercent.toFixed(1)}%`
        );
    }

    return compaction.messages;
}

