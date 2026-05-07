/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useMemo } from 'react';

import { parseChatErrorFromText } from '@/features/chat/utils/chat-error-normalizer.util';
import { ChatError, Message } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

export type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface ParsedMessageSections {
    thought: string | null;
    plan: string | null;
    displayContent: string;
}

const messageContentParseCache = new Map<string, ParsedMessageSections>();
const TOOL_TRACE_PATTERNS = [
    /^<function_calls>$/i,
    /^<\/function_calls>$/i,
    /^\s*\{"tool_call"/i,
    /^\s*\{"tool_calls"/i,
    /^\s*\{"tool_results"/i,
];

function stripPatternPreservingWordBoundary(content: string, pattern: RegExp): string {
    return content.replace(pattern, (match, ...args: unknown[]) => {
        const offset = args[args.length - 2];
        const input = args[args.length - 1];

        if (typeof offset !== 'number' || typeof input !== 'string') {
            return '';
        }

        const before = offset > 0 ? input[offset - 1] : '';
        const afterIndex = offset + match.length;
        const after = afterIndex < input.length ? input[afterIndex] : '';
        const punctuationWithoutLeadingSpace = '])}.!,?;:';
        const openingDelimiters = '[({';
        const shouldInsertSpace =
            before !== ''
            && after !== ''
            && !/\s/.test(before)
            && !/\s/.test(after)
            && !punctuationWithoutLeadingSpace.includes(after)
            && !openingDelimiters.includes(before);

        return shouldInsertSpace ? ' ' : '';
    });
}

const PROMPT_LEAK_PATTERNS = [
    /(?:^|\n)\s*(?:system prompt|prompt to ai|internal prompt|developer prompt)\s*[:-]/i,
    /(?:^|\n)\s*#\s*tengra ai system/i,
    /(?:^|\n)\s*##\s*core identity/i,
    /(?:^|\n)\s*##\s*response contract/i,
    /(?:^|\n)\s*##\s*tool & evidence policy/i,
    /(?:^|\n)\s*##\s*anti-loop & deterministic finalization/i,
];

const PROMPT_BLOCK_START = /(?:^|\n)\s*(?:system prompt|prompt to ai|internal prompt|developer prompt)\s*[:-]\s*/i;
const STRUCTURED_STREAM_MARKUP_PATTERNS = [
    /<think>/i,
    /<plan>/i,
    /<function_calls>/i,
    /<thinking>/i,
    /<planing>/i,
    /"tool_call"/i,
    /"tool_calls"/i,
    /"tool_results"/i,
    /function:\s*[\w\-_]+/i,
];

function stripLeakedPrompt(content: string): string {
    if (content.trim().length === 0) {
        return content;
    }

    const startMatch = PROMPT_BLOCK_START.exec(content);
    if (startMatch && startMatch.index >= 0) {
        const prefix = content.slice(0, startMatch.index).trimEnd();
        return prefix;
    }

    const hasKnownHeaderLeak = PROMPT_LEAK_PATTERNS.some(pattern => pattern.test(content));
    if (!hasKnownHeaderLeak) {
        return content;
    }

    const lines = content.split('\n');
    const filtered = lines.filter(line => !PROMPT_LEAK_PATTERNS.some(pattern => pattern.test(line)));
    return filtered.join('\n').trim();
}

function stripToolTraceReasoning(reasoning: string | null): string | null {
    if (!reasoning) {
        return null;
    }
    const lines = reasoning.split('\n');
    const filteredLines = lines.filter(line => {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
            return true;
        }
        return TOOL_TRACE_PATTERNS.every(pattern => !pattern.test(trimmedLine));
    });
    const normalized = filteredLines.join('\n').trim();
    return normalized.length > 0 ? normalized : null;
}

function hasStructuredStreamMarkup(content: string): boolean {
    if (content.trim().length === 0) {
        return false;
    }
    return STRUCTURED_STREAM_MARKUP_PATTERNS.some(pattern => pattern.test(content))
        || PROMPT_LEAK_PATTERNS.some(pattern => pattern.test(content));
}

function stripDuplicatedThoughtFromDisplay(displayContent: string, thought: string | null): string {
    if (!thought || thought.trim().length === 0) {
        return displayContent;
    }

    const normalizedThought = thought.trim();
    if (normalizedThought.length < 24) {
        return displayContent;
    }

    const normalizedDisplay = displayContent.trim();
    if (normalizedDisplay.length === 0) {
        return displayContent;
    }

    if (normalizedDisplay === normalizedThought) {
        return '';
    }

    if (normalizedDisplay.startsWith(normalizedThought)) {
        return normalizedDisplay.slice(normalizedThought.length).trimStart();
    }

    const duplicateIndex = normalizedDisplay.indexOf(normalizedThought);
    if (duplicateIndex >= 0) {
        const before = normalizedDisplay.slice(0, duplicateIndex).trimEnd();
        const after = normalizedDisplay.slice(duplicateIndex + normalizedThought.length).trimStart();
        return `${before}${before.length > 0 && after.length > 0 ? '\n\n' : ''}${after}`.trim();
    }

    return displayContent;
}

const parseTagSection = (
    content: string,
    tagNames: readonly string[]
): { value: string | null; content: string } => {
    const escapedTagNames = tagNames.map(tagName => tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const tagAlternation = escapedTagNames.join('|');
    const pattern = new RegExp(`<(${tagAlternation})>([\\s\\S]*?)(?:<\\/\\1>|$)`, 'i');
    const match = pattern.exec(content);
    if (!match) {
        return { value: null, content };
    }
    return {
        value: match[2],
        content: stripPatternPreservingWordBoundary(content, pattern),
    };
};

const parseMessageTaggedSections = (
    content: string,
    reasoning: string | undefined,
    streaming: string | undefined
): ParsedMessageSections => {
    const thoughtSection = parseTagSection(content, ['think', 'thinking']);
    const planSection = parseTagSection(thoughtSection.content, ['plan', 'planing']);
    const reasoningSource = streaming ?? reasoning ?? thoughtSection.value;
    const cleanupPatterns = [
        /\{"name":\s*"[^"]+",\s*"parameters":\s*\{[\s\S]*?\}\}/g,
        /\{"name":\s*"[^"]+",\s*"arguments":\s*"[\s\S]*?"\}/g,
        /function:\s*[\w\-_]+[\s\n]*parameters:\s*[\s\S]*?(?=\n\n|$)/gi, // Greedy Llama-style
        /function:\s*[\w\-_]+[\s\n]*arguments:\s*[\s\S]*?(?=\n\n|$)/gi, // Alternate Llama-style
        /<think>[\s\S]*?(?:<\/think>|$)/gi,
        /<plan>[\s\S]*?(?:<\/plan>|$)/gi,
        /<function_calls>[\s\S]*?(?:<\/function_calls>|$)/gi,
        /<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, // Catch variants
        /<planing>[\s\S]*?(?:<\/planing>|$)/gi, // Catch typos
    ];
    let filteredContent = stripLeakedPrompt(planSection.content);
    for (const pattern of cleanupPatterns) {
        filteredContent = stripPatternPreservingWordBoundary(filteredContent, pattern);
    }
    const parsedThought = stripToolTraceReasoning(reasoningSource);
    filteredContent = stripDuplicatedThoughtFromDisplay(filteredContent.trim(), parsedThought);
    appLogger.info(
        'MessageUtils',
        `parseMessageTaggedSections contentLen=${content.length}, reasoningLen=${reasoning?.length ?? 0}, streamingLen=${streaming?.length ?? 0}, thoughtLen=${parsedThought?.length ?? 0}, planLen=${planSection.value?.length ?? 0}, displayLen=${filteredContent.length}`
    );

    return {
        thought: parsedThought,
        plan: planSection.value,
        displayContent: filteredContent,
    };
};

const parseStreamingFastPath = (
    content: string,
    reasoning: string | undefined,
    streaming: string | undefined
): ParsedMessageSections => {
    const reasoningSource = streaming ?? reasoning;
    const parsedThought = stripToolTraceReasoning(reasoningSource ?? null);
    const filteredContent = stripDuplicatedThoughtFromDisplay(
        stripLeakedPrompt(content).trim(),
        parsedThought
    );

    appLogger.info(
        'MessageUtils',
        `parseStreamingFastPath contentLen=${content.length}, reasoningLen=${reasoning?.length ?? 0}, streamingLen=${streaming?.length ?? 0}, thoughtLen=${parsedThought?.length ?? 0}, displayLen=${filteredContent.length}`
    );

    return {
        thought: parsedThought,
        plan: null,
        displayContent: filteredContent,
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
                        .join(' ')
                    : '';
        const cacheKey = `${content}::${reasoning ?? ''}`;
        if (!streaming) {
            const cached = messageContentParseCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }
        if (!hasStructuredStreamMarkup(content)) {
            const parsed = parseStreamingFastPath(content, reasoning, streaming);
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

export const useChatMessageError = (content: string, model: string | null) =>
    useMemo(() => {
        return parseChatErrorFromText(content, model);
    }, [content, model]);

export interface QuotaErrorDetails {
    message: string;
    resets_at: number | null;
    model: string | null;
}

function buildQuotaMessage(error: ChatError, t: TranslationFn): string {
    if (error.kind === 'capacity_exhausted') {
        return error.message || t('frontend.chat.errorCapacityExhausted');
    }
    if (error.kind === 'rate_limited') {
        return error.message || t('frontend.chat.errorRateLimited');
    }
    return error.message || t('frontend.messageBubble.quotaMessage');
}

export const useQuotaDetails = (chatError: ChatError | null, t: TranslationFn): QuotaErrorDetails | null =>
    useMemo(() => {
        if (!chatError) {
            return null;
        }
        if (
            chatError.kind !== 'quota_exhausted'
            && chatError.kind !== 'capacity_exhausted'
            && chatError.kind !== 'rate_limited'
        ) {
            return null;
        }
        return {
            message: buildQuotaMessage(chatError, t),
            resets_at: chatError.resetsAt ?? null,
            model: chatError.model ?? null,
        };
    }, [chatError, t]);

