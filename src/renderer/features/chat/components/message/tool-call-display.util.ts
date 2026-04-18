/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ToolCall } from '@shared/types/chat';

function readToolCallName(toolCall: ToolCall): string {
    return typeof toolCall.function?.name === 'string' ? toolCall.function.name : '';
}

function readToolCallArguments(toolCall: ToolCall): string {
    return typeof toolCall.function?.arguments === 'string' ? toolCall.function.arguments : '';
}

function hasDisplayableToolCallContent(toolCall: ToolCall): boolean {
    return readToolCallName(toolCall).trim().length > 0
        || readToolCallArguments(toolCall).trim().length > 0;
}

function normalizeToolCallForDisplay(toolCall: ToolCall): ToolCall {
    return {
        ...toolCall,
        function: {
            ...(toolCall.function ?? {}),
            name: readToolCallName(toolCall),
            arguments: readToolCallArguments(toolCall),
        },
    };
}

function buildToolCallSignature(toolCall: ToolCall): string {
    const toolName = readToolCallName(toolCall).trim();
    const toolArgs = readToolCallArguments(toolCall).trim();
    return `${toolName}:${toolArgs}`;
}

export function compactToolCallsForDisplay(toolCalls?: ToolCall[]): ToolCall[] | undefined {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
        return undefined;
    }

    const compacted: ToolCall[] = [];
    const signatureIndex = new Map<string, number>();
    for (const rawToolCall of toolCalls) {
        if (!hasDisplayableToolCallContent(rawToolCall)) {
            continue;
        }
        const toolCall = normalizeToolCallForDisplay(rawToolCall);
        const signature = buildToolCallSignature(toolCall);
        const existingIndex = signatureIndex.get(signature);
        if (typeof existingIndex === 'number') {
            compacted[existingIndex] = toolCall;
            continue;
        }
        signatureIndex.set(signature, compacted.length);
        compacted.push(toolCall);
    }

    return compacted.length > 0 ? compacted : undefined;
}
