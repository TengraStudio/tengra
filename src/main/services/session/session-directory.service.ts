/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { SESSION_CHANNELS } from '@shared/constants/ipc-channels';
import { RuntimeValue } from '@shared/types/common';
import {
    SessionRecoverySnapshot,
    SessionState,
} from '@shared/types/session-engine';

import { SessionRegistryReader } from './session-registry.contract';

const MAX_SESSION_RECOVERY_HINT_LENGTH = 1000;
const MAX_SESSION_LAST_ERROR_LENGTH = 5000;
const MAX_SESSION_MESSAGE_CONTENT_LENGTH = 200000;
const SESSION_MESSAGE_TRUNCATION_NOTICE = '\n\n[Session content truncated by Tengra.]';

const clampSessionText = (value: string | undefined, maxLength: number): string | undefined => {
    if (!value) {
        return undefined;
    }

    return value.length <= maxLength ? value : value.slice(0, maxLength);
};

const sanitizeSessionState = (snapshot: SessionState): SessionState => ({
    ...snapshot,
    lastError: clampSessionText(snapshot.lastError, MAX_SESSION_LAST_ERROR_LENGTH),
    messages: snapshot.messages.map(message => ({
        ...message,
        content: clampSessionMessageContent(message.content),
        metadata: message.content.length > MAX_SESSION_MESSAGE_CONTENT_LENGTH
            ? { ...message.metadata, truncatedForIpc: true }
            : message.metadata,
    })),
    recovery: {
        ...snapshot.recovery,
        hint: clampSessionText(snapshot.recovery.hint, MAX_SESSION_RECOVERY_HINT_LENGTH),
    },
});

function clampSessionMessageContent(value: string): string {
    if (value.length <= MAX_SESSION_MESSAGE_CONTENT_LENGTH) {
        return value;
    }

    const availableLength = Math.max(
        0,
        MAX_SESSION_MESSAGE_CONTENT_LENGTH - SESSION_MESSAGE_TRUNCATION_NOTICE.length
    );
    return `${value.slice(0, availableLength)}${SESSION_MESSAGE_TRUNCATION_NOTICE}`;
}

export class SessionDirectoryService extends BaseService {
    private readonly registries = new Map<string, SessionRegistryReader>();

    constructor() {
        super('SessionDirectoryService');
    }

    registerRegistry(id: string, registry: SessionRegistryReader): void {
        this.registries.set(id, registry);
    }

    unregisterRegistry(id: string): void {
        this.registries.delete(id);
    }

    getSnapshot(sessionId: string): SessionState | null {
        for (const registry of this.registries.values()) {
            const snapshot = registry.getSnapshot(sessionId);
            if (snapshot) {
                return sanitizeSessionState(snapshot);
            }
        }

        return null;
    }

    listRecoverySnapshots(): SessionRecoverySnapshot[] {
        const merged = new Map<string, SessionRecoverySnapshot>();

        for (const registry of this.registries.values()) {
            for (const snapshot of registry.listRecoverySnapshots()) {
                const existing = merged.get(snapshot.sessionId);
                if (!existing || existing.updatedAt <= snapshot.updatedAt) {
                    merged.set(snapshot.sessionId, snapshot);
                }
            }
        }

        return Array.from(merged.values()).sort((left, right) => {
            return right.updatedAt - left.updatedAt;
        });
    }

    getRegistryIds(): string[] {
        return Array.from(this.registries.keys());
    }

    override async cleanup(): Promise<void> {
        this.registries.clear();
    }

    // --- IPC Decorated Methods ---

    @ipc(SESSION_CHANNELS.GET_STATE)
    async getSnapshotIpc(sessionId: string): Promise<RuntimeValue> {
        const result = this.getSnapshot(sessionId);
        return serializeToIpc(result);
    }

    @ipc(SESSION_CHANNELS.LIST)
    async listSnapshotsIpc(): Promise<RuntimeValue> {
        const result = this.listRecoverySnapshots();
        return serializeToIpc(result);
    }

    @ipc(SESSION_CHANNELS.HEALTH)
    async getHealthIpc(): Promise<RuntimeValue> {
        const snapshots = this.listRecoverySnapshots();
        const result = {
            status: 'ready',
            activeSessions: snapshots.length,
        };
        return serializeToIpc(result);
    }
}

