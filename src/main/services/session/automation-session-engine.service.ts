import { EventBusService } from '@main/services/system/event-bus.service';
import {
    AutomationSessionMessageMetadata,
    AutomationSessionMetadataExtras,
} from '@shared/types/automation-session';
import { AutomationWorkflowState } from '@shared/types/automation-workflow';
import { Message } from '@shared/types/chat';
import type { JsonObject } from '@shared/types/common';
import {
    SessionEventEnvelope,
    SessionMessageEnvelope,
    SessionStartOptions,
    SessionState,
    SessionStatus,
    SessionSubmitMessageOptions,
} from '@shared/types/session-engine';

import { BaseSessionEngine, SessionRuntimeModule } from './base-session-engine.service';

const mapWorkflowStatusToSessionStatus = (
    workflowStatus: AutomationWorkflowState['status']
): SessionStatus => {
    switch (workflowStatus) {
        case 'planning':
            return 'preparing';
        case 'running':
            return 'streaming';
        case 'waiting_for_approval':
            return 'waiting_for_input';
        case 'paused':
            return 'paused';
        case 'failed':
        case 'error':
            return 'failed';
        case 'completed':
            return 'completed';
        case 'idle':
        default:
            return 'idle';
    }
};

const compactJsonObject = <T extends JsonObject>(record: T): T => {
    return Object.fromEntries(
        Object.entries(record).filter(([, value]) => value !== undefined)
    ) as T;
};

const getSessionRole = (
    role: Message['role']
): SessionMessageEnvelope['role'] => {
    switch (role) {
        case 'assistant':
            return 'assistant';
        case 'system':
            return 'system';
        case 'tool':
            return 'tool';
        case 'user':
        default:
            return 'user';
    }
};

const toSessionMessageContent = (content: Message['content']): string => {
    if (typeof content === 'string') {
        return content;
    }

    return content
        .map(part => {
            if (part.type === 'text') {
                return part.text;
            }
            return part.image_url.url;
        })
        .join('\n');
};

const toSessionMessageMetadata = (
    message: Message
): AutomationSessionMessageMetadata | undefined => {
    const metadata: AutomationSessionMessageMetadata = {
        ...(message.metadata ?? {}),
    };

    if (message.reasoning) {
        metadata.reasoning = message.reasoning;
    }

    if (message.toolCalls?.length) {
        metadata.toolCalls = message.toolCalls;
    }

    if (message.toolCallId) {
        metadata.toolCallId = message.toolCallId;
    }

    if (message.toolResults) {
        metadata.toolResults = message.toolResults;
    }

    if (message.provider) {
        metadata.provider = message.provider;
    }

    if (message.model) {
        metadata.model = message.model;
    }

    if (typeof message.responseTime === 'number') {
        metadata.responseTime = message.responseTime;
    }

    if (message.sources?.length) {
        metadata.sources = message.sources;
    }

    if (message.images?.length) {
        metadata.images = message.images;
    }

    const compactedMetadata = compactJsonObject(metadata);
    return Object.keys(compactedMetadata).length > 0 ? compactedMetadata : undefined;
};

const toSessionMessages = (
    history: AutomationWorkflowState['history']
): SessionMessageEnvelope[] => {
    return history.map(message => ({
        id: message.id,
        role: getSessionRole(message.role),
        content: toSessionMessageContent(message.content),
        createdAt: message.timestamp.getTime(),
        metadata: toSessionMessageMetadata(message),
    }));
};

const buildWorkflowExtras = (
    workflowState: AutomationWorkflowState,
    previousExtras?: JsonObject
): AutomationSessionMetadataExtras => {
    const extras: AutomationSessionMetadataExtras = {
        ...previousExtras,
        workflowStatus: workflowState.status,
        currentTask: workflowState.currentTask || null,
        currentNodeId: workflowState.nodeId ?? null,
        plan: workflowState.plan,
        totalTokens: workflowState.totalTokens,
        timing: workflowState.timing,
        estimatedPlanCost: workflowState.estimatedPlanCost,
        actualPlanCost: workflowState.actualPlanCost,
        performanceMetrics: workflowState.performanceMetrics,
        systemMode: workflowState.config?.systemMode ?? null,
        agentProfileId: workflowState.config?.agentProfileId ?? null,
    };

    return compactJsonObject(extras);
};

