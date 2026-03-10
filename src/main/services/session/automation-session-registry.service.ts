import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SESSION_RUNTIME_EVENTS } from '@shared/constants/session-runtime-events';
import { AutomationWorkflowStateSchema } from '@shared/schemas/automation-workflow-hardening.schema';
import { AutomationSessionMetadataExtras } from '@shared/types/automation-session';
import { AgentStartOptions,AutomationWorkflowState } from '@shared/types/automation-workflow';
import {
    SessionCapability,
    SessionMessageEnvelope,
    SessionRecoverySnapshot,
    SessionStartOptions,
    SessionState,
} from '@shared/types/session-engine';

import { AutomationSessionEngine } from './automation-session-engine.service';
import { SessionModuleRegistryService } from './session-module-registry.service';
import { SessionRegistryReader } from './session-registry.contract';

type AutomationPhase = 'planning' | 'running';

const DEFAULT_MODEL_SELECTION = {
    provider: 'automation',
    model: 'automation',
};

const compactJsonObject = <T extends Record<string, unknown>>(record: T): T => {
    return Object.fromEntries(
        Object.entries(record).filter(([, value]) => value !== undefined)
    ) as T;
};

const buildInitialAutomationExtras = (
    options?: AgentStartOptions,
    workflowState?: AutomationWorkflowState
): AutomationSessionMetadataExtras => {
    return compactJsonObject({
        workflowStatus: workflowState?.status ?? 'idle',
        currentTask: options?.task ?? workflowState?.currentTask ?? null,
        currentNodeId: options?.nodeId ?? workflowState?.nodeId ?? null,
        plan: workflowState?.plan ?? [],
        totalTokens: workflowState?.totalTokens,
        timing: workflowState?.timing,
        estimatedPlanCost: workflowState?.estimatedPlanCost,
        actualPlanCost: workflowState?.actualPlanCost,
        performanceMetrics: workflowState?.performanceMetrics,
        systemMode: options?.systemMode ?? workflowState?.config?.systemMode ?? null,
        agentProfileId:
            options?.agentProfileId ?? workflowState?.config?.agentProfileId ?? null,
    });
};

const getCapabilitiesForTask = (
    options?: AgentStartOptions,
    workflowState?: AutomationWorkflowState
): SessionCapability[] => {
    const capabilities = new Set<SessionCapability>([
        'council',
        'tools',
        'task_planning',
        'task_execution',
        'checkpoints',
        'recovery',
    ]);

    if (options?.workspaceId || workflowState?.config?.workspaceId) {
        capabilities.add('workspace_context');
    }

    return Array.from(capabilities);
};

const getLastMessagePreview = (state: SessionState): string | undefined => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) {
        return undefined;
    }

    const preview = lastMessage.content.trim().replace(/\s+/g, ' ');
    return preview ? preview.slice(0, 280) : undefined;
};

const toInitialMessages = (
    taskId: string,
    options?: AgentStartOptions
): SessionMessageEnvelope[] => {
    if (!options?.task) {
        return [];
    }

    return [
        {
            id: `${taskId}:user`,
            role: 'user',
            content: options.task,
            createdAt: Date.now(),
            metadata: {
                source: 'automation-task',
            },
        },
    ];
};

