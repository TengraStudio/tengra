/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type ChatId = Brand<string, 'ChatId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type TerminalSessionId = Brand<string, 'TerminalSessionId'>;

function isUuidLike(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function toChatId(value: string): ChatId {
    return value as ChatId;
}

export function isChatId(value: RuntimeValue): value is ChatId {
    return typeof value === 'string' && value.length > 0 && (isUuidLike(value) || value.startsWith('chat-'));
}

export function toWorkspaceId(value: string): WorkspaceId {
    return value as WorkspaceId;
}

export function isWorkspaceId(value: RuntimeValue): value is WorkspaceId {
    return typeof value === 'string' && value.length > 0 && (isUuidLike(value) || value.startsWith('proj-'));
}

export function toTerminalSessionId(value: string): TerminalSessionId {
    return value as TerminalSessionId;
}

export function isTerminalSessionId(value: RuntimeValue): value is TerminalSessionId {
    return typeof value === 'string' && value.length > 0 && value.startsWith('term-');
}

