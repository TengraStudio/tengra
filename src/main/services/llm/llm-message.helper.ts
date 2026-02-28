import { appLogger } from '@main/logging/logger';
import { sanitizePrompt, validatePromptSafety } from '@main/utils/prompt-sanitizer.util';
import { SettingsService } from '@main/services/system/settings.service';
import { ChatMessage, ContentPart } from '@main/types/llm.types';
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
 * Sanitizes user input messages to prevent injection/XSS.
 */
export function sanitizeMessages(messages: Array<Message | ChatMessage>): Array<Message | ChatMessage> {
    return messages.map(msg => {
        if (msg.role === 'user') {
            const checkContent = (content: string) => {
                const validation = validatePromptSafety(content);
                if (!validation.safe) {
                    appLogger.warn('LLMService', `Prompt safety check failed: ${validation.reason}`);
                    throw new ValidationError(validation.reason ?? 'Unsafe content detected', { field: 'prompt' });
                }
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

/** Locale instruction definitions for non-English languages. */
const LOCALE_INSTRUCTIONS: Record<string, { language: string; localeStyle: string; modelPreference: string }> = {
    tr: {
        language: 'Respond in Turkish.',
        localeStyle: 'Use Turkish terminology, metric units, and examples relevant to Turkiye.',
        modelPreference: 'Prefer model behaviors that provide strong Turkish fluency when equivalent options exist.'
    },
    ar: {
        language: 'Respond in Arabic.',
        localeStyle: 'Use Modern Standard Arabic with region-neutral phrasing unless the user requests a dialect.',
        modelPreference: 'Prefer model behaviors that provide strong Arabic fluency when equivalent options exist.'
    },
    de: {
        language: 'Respond in German.',
        localeStyle: 'Use German formatting conventions and terminology suitable for DACH users.',
        modelPreference: 'Prefer model behaviors that provide strong German fluency when equivalent options exist.'
    },
    es: {
        language: 'Respond in Spanish.',
        localeStyle: 'Use neutral Spanish phrasing and locale-aware units/date formats.',
        modelPreference: 'Prefer model behaviors that provide strong Spanish fluency when equivalent options exist.'
    },
    fr: {
        language: 'Respond in French.',
        localeStyle: 'Use French terminology and locale-appropriate formatting conventions.',
        modelPreference: 'Prefer model behaviors that provide strong French fluency when equivalent options exist.'
    },
    ja: {
        language: 'Respond in Japanese.',
        localeStyle: 'Use natural Japanese register with locale-appropriate honorific-neutral business style by default.',
        modelPreference: 'Prefer model behaviors that provide strong Japanese fluency when equivalent options exist.'
    },
    zh: {
        language: 'Respond in Chinese.',
        localeStyle: 'Use Simplified Chinese and locale-aware terminology unless the user requests otherwise.',
        modelPreference: 'Prefer model behaviors that provide strong Chinese fluency when equivalent options exist.'
    },
};

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

    const selectedLocale = LOCALE_INSTRUCTIONS[lang];
    if (!selectedLocale) { return messages; }
    const instruction = `${selectedLocale.language} ${selectedLocale.localeStyle} ${selectedLocale.modelPreference}`;

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
