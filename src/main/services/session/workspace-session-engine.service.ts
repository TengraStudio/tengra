/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EventBusService } from '@main/services/system/event-bus.service';
import {
    SessionEventEnvelope,
    SessionMessageEnvelope,
    SessionStartOptions,
    SessionState,
    SessionSubmitMessageOptions,
} from '@shared/types/session-engine';

import { BaseSessionEngine, SessionRuntimeModule } from './base-session-engine.service';

export class WorkspaceSessionEngine extends BaseSessionEngine {
    constructor(
        private readonly eventBus: EventBusService,
        modules: SessionRuntimeModule[] = []
    ) {
        super('WorkspaceSessionEngine');
        this.registerModules(modules);
    }

    protected buildInitialState(options: SessionStartOptions): SessionState {
        const now = Date.now();
        return {
            id: options.sessionId,
            mode: options.mode,
            status: 'idle',
            capabilities: [...options.capabilities],
            model: options.model,
            metadata: options.metadata ?? {},
            messages: options.initialMessages ? [...options.initialMessages] : [],
            recovery: this.buildInitialRecoveryState(now),
            createdAt: now,
            updatedAt: now,
        };
    }

    protected async handleMessage(
        state: SessionState,
        options: SessionSubmitMessageOptions
    ): Promise<SessionState> {
        return {
            ...state,
            messages: [...state.messages, options.message],
            updatedAt: Date.now(),
        };
    }

    protected async emit(event: SessionEventEnvelope): Promise<void> {
        this.eventBus.emitCustom('session:event', event);
    }

    async markPreparing(): Promise<SessionState> {
        return this.updateStatus('preparing');
    }

    async markStreaming(): Promise<SessionState> {
        return this.updateStatus('streaming');
    }

    async markWaitingForInput(): Promise<SessionState> {
        return this.updateStatus('waiting_for_input');
    }

    async markInterrupted(message?: string): Promise<SessionState> {
        return this.updateStatus('interrupted', message);
    }

    async markFailed(message: string): Promise<SessionState> {
        return this.updateStatus('failed', message);
    }

    async markCompleted(): Promise<SessionState> {
        return this.updateStatus('completed');
    }

    getSnapshot(): SessionState {
        return this.getState();
    }

    async appendMessage(message: SessionMessageEnvelope): Promise<SessionState> {
        return this.submitMessage({ message });
    }
}

