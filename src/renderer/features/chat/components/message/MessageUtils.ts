import { useMemo } from 'react';
import { Message } from '@/types';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface ParsedMessageSections {
    thought: string | null;
    plan: string | null;
    displayContent: string;
}

const messageContentParseCache = new Map<string, ParsedMessageSections>();

const parseTagSection = (
    content: string,
    tagName: 'think' | 'plan'
): { value: string | null; content: string } => {
    const match = new RegExp(`<${tagName}>([\\s\\S]*?)(?:<\\/${tagName}>|$)`).exec(content);
    if (!match) {
        return { value: null, content };
    }
    return {
        value: match[1],
        content: content.replace(new RegExp(`<${tagName}>[\\s\\S]*?(?:<\\/${tagName}>|$)`), ''),
    };
};

const parseMessageTaggedSections = (
    content: string,
    reasoning: string | undefined,
    streaming: string | undefined
): ParsedMessageSections => {
    const thoughtSection = parseTagSection(content, 'think');
    const planSection = parseTagSection(thoughtSection.content, 'plan');
    return {
        thought: streaming ?? reasoning ?? thoughtSection.value,
        plan: planSection.value,
        displayContent: planSection.content.trim(),
    };
};

export const useMessageContent = (
    raw: Message['content'],
    reasoning: string | undefined,
    streaming: string | undefined
) =>
    useMemo(() => {
        const content =
            typeof raw === 'string'
                ? raw
                : Array.isArray(raw)
                    ? raw
                        .map(c => {
                            if (typeof c === 'string') {
                                return c;
                            }
                            if (c.type === 'text') {
                                return c.text;
                            }
                            return '';
                        })
                        .join('')
                    : '';
        const cacheKey = `${content}::${reasoning ?? ''}`;
        if (!streaming) {
            const cached = messageContentParseCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }
        const parsed = parseMessageTaggedSections(content, reasoning, streaming);
        if (!streaming) {
            messageContentParseCache.set(cacheKey, parsed);
            if (messageContentParseCache.size > 500) {
                const oldest = messageContentParseCache.keys().next().value;
                if (oldest) {
                    messageContentParseCache.delete(oldest);
                }
            }
        }
        return parsed;
    }, [raw, reasoning, streaming]);

export interface QuotaErrorResponse {
    message?: string;
    resets_at?: number;
    model?: string;
    error?: {
        message?: string;
        resets_at?: number;
        model?: string;
    };
}

export const useQuotaDetails = (is429: boolean, content: string, t: TranslationFn) =>
    useMemo(() => {
        if (!is429) {
            return null;
        }
        try {
            const m = content.match(/\{[\s\S]*\}/);
            if (m) {
                const d = safeJsonParse<QuotaErrorResponse>(m[0], {});
                const o = d.error ?? d;
                return {
                    message: o.message ?? t('messageBubble.quotaExceeded'),
                    resets_at: o.resets_at ?? null,
                    model: o.model ?? null,
                };
            }
        } catch {
            /* skip */
        }
        return { message: t('messageBubble.quotaMessage'), resets_at: null, model: null };
    }, [is429, content, t]);
