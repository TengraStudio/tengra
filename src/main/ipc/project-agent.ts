import { DatabaseService } from '@main/services/data/database.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    AgentCollaborationIntent,
    AgentCollaborationPriority,
    AgentProfile,
    AgentStartOptions,
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
    DebateCitation,
    DebateReplay,
    DebateSession,
    DebateSide,
    ModelRoutingRule,
    ProjectState,
    ProjectStep,
    VotingConfiguration,
    VotingSession,
} from '@shared/types/project-agent';
import { BrowserWindow, ipcMain } from 'electron';

interface CanvasNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
}

interface CanvasEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

function validateString(value: unknown, name: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${name} must be a non-empty string`);
    }
    return value;
}

function validateNumber(value: unknown, name: string): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`${name} must be a valid number`);
    }
    return value;
}

const AGENT_COLLABORATION_INTENTS: readonly AgentCollaborationIntent[] = [
    'REQUEST_HELP',
    'SHARE_CONTEXT',
    'PROPOSE_CHANGE',
    'BLOCKER_REPORT'
];

const AGENT_COLLABORATION_PRIORITIES: readonly AgentCollaborationPriority[] = [
    'low',
    'normal',
    'high',
    'urgent'
];

const PROJECT_UPDATE_THROTTLE_MS = 50;
const STREAM_EVENT_VERSION = 'v1' as const;
let councilEventSequence = 0;

const createEventDedupeKey = (prefix: string, taskId: string, sequence: number): string => {
    return `${STREAM_EVENT_VERSION}:${prefix}:${taskId}:${Date.now()}:${sequence}`;
};

function normalizeStartOptions(value: unknown): AgentStartOptions {
    const payload = asRecord(value);
    const task = payload.task;
    if (typeof task !== 'string' || task.trim().length === 0) {
        throw new Error('task must be a non-empty string');
    }
    if (task.length > 4000) {
        throw new Error('task exceeds maximum length');
    }

    const normalized: AgentStartOptions = {
        task: task.trim(),
        nodeId: typeof payload.nodeId === 'string' ? payload.nodeId : undefined,
        priority:
            payload.priority === 'low'
                || payload.priority === 'normal'
                || payload.priority === 'high'
                || payload.priority === 'critical'
                ? payload.priority
                : undefined,
        model: (() => {
            const model = asRecord(payload.model);
            return (typeof model.provider === 'string' && typeof model.model === 'string')
                ? { provider: model.provider, model: model.model }
                : undefined;
        })(),
        projectId: typeof payload.projectId === 'string' ? payload.projectId : undefined,
        agentProfileId: typeof payload.agentProfileId === 'string' ? payload.agentProfileId : undefined,
        attachments: Array.isArray(payload.attachments)
            ? payload.attachments
                .map(item => asRecord(item))
                .filter(item => typeof item.name === 'string' && typeof item.path === 'string' && typeof item.size === 'number')
                .map(item => ({ name: item.name as string, path: item.path as string, size: item.size as number }))
            : undefined,
        systemMode:
            payload.systemMode === 'fast'
                || payload.systemMode === 'thinking'
                || payload.systemMode === 'architect'
                ? payload.systemMode
                : undefined,
        budgetLimitUsd: typeof payload.budgetLimitUsd === 'number' ? payload.budgetLimitUsd : undefined,
        locale: typeof payload.locale === 'string' ? payload.locale : undefined
    };
    return normalized;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null) {
        return value as Record<string, unknown>;
    }
    return {};
}

/**
 * Registers all project agent IPC handlers including core operations,
 * human-in-the-loop workflows, voting sessions, legacy compatibility,
 * and canvas persistence.
 * @param projectAgentService - The project agent service instance
 * @param getMainWindow - Factory function to retrieve the main BrowserWindow
 * @param databaseService - Optional database service for canvas persistence
 */
export function registerProjectAgentIpc(
    projectAgentService: ProjectAgentService,
    getMainWindow: () => BrowserWindow | null,
    databaseService?: DatabaseService
) {
    // Forward project updates to renderer
    const eventBus = projectAgentService.eventBus;
    let lastStatus: ProjectState['status'] = 'idle';
    let updateSequence = 0;
    let queuedState: ProjectState | null = null;
    let updateTimer: ReturnType<typeof setTimeout> | null = null;

    const emitAgentEvent = (
        windowInstance: BrowserWindow,
        type: string,
        data: Record<string, string | number | boolean | undefined>
    ): void => {
        const currentTaskId = projectAgentService.getCurrentTaskId() ?? '';
        updateSequence += 1;
        windowInstance.webContents.send('agent-event', {
            v: STREAM_EVENT_VERSION,
            dedupeKey: createEventDedupeKey(type, currentTaskId, updateSequence),
            emittedAt: Date.now(),
            type,
            data,
        });
    };

    const flushProjectUpdate = (): void => {
        updateTimer = null;
        const state = queuedState;
        queuedState = null;
        if (!state) {
            return;
        }

        const win = getMainWindow();
        if (!win || win.isDestroyed()) {
            return;
        }

        win.webContents.send('project:update', state);
        const currentTaskId = projectAgentService.getCurrentTaskId() ?? '';
        if (currentTaskId && state.status === 'running' && lastStatus !== 'running') {
            emitAgentEvent(win, 'agent:task_started', {
                taskId: currentTaskId,
                description: state.currentTask,
            });
        }

        emitAgentEvent(win, 'agent:state_changed', {
            taskId: currentTaskId,
            state: state.status,
        });
        lastStatus = state.status;
    };

    const scheduleProjectUpdateFlush = (): void => {
        if (updateTimer) {
            return;
        }
        updateTimer = setTimeout(flushProjectUpdate, PROJECT_UPDATE_THROTTLE_MS);
    };

    eventBus.on('project:update', (state: ProjectState) => {
        queuedState = state;
        scheduleProjectUpdateFlush();
    });
    ipcMain.handle('project:start', createSafeIpcHandler('project:start', async (_, options: AgentStartOptions) => {
        const normalizedOptions = normalizeStartOptions(options);
        const taskId = await projectAgentService.start(normalizedOptions);
        return { taskId };
    }, { taskId: '' }));

    ipcMain.handle('project:stop', createSafeIpcHandler('project:stop', async (_, payload?: { taskId?: string }) => {
        await projectAgentService.stop(payload?.taskId);
    }, undefined));

    ipcMain.handle('project:pause-task', createSafeIpcHandler('project:pause-task', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        await projectAgentService.pauseTask(payload.taskId);
        return { success: true };
    }, { success: false }));

    ipcMain.handle('project:resume-task', createSafeIpcHandler('project:resume-task', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        const success = await projectAgentService.resumeTask(payload.taskId);
        return {
            success,
            error: success ? undefined : 'Failed to resume task'
        };
    }, { success: false, error: 'Failed to resume task' }));

    ipcMain.handle('project:save-snapshot', createSafeIpcHandler('project:save-snapshot', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        const checkpointId = await projectAgentService.saveSnapshot(payload.taskId);
        return {
            success: Boolean(checkpointId),
            checkpointId
        };
    }, { success: false, checkpointId: '' }));

    ipcMain.handle('project:reset-state', createSafeIpcHandler('project:reset-state', async () => {
        await projectAgentService.resetState();
    }, undefined));

    ipcMain.handle('project:plan', createSafeIpcHandler('project:plan', async (_, options: AgentStartOptions) => {
        const normalizedOptions = normalizeStartOptions(options);
        await projectAgentService.generatePlan(normalizedOptions);
    }, undefined));

    ipcMain.handle(
        'project:approve',
        createSafeIpcHandler('project:approve', async (
            _,
            payload: (ProjectStep[] | string[]) | { plan: ProjectStep[] | string[]; taskId?: string }
        ) => {
            if (Array.isArray(payload)) {
                await projectAgentService.approvePlan(payload);
                return;
            }
            await projectAgentService.approvePlan(payload.plan, payload.taskId);
        }, undefined)
    );

    ipcMain.handle('project:approve-current-plan', createSafeIpcHandler('project:approve-current-plan', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        const success = await projectAgentService.approveCurrentPlan(payload.taskId);
        return {
            success,
            error: success ? undefined : 'Failed to approve plan'
        };
    }, { success: false, error: 'Failed to approve plan' }));

    ipcMain.handle('project:reject-current-plan', createSafeIpcHandler('project:reject-current-plan', async (_, payload: { taskId: string; reason?: string }) => {
        validateString(payload.taskId, 'taskId');
        const success = await projectAgentService.rejectCurrentPlan(payload.taskId, payload.reason);
        return {
            success,
            error: success ? undefined : 'Failed to reject plan'
        };
    }, { success: false, error: 'Failed to reject plan' }));

    ipcMain.handle('project:get-status', createSafeIpcHandler('project:get-status', async (_, payload?: { taskId?: string }) => {
        return await projectAgentService.getStatus(payload?.taskId);
    }, null));

    ipcMain.handle('project:get-messages', createSafeIpcHandler('project:get-messages', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        return await projectAgentService.getTaskMessages(payload.taskId);
    }, { success: false, messages: [] }));

    ipcMain.handle('project:get-events', createSafeIpcHandler('project:get-events', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        return await projectAgentService.getTaskEvents(payload.taskId);
    }, { success: false, events: [] }));

    // ===== MARCH1-IPC-001: Council Protocol =====
    ipcMain.handle('project:council-generate-plan', createSafeIpcHandler('project:council-generate-plan', async (_, payload: { taskId: string; task: string }) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.task, 'task');
        await projectAgentService.generatePlan({
            task: payload.task,
            projectId: payload.taskId, // Re-mapped if needed
            agentProfileId: 'council-president'
        });
        return { success: true };
    }, { success: false }));

    ipcMain.handle('project:council-get-proposal', createSafeIpcHandler('project:council-get-proposal', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        const status = await projectAgentService.getStatus(payload.taskId);
        return {
            success: true,
            plan: status.plan || []
        };
    }, { success: false, plan: [] }));

    ipcMain.handle('project:council-approve-proposal', createSafeIpcHandler('project:council-approve-proposal', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        const success = await projectAgentService.approveCurrentPlan(payload.taskId);
        return { success, error: success ? undefined : 'Failed to approve current plan' };
    }, { success: false, error: 'Failed' }));

    ipcMain.handle('project:council-reject-proposal', createSafeIpcHandler('project:council-reject-proposal', async (_, payload: { taskId: string; reason?: string }) => {
        validateString(payload.taskId, 'taskId');
        const success = await projectAgentService.rejectCurrentPlan(payload.taskId, payload.reason);
        return { success, error: success ? undefined : 'Failed to reject current plan' };
    }, { success: false, error: 'Failed' }));

    ipcMain.handle('project:council-start-execution', createSafeIpcHandler('project:council-start-execution', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        // If not already explicitly started by approve? Usually approve starts it, but if manual:
        const success = await projectAgentService.resumeTask(payload.taskId);
        return { success, error: success ? undefined : 'Failed to start execution' };
    }, { success: false, error: 'Failed' }));

    ipcMain.handle('project:council-pause-execution', createSafeIpcHandler('project:council-pause-execution', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        await projectAgentService.pauseTask(payload.taskId);
        return { success: true };
    }, { success: false }));

    ipcMain.handle('project:council-resume-execution', createSafeIpcHandler('project:council-resume-execution', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        const success = await projectAgentService.resumeTask(payload.taskId);
        return { success, error: success ? undefined : 'Failed to resume execution' };
    }, { success: false, error: 'Failed' }));

    ipcMain.handle('project:council-get-timeline', createSafeIpcHandler('project:council-get-timeline', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        const events = await projectAgentService.getTaskEvents(payload.taskId);
        return { success: true, events: events.events || [] };
    }, { success: false, events: [] }));
    // ============================================

    ipcMain.handle('project:get-telemetry', createSafeIpcHandler('project:get-telemetry', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        return await projectAgentService.getTaskTelemetry(payload.taskId);
    }, { success: false, telemetry: [] }));

    ipcMain.handle('project:get-task-history', createSafeIpcHandler('project:get-task-history', async (_, payload: { projectId?: string }) => {
        return await projectAgentService.getTaskHistory(payload.projectId ?? '');
    }, []));

    ipcMain.handle('project:delete-task', createSafeIpcHandler('project:delete-task', async (_, payload: { taskId: string }) => {
        validateString(payload.taskId, 'taskId');
        const success = await projectAgentService.deleteTask(payload.taskId);
        return {
            success,
            error: success ? undefined : 'Failed to delete task'
        };
    }, { success: false, error: 'Failed to delete task' }));

    ipcMain.handle('project:get-available-models', createSafeIpcHandler('project:get-available-models', async () => {
        const models = await projectAgentService.getAvailableModels();
        return {
            success: true,
            models
        };
    }, { success: false, models: [] }));

    ipcMain.handle('project:retry-step', createSafeIpcHandler('project:retry-step', async (_, payload: number | { index: number; taskId?: string }) => {
        if (typeof payload === 'number') {
            await projectAgentService.retryStep(payload);
            return;
        }
        await projectAgentService.retryStep(payload.index, payload.taskId);
    }, undefined));

    ipcMain.handle('project:select-model', createSafeIpcHandler('project:select-model', async (_, payload: { taskId: string; provider: string; model: string }) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.provider, 'provider');
        validateString(payload.model, 'model');
        const success = await projectAgentService.selectModel(
            payload.taskId,
            payload.provider,
            payload.model
        );
        return {
            success,
            error: success ? undefined : 'Failed to select model'
        };
    }, { success: false, error: 'Failed to select model' }));

    // --- AGT-HIL: Human-in-the-Loop IPC handlers ---

    ipcMain.handle('project:approve-step', createSafeIpcHandler('project:approve-step', async (_, payload: { taskId: string; stepId: string }) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.stepId, 'stepId');
        await projectAgentService.approveStep(payload.taskId, payload.stepId);
    }, undefined));

    ipcMain.handle('project:skip-step', createSafeIpcHandler('project:skip-step', async (_, payload: { taskId: string; stepId: string }) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.stepId, 'stepId');
        await projectAgentService.skipStep(payload.taskId, payload.stepId);
    }, undefined));

    ipcMain.handle('project:edit-step', createSafeIpcHandler('project:edit-step', async (_, payload: { taskId: string; stepId: string; text: string }) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.stepId, 'stepId');
        validateString(payload.text, 'text');
        await projectAgentService.editStep(payload.taskId, payload.stepId, payload.text);
    }, undefined));

    ipcMain.handle('project:add-step-comment', createSafeIpcHandler('project:add-step-comment', async (_, payload: { taskId: string; stepId: string; comment: string }) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.stepId, 'stepId');
        validateString(payload.comment, 'comment');
        await projectAgentService.addStepComment(payload.taskId, payload.stepId, payload.comment);
    }, undefined));

    ipcMain.handle('project:insert-intervention', createSafeIpcHandler('project:insert-intervention', async (_, payload: { taskId: string; afterStepId: string }) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.afterStepId, 'afterStepId');
        await projectAgentService.insertInterventionPoint(payload.taskId, payload.afterStepId);
    }, undefined));

    ipcMain.handle('project:resume-checkpoint', createSafeIpcHandler('project:resume-checkpoint', async (_, checkpointId: string) => {
        validateString(checkpointId, 'checkpointId');
        await projectAgentService.resumeFromCheckpoint(checkpointId);
    }, undefined));

    ipcMain.handle('project:get-task-history', createSafeIpcHandler('project:get-task-history', async (_, projectId: string) => {
        validateString(projectId, 'projectId');
        return await projectAgentService.getTaskHistory(projectId);
    }, []));

    ipcMain.handle('project:get-checkpoints', createSafeIpcHandler('project:get-checkpoints', async (_, taskId: string) => {
        validateString(taskId, 'taskId');
        return await projectAgentService.getCheckpoints(taskId);
    }, []));

    ipcMain.handle('project:rollback-checkpoint', createSafeIpcHandler('project:rollback-checkpoint', async (_, checkpointId: string) => {
        validateString(checkpointId, 'checkpointId');
        return await projectAgentService.rollbackCheckpoint(checkpointId);
    }, null));

    ipcMain.handle('project:get-plan-versions', createSafeIpcHandler('project:get-plan-versions', async (_, taskId: string) => {
        validateString(taskId, 'taskId');
        return await projectAgentService.getPlanVersions(taskId);
    }, []));

    ipcMain.handle('project:delete-task-by-node', createSafeIpcHandler('project:delete-task-by-node', async (_, nodeId: string) => {
        validateString(nodeId, 'nodeId');
        return await projectAgentService.deleteTaskByNodeId(nodeId);
    }, null));

    ipcMain.handle('project:create-pr', createSafeIpcHandler('project:create-pr', async (_, payload?: { taskId?: string }) => {
        return await projectAgentService.createPullRequest(payload?.taskId);
    }, null));

    ipcMain.handle('project:get-profiles', createSafeIpcHandler('project:get-profiles', async () => {
        return await projectAgentService.getProfiles();
    }, []));

    ipcMain.handle('project:register-profile', createSafeIpcHandler('project:register-profile', async (_, profile: AgentProfile) => {
        return await projectAgentService.registerProfile(profile);
    }, null));

    ipcMain.handle('project:delete-profile', createSafeIpcHandler('project:delete-profile', async (_, id: string) => {
        validateString(id, 'id');
        return await projectAgentService.deleteProfile(id);
    }, null));

    ipcMain.handle('project:get-routing-rules', createSafeIpcHandler('project:get-routing-rules', async () => {
        return projectAgentService.getRoutingRules();
    }, []));

    ipcMain.handle('project:set-routing-rules', createSafeIpcHandler('project:set-routing-rules', async (_, rules: ModelRoutingRule[]) => {
        projectAgentService.setRoutingRules(rules);
        return { success: true };
    }, { success: false }));

    ipcMain.handle(
        'project:create-voting-session',
        createSafeIpcHandler('project:create-voting-session', async (
            _,
            payload: { taskId: string; stepIndex: number; question: string; options: string[] }
        ): Promise<VotingSession> => {
            validateString(payload.taskId, 'taskId');
            validateNumber(payload.stepIndex, 'stepIndex');
            validateString(payload.question, 'question');
            return projectAgentService.createVotingSession(
                payload.taskId,
                payload.stepIndex,
                payload.question,
                payload.options
            );
        }, null as unknown as VotingSession)
    );

    ipcMain.handle(
        'project:submit-vote',
        createSafeIpcHandler('project:submit-vote', async (
            _,
            payload: {
                sessionId: string;
                modelId: string;
                provider: string;
                decision: string;
                confidence: number;
                reasoning?: string;
            }
        ) => {
            validateString(payload.sessionId, 'sessionId');
            validateString(payload.modelId, 'modelId');
            validateString(payload.provider, 'provider');
            validateString(payload.decision, 'decision');
            validateNumber(payload.confidence, 'confidence');
            return await projectAgentService.submitVote({
                sessionId: payload.sessionId,
                modelId: payload.modelId,
                provider: payload.provider,
                decision: payload.decision,
                confidence: payload.confidence,
                reasoning: payload.reasoning
            });
        }, null)
    );

    ipcMain.handle(
        'project:request-votes',
        createSafeIpcHandler('project:request-votes', async (_, payload: { sessionId: string; models: Array<{ provider: string; model: string }> }) => {
            validateString(payload.sessionId, 'sessionId');
            return await projectAgentService.requestVotes(payload.sessionId, payload.models);
        }, null)
    );

    ipcMain.handle('project:resolve-voting', createSafeIpcHandler('project:resolve-voting', async (_, sessionId: string) => {
        validateString(sessionId, 'sessionId');
        return projectAgentService.resolveVoting(sessionId);
    }, null));

    ipcMain.handle('project:get-voting-session', createSafeIpcHandler('project:get-voting-session', async (_, sessionId: string) => {
        validateString(sessionId, 'sessionId');
        return projectAgentService.getVotingSession(sessionId);
    }, null));

    ipcMain.handle('project:list-voting-sessions', createSafeIpcHandler('project:list-voting-sessions', async (_, taskId?: string) => {
        if (taskId !== undefined) {
            validateString(taskId, 'taskId');
        }
        return projectAgentService.getVotingSessions(taskId);
    }, []));

    ipcMain.handle('project:override-voting', createSafeIpcHandler('project:override-voting', async (
        _,
        payload: { sessionId: string; finalDecision: string; reason?: string }
    ) => {
        validateString(payload.sessionId, 'sessionId');
        validateString(payload.finalDecision, 'finalDecision');
        return projectAgentService.overrideVotingDecision(
            payload.sessionId,
            payload.finalDecision,
            payload.reason
        );
    }, null));

    ipcMain.handle('project:get-voting-analytics', createSafeIpcHandler('project:get-voting-analytics', async (_, taskId?: string) => {
        if (taskId !== undefined) {
            validateString(taskId, 'taskId');
        }
        return projectAgentService.getVotingAnalytics(taskId);
    }, {
        totalSessions: 0,
        pendingSessions: 0,
        resolvedSessions: 0,
        deadlockedSessions: 0,
        averageVotesPerSession: 0,
        averageConfidence: 0,
        disagreementIndex: 0,
        updatedAt: Date.now()
    }));

    ipcMain.handle('project:get-voting-config', createSafeIpcHandler('project:get-voting-config', async () => {
        return projectAgentService.getVotingConfiguration();
    }, {
        minimumVotes: 2,
        deadlockThreshold: 0.9,
        autoResolve: true,
        autoResolveTimeoutMs: 60_000
    }));

    ipcMain.handle('project:update-voting-config', createSafeIpcHandler('project:update-voting-config', async (
        _,
        patch: Partial<VotingConfiguration>
    ) => {
        if (patch.minimumVotes !== undefined) {
            validateNumber(patch.minimumVotes, 'minimumVotes');
        }
        if (patch.deadlockThreshold !== undefined) {
            validateNumber(patch.deadlockThreshold, 'deadlockThreshold');
        }
        if (patch.autoResolveTimeoutMs !== undefined) {
            validateNumber(patch.autoResolveTimeoutMs, 'autoResolveTimeoutMs');
        }
        return projectAgentService.updateVotingConfiguration(patch);
    }, {
        minimumVotes: 2,
        deadlockThreshold: 0.9,
        autoResolve: true,
        autoResolveTimeoutMs: 60_000
    }));

    ipcMain.handle('project:list-voting-templates', createSafeIpcHandler('project:list-voting-templates', async () => {
        return projectAgentService.getVotingTemplates();
    }, []));

    ipcMain.handle(
        'project:build-consensus',
        createSafeIpcHandler('project:build-consensus', async (_, outputs: Array<{ modelId: string; provider: string; output: string }>) => {
            return await projectAgentService.buildConsensus(outputs);
        }, null)
    );

    ipcMain.handle(
        'project:create-debate-session',
        createSafeIpcHandler('project:create-debate-session', async (
            _,
            payload: { taskId: string; stepIndex: number; topic: string }
        ): Promise<DebateSession | null> => {
            validateString(payload.taskId, 'taskId');
            validateNumber(payload.stepIndex, 'stepIndex');
            validateString(payload.topic, 'topic');
            return projectAgentService.createDebateSession(payload.taskId, payload.stepIndex, payload.topic);
        }, null)
    );

    ipcMain.handle(
        'project:submit-debate-argument',
        createSafeIpcHandler('project:submit-debate-argument', async (
            _,
            payload: {
                sessionId: string;
                agentId: string;
                provider: string;
                side: DebateSide;
                content: string;
                confidence: number;
                citations?: DebateCitation[];
            }
        ): Promise<DebateSession | null> => {
            validateString(payload.sessionId, 'sessionId');
            validateString(payload.agentId, 'agentId');
            validateString(payload.provider, 'provider');
            validateString(payload.content, 'content');
            validateNumber(payload.confidence, 'confidence');
            return projectAgentService.submitDebateArgument(payload);
        }, null)
    );

    ipcMain.handle('project:resolve-debate-session', createSafeIpcHandler('project:resolve-debate-session', async (_, sessionId: string) => {
        validateString(sessionId, 'sessionId');
        return projectAgentService.resolveDebateSession(sessionId);
    }, null));

    ipcMain.handle('project:override-debate-session', createSafeIpcHandler('project:override-debate-session', async (
        _,
        payload: { sessionId: string; moderatorId: string; decision: DebateSide | 'balanced'; reason?: string }
    ) => {
        validateString(payload.sessionId, 'sessionId');
        validateString(payload.moderatorId, 'moderatorId');
        return projectAgentService.overrideDebateSession(
            payload.sessionId,
            payload.moderatorId,
            payload.decision,
            payload.reason
        );
    }, null));

    ipcMain.handle('project:get-debate-session', createSafeIpcHandler('project:get-debate-session', async (_, sessionId: string) => {
        validateString(sessionId, 'sessionId');
        return projectAgentService.getDebateSession(sessionId);
    }, null));

    ipcMain.handle('project:list-debate-history', createSafeIpcHandler('project:list-debate-history', async (_, taskId?: string) => {
        if (taskId !== undefined) {
            validateString(taskId, 'taskId');
        }
        return projectAgentService.getDebateHistory(taskId);
    }, []));

    ipcMain.handle('project:get-debate-replay', createSafeIpcHandler('project:get-debate-replay', async (_, sessionId: string): Promise<DebateReplay | null> => {
        validateString(sessionId, 'sessionId');
        return projectAgentService.getDebateReplay(sessionId);
    }, null));

    ipcMain.handle('project:generate-debate-summary', createSafeIpcHandler('project:generate-debate-summary', async (_, sessionId: string) => {
        validateString(sessionId, 'sessionId');
        return projectAgentService.generateDebateSummary(sessionId);
    }, null));

    ipcMain.handle('project:get-teamwork-analytics', createSafeIpcHandler('project:get-teamwork-analytics', async () => {
        return projectAgentService.getTeamworkAnalytics();
    }, null));

    registerCouncilMessagingHandlers(projectAgentService);

    // AGENT-08: Performance Metrics
    ipcMain.handle('project:get-performance-metrics', createSafeIpcHandler('project:get-performance-metrics', async (_, taskId: string) => {
        validateString(taskId, 'taskId');
        const metrics = projectAgentService.getPerformanceService().getMetrics(taskId);
        return metrics ?? null;
    }, null));

    ipcMain.handle('project:health', createSafeIpcHandler('project:health', async () => {
        return {
            success: true,
            data: {
                status: 'healthy'
            }
        };
    }, { success: true, data: { status: 'healthy' } }));

    registerCanvasPersistenceHandlers(databaseService, projectAgentService);
}

function registerCouncilMessagingHandlers(projectAgentService: ProjectAgentService): void {
    ipcMain.handle('project:council-send-message', createSafeIpcHandler('project:council-send-message', async (
        _,
        payload: {
            taskId: string;
            stageId: string;
            fromAgentId: string;
            toAgentId?: string;
            intent: AgentCollaborationIntent;
            priority?: AgentCollaborationPriority;
            payload: Record<string, string | number | boolean | null>;
            expiresAt?: number;
        }
    ) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.stageId, 'stageId');
        validateString(payload.fromAgentId, 'fromAgentId');
        if (
            payload.toAgentId !== undefined
            && (typeof payload.toAgentId !== 'string' || payload.toAgentId.trim().length === 0)
        ) {
            throw new Error('toAgentId must be a non-empty string when provided');
        }
        if (!AGENT_COLLABORATION_INTENTS.includes(payload.intent)) {
            throw new Error(`Unsupported intent: ${payload.intent}`);
        }
        if (
            payload.priority !== undefined
            && !AGENT_COLLABORATION_PRIORITIES.includes(payload.priority)
        ) {
            throw new Error(`Unsupported priority: ${payload.priority}`);
        }
        if (payload.expiresAt !== undefined) {
            validateNumber(payload.expiresAt, 'expiresAt');
        }
        return await projectAgentService.sendCollaborationMessage(payload);
    }, null));

    ipcMain.handle('project:council-get-messages', createSafeIpcHandler('project:council-get-messages', async (
        _,
        payload: {
            taskId: string;
            stageId?: string;
            agentId?: string;
            includeExpired?: boolean;
        }
    ) => {
        validateString(payload.taskId, 'taskId');
        if (payload.stageId !== undefined) {
            validateString(payload.stageId, 'stageId');
        }
        if (payload.agentId !== undefined) {
            validateString(payload.agentId, 'agentId');
        }
        return await projectAgentService.getCollaborationMessages(payload);
    }, []));

    ipcMain.handle('project:council-cleanup-expired-messages', createSafeIpcHandler('project:council-cleanup-expired-messages', async (
        _,
        payload?: { taskId?: string }
    ) => {
        if (payload?.taskId !== undefined) {
            validateString(payload.taskId, 'taskId');
        }
        const removed = await projectAgentService.cleanupExpiredCollaborationMessages(payload?.taskId);
        return { success: true, removed };
    }, { success: true, removed: 0 }));

    ipcMain.handle('project:council-handle-quota-interrupt', createSafeIpcHandler('project:council-handle-quota-interrupt', async (
        _,
        payload: {
            taskId: string;
            stageId?: string;
            provider: string;
            model: string;
            reason?: string;
            autoSwitch?: boolean;
        }
    ) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.provider, 'provider');
        validateString(payload.model, 'model');
        if (payload.stageId !== undefined) {
            validateString(payload.stageId, 'stageId');
        }
        const result = await projectAgentService.handleQuotaExhaustedInterrupt(payload);
        councilEventSequence += 1;
        const eventPayload = {
            ...result,
            v: STREAM_EVENT_VERSION,
            dedupeKey: createEventDedupeKey('quota_interrupt', payload.taskId, councilEventSequence),
            emittedAt: Date.now(),
        };
        const windows = BrowserWindow.getAllWindows();
        for (const windowInstance of windows) {
            windowInstance.webContents.send('project:quota-interrupt', eventPayload);
        }
        return result;
    }, null));

    ipcMain.handle('project:council-register-worker-availability', createSafeIpcHandler('project:council-register-worker-availability', async (
        _,
        payload: {
            taskId: string;
            agentId: string;
            status: 'available' | 'busy' | 'offline';
            reason?: string;
            skills?: string[];
            contextReadiness?: number;
        }
    ) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.agentId, 'agentId');
        if (!['available', 'busy', 'offline'].includes(payload.status)) {
            throw new Error('status must be one of available | busy | offline');
        }
        if (payload.skills && !Array.isArray(payload.skills)) {
            throw new Error('skills must be an array');
        }
        if (payload.contextReadiness !== undefined) {
            validateNumber(payload.contextReadiness, 'contextReadiness');
        }
        return projectAgentService.registerWorkerAvailability(payload);
    }, null));

    ipcMain.handle('project:council-list-available-workers', createSafeIpcHandler('project:council-list-available-workers', async (
        _,
        payload: { taskId: string }
    ) => {
        validateString(payload.taskId, 'taskId');
        return projectAgentService.listAvailableWorkers(payload.taskId);
    }, []));

    ipcMain.handle('project:council-score-helper-candidates', createSafeIpcHandler('project:council-score-helper-candidates', async (
        _,
        payload: {
            taskId: string;
            stageId: string;
            requiredSkills: string[];
            blockedAgentIds?: string[];
            contextReadinessOverrides?: Record<string, number>;
        }
    ) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.stageId, 'stageId');
        if (!Array.isArray(payload.requiredSkills)) {
            throw new Error('requiredSkills must be an array');
        }
        return projectAgentService.scoreHelperCandidates(payload);
    }, []));

    ipcMain.handle('project:council-generate-helper-handoff', createSafeIpcHandler('project:council-generate-helper-handoff', async (
        _,
        payload: {
            taskId: string;
            stageId: string;
            ownerAgentId: string;
            helperAgentId: string;
            stageGoal: string;
            acceptanceCriteria: string[];
            constraints: string[];
            contextNotes?: string;
        }
    ) => {
        validateString(payload.taskId, 'taskId');
        validateString(payload.stageId, 'stageId');
        validateString(payload.ownerAgentId, 'ownerAgentId');
        validateString(payload.helperAgentId, 'helperAgentId');
        validateString(payload.stageGoal, 'stageGoal');
        if (!Array.isArray(payload.acceptanceCriteria)) {
            throw new Error('acceptanceCriteria must be an array');
        }
        if (!Array.isArray(payload.constraints)) {
            throw new Error('constraints must be an array');
        }
        return projectAgentService.generateHelperHandoffPackage(payload);
    }, null));

    ipcMain.handle('project:council-review-helper-merge', createSafeIpcHandler('project:council-review-helper-merge', async (
        _,
        payload: {
            acceptanceCriteria: string[];
            constraints: string[];
            helperOutput: string;
            reviewerNotes?: string;
        }
    ) => {
        if (!Array.isArray(payload.acceptanceCriteria)) {
            throw new Error('acceptanceCriteria must be an array');
        }
        if (!Array.isArray(payload.constraints)) {
            throw new Error('constraints must be an array');
        }
        validateString(payload.helperOutput, 'helperOutput');
        return projectAgentService.reviewHelperMergeGate(payload);
    }, { accepted: false, verdict: 'REJECT', reasons: ['Invalid payload'], requiredFixes: [], reviewedAt: Date.now() }));
}

/**
 * Registers canvas persistence handlers for saving/loading nodes and edges,
 * and agent template CRUD operations.
 * @param databaseService - Optional database service for canvas data
 * @param projectAgentService - Optional project agent service for templates
 */
function registerCanvasPersistenceHandlers(
    databaseService?: DatabaseService,
    projectAgentService?: ProjectAgentService
): void {
    ipcMain.handle('project:save-canvas-nodes', createSafeIpcHandler('project:save-canvas-nodes', async (_, nodes: CanvasNode[]) => {
        if (!databaseService) {
            return;
        }
        await databaseService.uac.saveCanvasNodes(nodes);
    }, undefined));

    ipcMain.handle('project:get-canvas-nodes', createSafeIpcHandler('project:get-canvas-nodes', async () => {
        if (!databaseService) {
            return [];
        }
        const records = await databaseService.uac.getCanvasNodes();
        return records.map(r => ({
            id: r.id,
            type: r.type,
            position: { x: r.position_x, y: r.position_y },
            data: JSON.parse(r.data),
        }));
    }, []));

    ipcMain.handle('project:delete-canvas-node', createSafeIpcHandler('project:delete-canvas-node', async (_, id: string) => {
        validateString(id, 'id');
        if (!databaseService) {
            return;
        }
        await databaseService.uac.deleteCanvasNode(id);
    }, undefined));

    ipcMain.handle('project:save-canvas-edges', createSafeIpcHandler('project:save-canvas-edges', async (_, edges: CanvasEdge[]) => {
        if (!databaseService) {
            return;
        }
        await databaseService.uac.saveCanvasEdges(edges);
    }, undefined));

    ipcMain.handle('project:get-canvas-edges', createSafeIpcHandler('project:get-canvas-edges', async () => {
        if (!databaseService) {
            return [];
        }
        const records = await databaseService.uac.getCanvasEdges();
        return records.map(r => ({
            id: r.id,
            source: r.source,
            target: r.target,
            sourceHandle: r.source_handle ?? undefined,
            targetHandle: r.target_handle ?? undefined,
        }));
    }, []));

    ipcMain.handle('project:delete-canvas-edge', createSafeIpcHandler('project:delete-canvas-edge', async (_, id: string) => {
        validateString(id, 'id');
        if (!databaseService) {
            return;
        }
        await databaseService.uac.deleteCanvasEdge(id);
    }, undefined));

    // ===== AGT-TPL: Agent Template Handlers =====

    ipcMain.handle('project:get-templates', createSafeIpcHandler('project:get-templates', async (_, category?: AgentTemplateCategory) => {
        if (!projectAgentService) {
            return [];
        }
        if (category) {
            return projectAgentService.getTemplatesByCategory(category);
        }
        return projectAgentService.getTemplates();
    }, []));

    ipcMain.handle('project:save-template', createSafeIpcHandler('project:save-template', async (_, template: AgentTemplate) => {
        if (!projectAgentService) {
            return { success: false, error: 'Database not available' };
        }
        return await projectAgentService.saveTemplate(template);
    }, { success: false, error: 'Database not available' }));

    ipcMain.handle('project:delete-template', createSafeIpcHandler('project:delete-template', async (_, id: string) => {
        validateString(id, 'id');
        if (!projectAgentService) {
            return { success: false, error: 'Database not available' };
        }
        const success = await projectAgentService.deleteTemplate(id);
        return { success };
    }, { success: false }));

    ipcMain.handle('project:export-template', createSafeIpcHandler('project:export-template', async (_, id: string) => {
        validateString(id, 'id');
        if (!projectAgentService) {
            return null;
        }
        return projectAgentService.exportTemplate(id);
    }, null));

    ipcMain.handle('project:import-template', createSafeIpcHandler('project:import-template', async (_, exported: AgentTemplateExport) => {
        if (!projectAgentService) {
            return { success: false, error: 'Database not available' };
        }
        try {
            const template = await projectAgentService.importTemplate(exported);
            return { success: true, template };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    }, { success: false, error: 'Database not available' }));

    ipcMain.handle(
        'project:apply-template',
        createSafeIpcHandler('project:apply-template', async (
            _,
            payload: { templateId: string; values: Record<string, string | number | boolean> }
        ) => {
            validateString(payload.templateId, 'templateId');
            if (!projectAgentService) {
                return { success: false, error: 'Project agent service not available' };
            }
            try {
                const result = projectAgentService.applyTemplate(payload.templateId, payload.values);
                return { success: true, ...result };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { success: false, error: message };
            }
        }, { success: false, error: 'Project agent service not available' })
    );

    ipcMain.handle('project:get-template', createSafeIpcHandler('project:get-template', async (_, id: string) => {
        validateString(id, 'id');
        if (!projectAgentService) {
            return null;
        }
        return projectAgentService.getTemplates().find(template => template.id === id) ?? null;
    }, null));
}

