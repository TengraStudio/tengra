/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Utility functions for parsing AI responses from various formats
 */

import { JsonObject, JsonValue } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Handle string response part
 */
function handleStringContent(response: string): string {
    const trimmed = response.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = safeJsonParse<JsonValue>(trimmed, null);
        if (parsed) {return parseAIResponseContent(parsed);}
    }
    return trimmed;
}

/**
 * Handle list format found in Copilot or other responses
 */
function handleListLike(list: RuntimeValue): string | null {
    if (!Array.isArray(list)) {return null;}
    return list
        .filter((item): item is JsonObject => isJsonObject(item) && (item.type === 'output_text' || !!item.text))
        .map((item) => (typeof item.text === 'string' ? item.text : ''))
        .join('');
}

/**
 * Handle OpenAI chat completion format
 */
function handleOpenAIFormat(res: JsonObject): string | null {
    if (Array.isArray(res.choices) && res.choices.length > 0) {
        const choice = res.choices[0];
        const message = isJsonObject(choice) ? choice.message : undefined;
        if (isJsonObject(message) && typeof message.content === 'string') {
            return message.content;
        }
    }
    return null;
}

/**
 * Handle various object property patterns
 */
function handleObjectProperties(res: JsonObject): string | null {
    // Copilot format
    if (res.type === 'message' && res.content) {
        const contentVal = handleListLike(res.content);
        if (contentVal !== null) {return contentVal;}
    }

    // Direct content array
    if (res.content && Array.isArray(res.content)) {
        const contentVal = handleListLike(res.content);
        if (contentVal !== null) {return contentVal;}
    }

    // OpenAI format
    const openAI = handleOpenAIFormat(res);
    if (openAI !== null) {return openAI;}

    // Recursive message wrapper
    if (isJsonObject(res.message) && res.message.content !== undefined) {
        return parseAIResponseContent(res.message.content as JsonValue);
    }

    return handleFallbackProperties(res);
}

/**
 * Handle direct string fields or output arrays
 */
function handleFallbackProperties(res: JsonObject): string | null {
    if (typeof res.output_text === 'string') {return res.output_text;}
    if (typeof res.content === 'string') {return handleStringContent(res.content);}
    if (res.output) {
        const outVal = handleListLike(res.output);
        if (outVal !== null) {return outVal;}
    }
    if (typeof res.text === 'string') {return res.text;}
    return null;
}

/**
 * Parse content from various API response formats
 */
export function parseAIResponseContent(response: JsonValue | undefined): string {
    if (response === undefined || response === null) {return '';}

    if (typeof response === 'string') {return handleStringContent(response);}

    if (Array.isArray(response)) {
        return response.map(item => parseAIResponseContent(item)).filter(Boolean).join('');
    }

    if (isJsonObject(response)) {
        return handleObjectProperties(response) ?? '';
    }

    return '';
}

/**
 * Check if a response contains a reasoning block
 */
export function extractReasoning(response: JsonValue | undefined): { reasoning: string | null, content: string } {
    const content = parseAIResponseContent(response);

    if (isJsonObject(response)) {
        const res = response;
        if (typeof res.reasoning === 'string') {
            return { reasoning: res.reasoning, content };
        }
        if (Array.isArray(res.summary) && res.summary.length > 0) {
            const summaryParts = res.summary.filter((item): item is string => typeof item === 'string');
            return { reasoning: summaryParts.join('\n'), content };
        }
    }

    return { reasoning: null, content };
}