export class AutomationSessionRegistryService
extends BaseService
implements SessionRegistryReader {
    private readonly sessions = new Map<string, AutomationSessionEngine>();
    private workspaceUpdateSubscriptionId: string | null = null;

    constructor(
        private readonly eventBus: EventBusService,
        private readonly sessionModuleRegistryService?: SessionModuleRegistryService
    ) {
        super('AutomationSessionRegistryService');
    }

    override async initialize(): Promise<void> {
        if (this.workspaceUpdateSubscriptionId) {
            return;
        }

        this.workspaceUpdateSubscriptionId = this.eventBus.onCustom(
            SESSION_RUNTIME_EVENTS.AUTOMATION_STATE_SYNC,
            payload => {
                const parsed = AutomationWorkflowStateSchema.safeParse(payload);
                if (!parsed.success || !parsed.data.taskId) {
                    return;
                }

                void this.syncWorkflowState(parsed.data.taskId, parsed.data);
            },
            { priority: 10 }
        );
    }

    override async cleanup(): Promise<void> {
        if (this.workspaceUpdateSubscriptionId) {
            this.eventBus.unsubscribe(this.workspaceUpdateSubscriptionId);
            this.workspaceUpdateSubscriptionId = null;
        }

        for (const session of this.sessions.values()) {
            await session.disposeSession();
        }
        this.sessions.clear();
    }

    async startSession(options: SessionStartOptions): Promise<AutomationSessionEngine> {
        const existing = this.sessions.get(options.sessionId);
        if (existing) {
            return existing;
        }

        const session = new AutomationSessionEngine(
            this.eventBus,
            this.sessionModuleRegistryService?.getModules() ?? []
        );
        await session.start(options);
        this.sessions.set(options.sessionId, session);
        return session;
    }

    async startTaskSession(
        taskId: string,
        options: AgentStartOptions,
        phase: AutomationPhase = 'running'
    ): Promise<AutomationSessionEngine> {
        const session = await this.ensureSessionForTask(taskId, {
            options,
            sourceSurface: 'automation-workflow',
        });

        if (phase === 'planning') {
            await session.markPlanning();
            return session;
        }

        await session.markRunning();
        return session;
    }

    async ensureSessionForTask(
        taskId: string,
        input: {
            options?: AgentStartOptions;
            workflowState?: AutomationWorkflowState;
            sourceSurface?: string;
        }
    ): Promise<AutomationSessionEngine> {
        const existing = this.sessions.get(taskId);
        if (existing) {
            return existing;
        }

        const model = input.options?.model
            ?? input.workflowState?.config?.model
            ?? DEFAULT_MODEL_SELECTION;

        return this.startSession({
            sessionId: taskId,
            mode: 'automation',
            capabilities: getCapabilitiesForTask(input.options, input.workflowState),
            model,
            metadata: {
                title: input.options?.task ?? input.workflowState?.currentTask,
                workspaceId:
                    input.options?.workspaceId ?? input.workflowState?.config?.workspaceId,
                taskId,
                sourceSurface: input.sourceSurface ?? 'automation-workflow',
                extras: buildInitialAutomationExtras(input.options, input.workflowState),
            },
            initialMessages: toInitialMessages(taskId, input.options),
        });
    }

    async syncWorkflowState(
        taskId: string,
        workflowState: AutomationWorkflowState
    ): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {
            workflowState,
            sourceSurface: 'automation-workflow',
        });
        await session.syncWorkflowState(workflowState);
    }

    getSession(sessionId: string): AutomationSessionEngine | null {
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
                recoveryHint: state.lastError,
                recovery: state.recovery,
                lastMessagePreview: getLastMessagePreview(state),
            };
        });
    }

    async markPaused(taskId: string): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {});
        await session.markPaused();
    }

    async markRunning(taskId: string): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {});
        await session.markRunning();
    }

    async markPlanning(taskId: string): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {});
        await session.markPlanning();
    }

    async markWaitingForApproval(taskId: string): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {});
        await session.markWaitingForApproval();
    }

    async markInterrupted(taskId: string, message?: string): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {});
        await session.markInterrupted(message);
    }

    async markFailed(taskId: string, message: string): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {});
        await session.markFailed(message);
    }

    async markCompleted(taskId: string): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {});
        await session.markCompleted();
    }

    async appendMessage(taskId: string, message: SessionMessageEnvelope): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {});
        await session.appendMessage(message);
    }

    async updateModel(taskId: string, provider: string, model: string): Promise<void> {
        const session = await this.ensureSessionForTask(taskId, {});
        await session.syncModel(provider, model);
    }

    removeSession(taskId: string): void {
        const session = this.sessions.get(taskId);
        if (session) {
            void session.disposeSession();
        }
        this.sessions.delete(taskId);
    }
}
