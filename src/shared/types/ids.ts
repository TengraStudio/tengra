export type Brand<T, B extends string> = T & { readonly __brand: B };

export type ChatId = Brand<string, 'ChatId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type TerminalSessionId = Brand<string, 'TerminalSessionId'>;

function isUuidLike(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function toChatId(value: string): ChatId {
    return value as ChatId;
}

export function isChatId(value: unknown): value is ChatId {
    return typeof value === 'string' && value.length > 0 && (isUuidLike(value) || value.startsWith('chat-'));
}

export function toProjectId(value: string): ProjectId {
    return value as ProjectId;
}

export function isProjectId(value: unknown): value is ProjectId {
    return typeof value === 'string' && value.length > 0 && (isUuidLike(value) || value.startsWith('proj-'));
}

export function toTerminalSessionId(value: string): TerminalSessionId {
    return value as TerminalSessionId;
}

export function isTerminalSessionId(value: unknown): value is TerminalSessionId {
    return typeof value === 'string' && value.length > 0 && value.startsWith('term-');
}
