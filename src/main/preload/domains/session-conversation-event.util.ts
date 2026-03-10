import type { SessionConversationGenerationStatus } from '@shared/types/session-conversation';
import type { SessionEventEnvelope } from '@shared/types/session-engine';

const GENERATING_STATUSES = new Set(['preparing', 'streaming']);

export function toSessionConversationGenerationStatus(
    value: unknown
): SessionConversationGenerationStatus | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const event = value as Partial<SessionEventEnvelope> & {
        payload?: Record<string, unknown>;
    };
    if (
        event.type !== 'session.status.changed' ||
        (event.mode !== 'chat' && event.mode !== 'workspace') ||
        typeof event.sessionId !== 'string'
    ) {
        return null;
    }

    const status = event.payload?.['status'];
    if (typeof status !== 'string') {
        return null;
    }

    return {
        chatId: event.sessionId,
        isGenerating: GENERATING_STATUSES.has(status),
    };
}
