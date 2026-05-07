/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import {
    SessionMessageEnvelope,
    SessionMode,
    SessionRecoverySnapshot,
    SessionStartOptions,
    SessionState,
} from '@shared/types/session-engine';

import { ChatSessionEngine } from './chat-session-engine.service';
import { SessionModuleRegistryService } from './session-module-registry.service';
import { SessionRegistryReader } from './session-registry.contract';
import { WorkspaceSessionEngine } from './workspace-session-engine.service';

type ConversationSessionEngine = ChatSessionEngine | WorkspaceSessionEngine;
const MAX_RECOVERY_HINT_LENGTH = 1000;

const getLastMessagePreview = (state: SessionState): string | undefined => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) {
        return undefined;
    }

    const preview = lastMessage.content.trim().replace(/\s+/g, ' ');
    return preview ? preview.slice(0, 280) : undefined;
};

const truncateRecoveryHint = (value: string | undefined): string | undefined => {
    if (!value) {
        return undefined;
    }

    return value.length <= MAX_RECOVERY_HINT_LENGTH
        ? value
        : value.slice(0, MAX_RECOVERY_HINT_LENGTH);
};

const buildRecoveryState = (state: SessionState): SessionState['recovery'] => ({
    ...state.recovery,
    hint: truncateRecoveryHint(state.recovery.hint),
});

export class ChatSessionRegistryService extends BaseService implements SessionRegistryReader {
    private readonly sessions = new Map<string, ConversationSessionEngine>();

    constructor(
        private readonly eventBus: EventBusService,
        private readonly sessionModuleRegistryService?: SessionModuleRegistryService
    ) {
        super('ChatSessionRegistryService');
    }

    override async cleanup(): Promise<void> {
        for (const session of this.sessions.values()) {
            await session.disposeSession();
        }
        this.sessions.clear();
    }

    async startSession(options: SessionStartOptions): Promise<ConversationSessionEngine> {
        const existing = this.sessions.get(options.sessionId);
        if (existing) {
            return existing;
        }

        const session = this.createSessionEngine(options.mode);
        await session.start(options);
        this.sessions.set(options.sessionId, session);
        return session;
    }

    getSession(sessionId: string): ConversationSessionEngine | null {
        return this.sessions.get(sessionId) ?? null;
    }

    getSnapshot(sessionId: string): SessionState | null {
        return this.sessions.get(sessionId)?.getSnapshot() ?? null;
    }

    listRecoverySnapshots(): SessionRecoverySnapshot[] {
        return Array.from(this.sessions.values()).map(session => {
            const state = session.getSnapshot();
            return {
                sessionId: state.id,
                mode: state.mode,
                status: state.status,
                capabilities: [...state.capabilities],
                messageCount: state.messages.length,
                metadata: state.metadata,
                updatedAt: state.updatedAt,
                recoveryHint: truncateRecoveryHint(state.lastError),
                recovery: buildRecoveryState(state),
                lastMessagePreview: getLastMessagePreview(state),
            };
        });
    }

    async markPreparing(sessionId: string): Promise<void> {
        const session = this.requireSession(sessionId);
        await session.markPreparing();
    }

    async markStreaming(sessionId: string): Promise<void> {
        const session = this.requireSession(sessionId);
        await session.markStreaming();
    }

    async markWaitingForInput(sessionId: string): Promise<void> {
        const session = this.requireSession(sessionId);
        await session.markWaitingForInput();
    }

    async markInterrupted(sessionId: string, message?: string): Promise<void> {
        const session = this.requireSession(sessionId);
        await session.markInterrupted(message);
    }

    async markFailed(sessionId: string, message: string): Promise<void> {
        const session = this.requireSession(sessionId);
        await session.markFailed(message);
    }

    async markCompleted(sessionId: string): Promise<void> {
        const session = this.requireSession(sessionId);
        await session.markCompleted();
    }

    async appendMessage(sessionId: string, message: SessionMessageEnvelope): Promise<void> {
        const session = this.requireSession(sessionId);
        await session.appendMessage(message);
    }

    removeSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            void session.disposeSession();
        }
        this.sessions.delete(sessionId);
    }

    private requireSession(sessionId: string): ConversationSessionEngine {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Chat session ${sessionId} has not been started`);
        }

        return session;
    }

    private createSessionEngine(mode: SessionMode): ConversationSessionEngine {
        if (mode === 'workspace') {
            return new WorkspaceSessionEngine(
                this.eventBus,
                this.sessionModuleRegistryService?.getModules() ?? []
            );
        }

        return new ChatSessionEngine(
            this.eventBus,
            this.sessionModuleRegistryService?.getModules() ?? []
        );
    }
}