export class AutomationSessionEngine extends BaseSessionEngine {
    constructor(
        private readonly eventBus: EventBusService,
        modules: SessionRuntimeModule[] = []
    ) {
        super('AutomationSessionEngine');
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

    async markPlanning(): Promise<SessionState> {
        return this.patchState({
            status: 'preparing',
            metadata: {
                ...this.getState().metadata,
                extras: {
                    ...this.getState().metadata.extras,
                    workflowStatus: 'planning',
                },
            },
        });
    }

    async markRunning(): Promise<SessionState> {
        return this.patchState({
            status: 'streaming',
            metadata: {
                ...this.getState().metadata,
                extras: {
                    ...this.getState().metadata.extras,
                    workflowStatus: 'running',
                },
            },
        });
    }

    async markWaitingForApproval(): Promise<SessionState> {
        return this.patchState({
            status: 'waiting_for_input',
            metadata: {
                ...this.getState().metadata,
                extras: {
                    ...this.getState().metadata.extras,
                    workflowStatus: 'waiting_for_approval',
                },
            },
        });
    }

    async markPaused(): Promise<SessionState> {
        return this.patchState({
            status: 'paused',
            metadata: {
                ...this.getState().metadata,
                extras: {
                    ...this.getState().metadata.extras,
                    workflowStatus: 'paused',
                },
            },
        });
    }

    async markInterrupted(message?: string): Promise<SessionState> {
        return this.patchState({
            status: 'interrupted',
            lastError: message,
            metadata: {
                ...this.getState().metadata,
                extras: {
                    ...this.getState().metadata.extras,
                    workflowStatus: 'interrupted',
                },
            },
        });
    }

    async markFailed(message: string): Promise<SessionState> {
        return this.patchState({
            status: 'failed',
            lastError: message,
            metadata: {
                ...this.getState().metadata,
                extras: {
                    ...this.getState().metadata.extras,
                    workflowStatus: 'failed',
                },
            },
        });
    }

    async markCompleted(): Promise<SessionState> {
        return this.patchState({
            status: 'completed',
            metadata: {
                ...this.getState().metadata,
                extras: {
                    ...this.getState().metadata.extras,
                    workflowStatus: 'completed',
                },
            },
        });
    }

    async syncWorkflowState(workflowState: AutomationWorkflowState): Promise<SessionState> {
        const current = this.getState();
        const nextStatus = mapWorkflowStatusToSessionStatus(workflowState.status);
        const nextMessages = workflowState.history.length > 0
            ? toSessionMessages(workflowState.history)
            : current.messages;

        return this.patchState(
            {
                status: nextStatus,
                lastError: workflowState.lastError,
                model: workflowState.config?.model
                    ? {
                        ...current.model,
                        provider: workflowState.config.model.provider,
                        model: workflowState.config.model.model,
                    }
                    : current.model,
                metadata: {
                    ...current.metadata,
                    taskId: workflowState.taskId ?? current.metadata.taskId,
                    workspaceId:
                        workflowState.config?.workspaceId ?? current.metadata.workspaceId,
                    extras: buildWorkflowExtras(workflowState, current.metadata.extras),
                },
                messages: nextMessages,
            },
            'session.status.changed',
            {
                workflowStatus: workflowState.status,
                planStepCount: workflowState.plan.length,
                hasWorkflowError: Boolean(workflowState.lastError),
            }
        );
    }

    async syncModel(provider: string, model: string): Promise<SessionState> {
        return this.patchState(
            {
                model: {
                    ...this.getState().model,
                    provider,
                    model,
                },
            },
            'session.status.changed',
            {
                provider,
                model,
            }
        );
    }

    getSnapshot(): SessionState {
        return this.getState();
    }

    async appendMessage(message: SessionMessageEnvelope): Promise<SessionState> {
        return this.submitMessage({ message });
    }
}
