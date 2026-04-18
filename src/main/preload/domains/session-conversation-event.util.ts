/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { SessionConversationGenerationStatus } from '@shared/types/session-conversation';
import type { SessionEventEnvelope } from '@shared/types/session-engine';

const GENERATING_STATUSES = new Set(['preparing', 'streaming']);

export function toSessionConversationGenerationStatus(
    value: RuntimeValue
): SessionConversationGenerationStatus | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const event = value as Partial<SessionEventEnvelope> & {
        payload?: Record<string, RuntimeValue>;
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
