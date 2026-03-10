import { BaseService } from '@main/services/base.service';
import {
    SessionCapability,
    SessionEventEnvelope,
    SessionEventType,
    SessionMode,
    SessionRecoveryAction,
    SessionRecoveryState,
    SessionStartOptions,
    SessionState,
    SessionStatus,
    SessionSubmitMessageOptions,
} from '@shared/types/session-engine';

export interface SessionRuntimeModule {
    readonly id: SessionCapability;
    supportsMode(mode: SessionMode): boolean;
    onAttach?(state: SessionState): Promise<void>;
    onDetach?(state: SessionState): Promise<void>;
    onBeforeMessage?(state: SessionState, options: SessionSubmitMessageOptions): Promise<void>;
    onStatusChange?(state: SessionState, previousStatus: SessionStatus): Promise<void>;
}

export abstract class BaseSessionEngine extends BaseService {
    private readonly modules = new Map<SessionCapability, SessionRuntimeModule>();
    private state: SessionState | null = null;

    protected constructor(name: string) {
        super(name);
    }

    protected setState(state: SessionState): void {
        this.state = state;
    }

    protected getState(): SessionState {
        if (!this.state) {
            throw new Error(`${this.name} state has not been initialized`);
        }

        return this.state;
    }

    protected registerModule(module: SessionRuntimeModule): void {
        this.modules.set(module.id, module);
    }

    protected registerModules(modules: SessionRuntimeModule[]): void {
        for (const module of modules) {
            this.registerModule(module);
        }
    }

    protected buildInitialRecoveryState(createdAt: number): SessionRecoveryState {
        return {
            canResume: false,
            requiresReview: false,
            action: 'none',
            lastTransitionAt: createdAt,
        };
    }

    protected supportsCapability(capability: SessionCapability): boolean {
        return this.modules.has(capability);
    }

    async start(options: SessionStartOptions): Promise<SessionState> {
        const state = this.buildInitialState(options);
        this.setState(state);
        await this.attachModules(state);
        await this.emitLifecycleEvent('session.started');
        return state;
    }

    async disposeSession(): Promise<void> {
        if (!this.state) {
            return;
        }

        const state = this.getState();
        const modules = this.getModulesForState(state);
        for (const module of modules) {
            await module.onDetach?.(state);
            await this.emitLifecycleEvent('session.module.detached', {
                capability: module.id,
            });
        }
        this.state = null;
    }

    async submitMessage(options: SessionSubmitMessageOptions): Promise<SessionState> {
        const state = this.getState();
        await this.runBeforeMessageHooks(state, options);
        const nextState = await this.handleMessage(state, options);
        this.setState(nextState);
        await this.emitLifecycleEvent('session.message.created');
        return nextState;
    }

    protected async updateStatus(status: SessionStatus, lastError?: string): Promise<SessionState> {
        return this.patchState({
            status,
            lastError,
        });
    }

    protected abstract buildInitialState(options: SessionStartOptions): SessionState;
    protected abstract handleMessage(
        state: SessionState,
        options: SessionSubmitMessageOptions
    ): Promise<SessionState>;
    protected abstract emit(event: SessionEventEnvelope): Promise<void>;

    protected async patchState(
        patch: Partial<SessionState>,
        eventType: SessionEventType = 'session.status.changed',
        payload?: SessionEventEnvelope['payload']
    ): Promise<SessionState> {
        const state = this.getState();
        const previousStatus = state.status;
        const nextState: SessionState = {
            ...state,
            ...patch,
            recovery: this.buildRecoveryState({
                state,
                patch,
                updatedAt: patch.updatedAt ?? Date.now(),
            }),
            updatedAt: patch.updatedAt ?? Date.now(),
        };

        this.setState(nextState);

        if (nextState.status !== previousStatus) {
            await this.runStatusHooks(nextState, previousStatus);
        }

        await this.emitLifecycleEvent(
            eventType,
            payload ?? this.buildDefaultEventPayload(eventType, previousStatus, nextState),
            nextState
        );
        return nextState;
    }

    private getModulesForState(state: SessionState): SessionRuntimeModule[] {
        return state.capabilities
            .map(capability => this.modules.get(capability))
            .filter((module): module is SessionRuntimeModule => Boolean(module))
            .filter(module => module.supportsMode(state.mode));
    }

    private async attachModules(state: SessionState): Promise<void> {
        const modules = this.getModulesForState(state);
        for (const module of modules) {
            await module.onAttach?.(state);
            await this.emitLifecycleEvent('session.module.attached', {
                capability: module.id,
            }, state);
        }
    }

    private async runBeforeMessageHooks(
        state: SessionState,
        options: SessionSubmitMessageOptions
    ): Promise<void> {
        const modules = this.getModulesForState(state);
        for (const module of modules) {
            await module.onBeforeMessage?.(state, options);
        }
    }

    private async runStatusHooks(
        state: SessionState,
        previousStatus: SessionStatus
    ): Promise<void> {
        const modules = this.getModulesForState(state);
        for (const module of modules) {
            await module.onStatusChange?.(state, previousStatus);
        }
    }

    private async emitLifecycleEvent(
        type: SessionEventEnvelope['type'],
        payload?: SessionEventEnvelope['payload'],
        stateOverride?: SessionState
    ): Promise<void> {
        const state = stateOverride ?? this.getState();
        await this.emit({
            sessionId: state.id,
            mode: state.mode,
            type,
            emittedAt: Date.now(),
            payload,
        });
    }

    private buildRecoveryState(input: {
        state: SessionState;
        patch: Partial<SessionState>;
        updatedAt: number;
    }): SessionRecoveryState {
        const nextStatus = input.patch.status ?? input.state.status;
        const hint = input.patch.lastError ?? input.state.lastError ?? input.state.recovery.hint;
        const action = this.getRecoveryAction(input.state.mode, nextStatus);
        const canResume = action !== 'none' && action !== 'review_before_resume';
        const requiresReview = action === 'review_before_resume';

        return {
            canResume,
            requiresReview,
            action,
            lastTransitionAt:
                nextStatus !== input.state.status
                    ? input.updatedAt
                    : input.state.recovery.lastTransitionAt,
            ...(hint ? { hint } : {}),
        };
    }

    private getRecoveryAction(
        mode: SessionMode,
        status: SessionStatus
    ): SessionRecoveryAction {
        if (status === 'waiting_for_input' || status === 'paused' || status === 'interrupted') {
            if (mode === 'automation') {
                return 'resume_automation';
            }

            if (mode === 'workspace') {
                return 'resume_workspace';
            }

            return 'resume_conversation';
        }

        if (status === 'failed') {
            return 'review_before_resume';
        }

        return 'none';
    }

    private buildDefaultEventPayload(
        eventType: SessionEventType,
        previousStatus: SessionStatus,
        state: SessionState
    ): SessionEventEnvelope['payload'] | undefined {
        if (eventType !== 'session.status.changed') {
            return undefined;
        }

        return {
            status: state.status,
            previousStatus,
            recovery: {
                canResume: state.recovery.canResume,
                requiresReview: state.recovery.requiresReview,
                action: state.recovery.action,
                lastTransitionAt: state.recovery.lastTransitionAt,
                ...(state.recovery.hint ? { hint: state.recovery.hint } : {}),
            },
            ...(state.lastError ? { lastError: state.lastError } : {}),
        };
    }
}
