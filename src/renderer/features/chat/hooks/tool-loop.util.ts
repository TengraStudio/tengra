/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Message } from '@/types';

export function buildModelConversation(
    messages: Message[],
    assistantMessage: Message,
    toolResults: Message[]
): Message[] {
    return [...messages, assistantMessage, ...toolResults];
}

export function hasAlternatingToolLoop(
    recentSignatures: string[],
    recentSignatureWindow: number
): boolean {
    if (recentSignatures.length < recentSignatureWindow) {
        return false;
    }
    const [first, second, third, fourth] = recentSignatures.slice(-recentSignatureWindow);
    if (!first || !second || !third || !fourth) {
        return false;
    }
    return first === third && second === fourth && first !== second;
}

export function updateRecentToolSignatures(
    recentSignatures: string[],
    nextSignature: string,
    recentSignatureWindow: number
): string[] {
    const next = [...recentSignatures, nextSignature];
    if (next.length <= recentSignatureWindow) {
        return next;
    }
    return next.slice(next.length - recentSignatureWindow);
}

