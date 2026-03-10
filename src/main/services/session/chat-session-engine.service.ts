import { EventBusService } from '@main/services/system/event-bus.service';
import {
    SessionEventEnvelope,
    SessionMessageEnvelope,
    SessionStartOptions,
    SessionState,
    SessionSubmitMessageOptions,
} from '@shared/types/session-engine';

import { BaseSessionEngine, SessionRuntimeModule } from './base-session-engine.service';

export class ChatSessionEngine extends BaseSessionEngine {
    constructor(
        private readonly eventBus: EventBusService,
        modules: SessionRuntimeModule[] = []
    ) {
        super('ChatSessionEngine');
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
