import { BaseService } from '@main/services/base.service';
import {
    SessionRecoverySnapshot,
    SessionState,
} from '@shared/types/session-engine';

import { SessionRegistryReader } from './session-registry.contract';

const MAX_SESSION_RECOVERY_HINT_LENGTH = 1000;
const MAX_SESSION_LAST_ERROR_LENGTH = 5000;

const clampSessionText = (value: string | undefined, maxLength: number): string | undefined => {
    if (!value) {
        return undefined;
    }

    return value.length <= maxLength ? value : value.slice(0, maxLength);
};

const sanitizeSessionState = (snapshot: SessionState): SessionState => ({
    ...snapshot,
    lastError: clampSessionText(snapshot.lastError, MAX_SESSION_LAST_ERROR_LENGTH),
    recovery: {
        ...snapshot.recovery,
        hint: clampSessionText(snapshot.recovery.hint, MAX_SESSION_RECOVERY_HINT_LENGTH),
    },
});

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
}
