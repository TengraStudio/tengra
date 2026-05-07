/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { safeJsonParse } from '@shared/utils/sanitize.util';

import { ChatError, ChatErrorKind } from '@/types';

interface ParsedEnvelope {
    payload: Record<string, RendererDataValue> | null;
    sourceMessage: string;
}

const ERROR_SNIPPET_REGEX = /\[(?:stream|generation) interrupted:\s*([\s\S]*?)\]$/i;

const ERROR_HINTS = [
    '429',
    '503',
    'quota',
    'rate limit',
    'resource_exhausted',
    'model_capacity_exhausted',
    'timed out',
    'timeout',
    'unavailable',
    'unauthorized',
    'permission denied',
    'stream interrupted',
    'generation interrupted',
] as const;

const KIND_PRIORITY: ChatErrorKind[] = [
    'capacity_exhausted',
    'quota_exhausted',
    'rate_limited',
    'auth',
    'permission_denied',
    'timeout',
    'provider_unavailable',
    'generic',
];

function isRecord(value: RendererDataValue): value is Record<string, RendererDataValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(payload: Record<string, RendererDataValue>, key: string): string | null {
    const value = payload[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(payload: Record<string, RendererDataValue>, key: string): number | null {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function normalizeResetTimestamp(rawValue: RendererDataValue): number | null {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        return rawValue > 1_000_000_000_000 ? Math.round(rawValue / 1000) : Math.round(rawValue);
    }
    if (typeof rawValue === 'string') {
        const numeric = Number(rawValue);
        if (Number.isFinite(numeric)) {
            return numeric > 1_000_000_000_000 ? Math.round(numeric / 1000) : Math.round(numeric);
        }
        const timestamp = Date.parse(rawValue);
        if (Number.isFinite(timestamp)) {
            return Math.round(timestamp / 1000);
        }
    }
    return null;
}

function parseJsonObject(text: string): Record<string, RendererDataValue> | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        return null;
    }
    const parsed = safeJsonParse<Record<string, RendererDataValue> | null>(trimmed, null);
    return parsed && isRecord(parsed) ? parsed : null;
}

function unwrapErrorEnvelope(payload: Record<string, RendererDataValue>): Record<string, RendererDataValue> {
    let current = payload;
    const MAX_DEPTH = 3;
    for (let index = 0; index < MAX_DEPTH; index += 1) {
        const nested = current.error;
        if (typeof nested === 'string') {
            const nestedParsed = parseJsonObject(nested);
            if (nestedParsed) {
                current = nestedParsed;
                continue;
            }
            break;
        }
        if (isRecord(nested)) {
            current = nested;
            continue;
        }
        break;
    }
    return current;
}

function collectErrorCandidates(message: string): string[] {
    const trimmed = message.trim();
    const candidates = new Set<string>([trimmed]);
    const snippetMatch = trimmed.match(ERROR_SNIPPET_REGEX);
    if (snippetMatch && typeof snippetMatch[1] === 'string' && snippetMatch[1].trim().length > 0) {
        candidates.add(snippetMatch[1].trim());
    }
    const firstJsonStart = trimmed.indexOf('{');
    const lastJsonEnd = trimmed.lastIndexOf('}');
    if (firstJsonStart >= 0 && lastJsonEnd > firstJsonStart) {
        candidates.add(trimmed.slice(firstJsonStart, lastJsonEnd + 1));
    }
    return Array.from(candidates);
}

function parseEnvelope(message: string): ParsedEnvelope {
    const candidates = collectErrorCandidates(message);
    for (const candidate of candidates) {
        const parsed = parseJsonObject(candidate);
        if (!parsed) {
            continue;
        }
        const payload = unwrapErrorEnvelope(parsed);
        return { payload, sourceMessage: candidate };
    }
    return { payload: null, sourceMessage: message };
}

function extractReason(payload: Record<string, RendererDataValue> | null): string | null {
    if (!payload) {
        return null;
    }
    const directReason = readString(payload, 'reason');
    if (directReason) {
        return directReason;
    }
    const details = payload.details;
    if (!Array.isArray(details)) {
        return null;
    }
    for (const detail of details) {
        if (!isRecord(detail)) {
            continue;
        }
        const reason = readString(detail, 'reason');
        if (reason) {
            return reason;
        }
    }
    return null;
}

