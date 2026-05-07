/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AppSettings, Message, MessageContentPart, ToolDefinition } from '@/types';

export const IMAGE_REQUEST_COUNT_MAX = 5;
export const IMAGE_ACTION_PATTERN = /\b(create|draw|generate|make|render|olu[sş]tur|u[̈u]ret|yarat|ciz|[çc]iz)\b/i;
export const IMAGE_SUBJECT_PATTERN = /\b(avatar|drawing|g[oö]rsel|icon|illustration|image|logo|picture|poster|render|resim|sketch|wallpaper|foto(?:g(?:raf)?)?)\b/i;
export const IMAGE_ONLY_MODEL_PATTERNS = [
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image',
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'imagen-3.0-generate-001',
] as const;
export const TOOL_LOOP_RECENT_SIGNATURE_WINDOW = 4;
export const TOOL_LOOP_LOW_SIGNAL_CONTENT_THRESHOLD = 80;
export const REPEATED_TOOL_RESULT_HINT = 'This exact tool call was already executed earlier in this turn. Reuse the earlier result instead of calling the same tool again.';
export const TOOL_LOOP_DIRECT_ANSWER_HINT = 'Use the tool results already in the conversation and answer directly. Do not call more tools unless the user explicitly asks for new evidence.';

export function getReasoningEffort(modelId: string, appSettings: AppSettings | undefined) {
    return appSettings?.modelSettings?.[modelId]?.reasoningLevel;
}

export function getMessageTextContent(message: Message): string {
    if (typeof message.content === 'string') {
        return message.content;
    }

    return (message.content as MessageContentPart[])
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n')
        .trim();
}

export function isExplicitImageRequest(message: Message): boolean {
    const text = getMessageTextContent(message).toLowerCase();
    if (text.trim().length === 0) {
        return false;
    }

    return IMAGE_SUBJECT_PATTERN.test(text) && IMAGE_ACTION_PATTERN.test(text);
}

export function extractImageRequestCount(message: Message): number {
    const metadataCount = message.metadata?.imageRequestCount;
    if (typeof metadataCount === 'number' && Number.isFinite(metadataCount)) {
        return Math.max(1, Math.min(metadataCount, IMAGE_REQUEST_COUNT_MAX));
    }

    const text = getMessageTextContent(message);
    const match = text.match(/(\d+)\s*(?:adet|image(?:s)?|photo(?:s)?|picture(?:s)?|tane|g[oö]rsel|resim|foto(?:g(?:raf)?)?)/i);
    if (!match?.[1]) {
        return 1;
    }

    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed)) {
        return 1;
    }

    return Math.max(1, Math.min(parsed, IMAGE_REQUEST_COUNT_MAX));
}

export function isImageOnlyModel(modelId: string): boolean {
    const normalizedModelId = modelId.trim().toLowerCase();
    return IMAGE_ONLY_MODEL_PATTERNS.some(pattern => normalizedModelId.includes(pattern));
}

export function createModelToolList(allTools: ToolDefinition[]): ToolDefinition[] {
    const excludedToolNames = new Set([
        'generate_image',
        'propose_plan',
        'update_plan_step',
        'revise_plan',
    ]);

    return allTools.filter(toolDefinition => {
        const toolName = toolDefinition?.function?.name;
        if (!toolName || excludedToolNames.has(toolName)) {
            return false;
        }
        return true;
    });
}

export function normalizeToolArgs(rawArguments: unknown): Record<string, unknown> {
    if (rawArguments && typeof rawArguments === 'object' && !Array.isArray(rawArguments)) {
        return rawArguments as Record<string, unknown>;
    }
    return {};
}

export function isExecutableToolCall(
    toolCall: NonNullable<Message['toolCalls']>[number]
): boolean {
    const toolCallId = typeof toolCall.id === 'string' ? toolCall.id.trim() : '';
    const toolName = typeof toolCall.function?.name === 'string' ? toolCall.function.name.trim() : '';
    return toolCallId.length > 0 && toolName.length > 0;
}

/**
 * Extracts unique tool family names from a single signature string.
 * Signature format: "toolName:args|toolName:args"
 */
export function extractToolFamilyNamesFromSignature(signature: string): string[] {
    if (signature.length === 0) {
        return [];
    }
    const segments = signature.split('|');
    const names = new Set<string>();
    for (const segment of segments) {
        const colonIndex = segment.indexOf(':');
        const name = colonIndex >= 0 ? segment.slice(0, colonIndex).trim() : segment.trim();
        if (name.length > 0) {
            names.add(name);
        }
    }
    return Array.from(names);
}

/**
 * Checks whether all recent tool signatures use the same tool family,
 * indicating semantic repetition with argument variation.
 */
export function isMonotonousToolFamily(
    recentSignatures: string[],
    minSignatures: number
): boolean {
    if (recentSignatures.length < minSignatures) {
        return false;
    }
    const targetSignatures = recentSignatures.slice(-minSignatures);
    const allFamilies = targetSignatures.flatMap(extractToolFamilyNamesFromSignature);
    if (allFamilies.length === 0) {
        return false;
    }
    const uniqueFamilies = new Set(allFamilies);
    return uniqueFamilies.size === 1;
}