function extractStatusCode(payload: Record<string, RendererDataValue> | null): number | null {
    if (!payload) {
        return null;
    }
    const code = readNumber(payload, 'code');
    if (code !== null) {
        return code;
    }
    const nestedError = payload.error;
    if (isRecord(nestedError)) {
        return readNumber(nestedError, 'code');
    }
    return null;
}

function extractResetTime(payload: Record<string, RendererDataValue> | null): number | null {
    if (!payload) {
        return null;
    }
    const resetKeys = ['resets_at', 'reset_at', 'resetAt', 'next_reset', 'reset', 'retry_after'] as const;
    for (const key of resetKeys) {
        const value = payload[key];
        const normalized = normalizeResetTimestamp(value);
        if (normalized !== null) {
            return normalized;
        }
    }
    return null;
}

function extractMessage(payload: Record<string, RendererDataValue> | null, fallback: string): string {
    if (!payload) {
        return fallback.trim();
    }
    const directMessage = readString(payload, 'message');
    if (directMessage) {
        return directMessage;
    }
    const nestedError = payload.error;
    if (isRecord(nestedError)) {
        const nestedMessage = readString(nestedError, 'message');
        if (nestedMessage) {
            return nestedMessage;
        }
    }
    return fallback.trim();
}

function detectKind(haystack: string, reason: string | null, status: string | null, code: number | null): ChatErrorKind {
    const combined = `${haystack} ${reason ?? ''} ${status ?? ''}`.toLowerCase();
    const evaluations: Array<{ kind: ChatErrorKind; match: boolean }> = [
        {
            kind: 'capacity_exhausted',
            match: combined.includes('model_capacity_exhausted')
                || combined.includes('no capacity available')
                || ((code === 503 || combined.includes('503')) && combined.includes('capacity')),
        },
        {
            kind: 'quota_exhausted',
            match: combined.includes('quota')
                || combined.includes('resource_exhausted')
                || combined.includes('usage quota')
                || combined.includes('daily limit reached'),
        },
        {
            kind: 'rate_limited',
            match: code === 429
                || combined.includes('429')
                || combined.includes('rate limit')
                || combined.includes('too many requests'),
        },
        {
            kind: 'auth',
            match: code === 401
                || combined.includes('unauthorized')
                || combined.includes('invalid api key')
                || combined.includes('authentication'),
        },
        {
            kind: 'permission_denied',
            match: code === 403
                || combined.includes('permission denied')
                || combined.includes('forbidden'),
        },
        {
            kind: 'timeout',
            match: combined.includes('timeout')
                || combined.includes('timed out')
                || combined.includes('econnaborted'),
        },
        {
            kind: 'provider_unavailable',
            match: code === 503
                || combined.includes('unavailable')
                || combined.includes('econnrefused')
                || combined.includes('enotfound')
                || combined.includes('network')
                || combined.includes('connect'),
        },
        { kind: 'generic', match: true },
    ];
    for (const kind of KIND_PRIORITY) {
        const evaluation = evaluations.find(item => item.kind === kind);
        if (evaluation?.match) {
            return kind;
        }
    }
    return 'generic';
}

export function normalizeChatError(message: string, model: string | null): ChatError {
    const { payload, sourceMessage } = parseEnvelope(message);
    const reason = extractReason(payload);
    const statusCode = extractStatusCode(payload);
    const status = payload ? readString(payload, 'status') : null;
    const normalizedMessage = extractMessage(payload, sourceMessage);
    const kind = detectKind(normalizedMessage, reason, status, statusCode);
    return {
        kind,
        message: normalizedMessage,
        model: model ?? (payload ? readString(payload, 'model') : null),
        resetsAt: extractResetTime(payload),
        code: statusCode,
        reason,
        retryable: kind !== 'auth' && kind !== 'permission_denied',
    };
}

export function parseChatErrorFromText(content: string, model: string | null): ChatError | null {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
        return null;
    }
    const lower = trimmed.toLowerCase();
    const looksLikeError = ERROR_HINTS.some(hint => lower.includes(hint));
    if (!looksLikeError) {
        return null;
    }
    const parsed = normalizeChatError(trimmed, model);
    return parsed.kind === 'generic' && !trimmed.includes('{') ? null : parsed;
}

