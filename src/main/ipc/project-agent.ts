import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { DatabaseService } from '@main/services/data/database.service';
import { UacCanvasEdgeRecord, UacCanvasNodeRecord } from '@main/services/data/repositories/uac.repository';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { createSafeIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    AgentCollaborationIntentSchema,
    AgentCollaborationPrioritySchema,
    AgentProfileSchema,
    AgentStartOptionsSchema,
    DebateCitationSchema,
    DebateSessionSchema,
    DebateSideSchema,
    ModelRoutingRuleSchema,
    ProjectStateSchema,
    ProjectStepSchema,
    VotingConfigurationSchema,
    VotingSessionSchema,
} from '@shared/schemas/project-agent-hardening.schema';
import type { AgentEventRecord, TaskMetrics } from '@shared/types/agent-state';
import type {
    AgentCollaborationIntent,
    AgentCollaborationPriority,
    AgentPerformanceMetrics,
    AgentProfile,
    AgentStartOptions,
    AgentTaskHistoryItem,
    AgentTeamworkAnalytics,
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
    ConsensusResult,
    DebateCitation,
    DebateReplay,
    DebateSession,
    DebateSide,
    HelperCandidateInput,
    HelperHandoffInput,
    HelperMergeGateDecision,
    HelperMergeGateInput,
    ModelRoutingRule,
    ProjectState,
    ProjectStep,
    QuotaInterruptInput,
    QuotaInterruptResult,
    VotingAnalytics,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
    WorkerAvailabilityInput,
    WorkerAvailabilityRecord,
} from '@shared/types/project-agent';
import type {
    AgentCheckpointItem,
    AgentCollaborationMessage,
    HelperCandidateScore,
    HelperHandoffPackage,
    PlanVersionItem,
    RollbackCheckpointResult,
} from '@shared/types/project-agent';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

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

interface AvailableModelInfo {
    id: string;
    name: string;
    provider: string;
}

const PROJECT_UPDATE_THROTTLE_MS = 50;
const STREAM_EVENT_VERSION = 'v1' as const;
let councilEventSequence = 0;

const createEventDedupeKey = (prefix: string, taskId: string, sequence: number): string => {
    return `${STREAM_EVENT_VERSION}:${prefix}:${taskId}:${Date.now()}:${sequence}`;
};

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
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'project agent operation');

    ipcMain.handle(
        'project:start',
        createValidatedIpcHandler<{ taskId: string }, [AgentStartOptions]>(
            'project:start',
            async (event, options: AgentStartOptions): Promise<{ taskId: string }> => {
                validateSender(event);
                const taskId = await projectAgentService.start(options);
                return { taskId };
            },
            {
                argsSchema: z.tuple([AgentStartOptionsSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:stop',
        createValidatedIpcHandler<void, [{ taskId?: string } | undefined]>(
            'project:stop',
            async (event, payload?: { taskId?: string }): Promise<void> => {
                validateSender(event);
                await projectAgentService.stop(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:pause-task',
        createValidatedIpcHandler<{ success: true }, [{ taskId: string }]>(
            'project:pause-task',
            async (event, payload: { taskId: string }): Promise<{ success: true }> => {
                validateSender(event);
                await projectAgentService.pauseTask(payload.taskId);
                return { success: true };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:resume-task',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string }]>(
            'project:resume-task',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                const success = await projectAgentService.resumeTask(payload.taskId);
                return {
                    success,
                    error: success ? undefined : 'Failed to resume task'
                };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:save-snapshot',
        createValidatedIpcHandler<{ success: boolean; checkpointId: string }, [{ taskId: string }]>(
            'project:save-snapshot',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; checkpointId: string }> => {
                validateSender(event);
                const checkpointId = await projectAgentService.saveSnapshot(payload.taskId);
                return {
                    success: Boolean(checkpointId),
                    checkpointId: checkpointId ?? ''
                };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:reset-state',
        createValidatedIpcHandler<void, []>(
            'project:reset-state',
            async (event): Promise<void> => {
                validateSender(event);
                await projectAgentService.resetState();
            },
            {
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:plan',
        createValidatedIpcHandler<void, [AgentStartOptions]>(
            'project:plan',
            async (event, options: AgentStartOptions): Promise<void> => {
                validateSender(event);
                await projectAgentService.generatePlan(options);
            },
            {
                argsSchema: z.tuple([AgentStartOptionsSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:approve',
        createValidatedIpcHandler<void, [ProjectStep[] | { plan: ProjectStep[]; taskId?: string }]>(
            'project:approve',
            async (
                event,
                payload: ProjectStep[] | { plan: ProjectStep[]; taskId?: string }
            ): Promise<void> => {
                validateSender(event);
                if (Array.isArray(payload)) {
                    await projectAgentService.approvePlan(payload);
                    return;
                }
                await projectAgentService.approvePlan(payload.plan, payload.taskId);
            },
            {
                argsSchema: z.tuple([z.union([z.array(ProjectStepSchema), z.object({ plan: z.array(ProjectStepSchema), taskId: z.string().optional() })])]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:approve-current-plan',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string }]>(
            'project:approve-current-plan',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                const success = await projectAgentService.approveCurrentPlan(payload.taskId);
                return {
                    success,
                    error: success ? undefined : 'Failed to approve plan'
                };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:reject-current-plan',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string; reason?: string }]>(
            'project:reject-current-plan',
            async (event, payload: { taskId: string; reason?: string }): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                const success = await projectAgentService.rejectCurrentPlan(payload.taskId, payload.reason);
                return {
                    success,
                    error: success ? undefined : 'Failed to reject plan'
                };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), reason: z.string().optional() })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-status',
        createValidatedIpcHandler<ProjectState | null, [{ taskId?: string } | undefined]>(
            'project:get-status',
            async (event, payload?: { taskId?: string }): Promise<ProjectState | null> => {
                validateSender(event);
                return await projectAgentService.getStatus(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                responseSchema: ProjectStateSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-messages',
        createValidatedIpcHandler<{ success: boolean; messages: unknown[] }, [{ taskId: string }]>(
            'project:get-messages',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; messages: unknown[] }> => {
                validateSender(event);
                return await projectAgentService.getTaskMessages(payload.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-events',
        createValidatedIpcHandler<{ success: boolean; events: AgentEventRecord[] }, [{ taskId: string }]>(
            'project:get-events',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; events: AgentEventRecord[] }> => {
                validateSender(event);
                return await projectAgentService.getTaskEvents(payload.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    // ===== MARCH1-IPC-001: Council Protocol =====
    ipcMain.handle(
        'project:council-generate-plan',
        createValidatedIpcHandler<{ success: true }, [{ taskId: string; task: string }]>(
            'project:council-generate-plan',
            async (event, payload: { taskId: string; task: string }): Promise<{ success: true }> => {
                validateSender(event);
                await projectAgentService.generatePlan({
                    task: payload.task,
                    projectId: payload.taskId,
                    agentProfileId: 'council-president'
                });
                return { success: true };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), task: z.string().min(1).max(4000) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-get-proposal',
        createValidatedIpcHandler<{ success: boolean; plan: ProjectStep[] }, [{ taskId: string }]>(
            'project:council-get-proposal',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; plan: ProjectStep[] }> => {
                validateSender(event);
                const status = await projectAgentService.getStatus(payload.taskId);
                return {
                    success: true,
                    plan: status.plan || []
                };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-approve-proposal',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string }]>(
            'project:council-approve-proposal',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                const success = await projectAgentService.approveCurrentPlan(payload.taskId);
                return { success, error: success ? undefined : 'Failed to approve current plan' };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-reject-proposal',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string; reason?: string }]>(
            'project:council-reject-proposal',
            async (event, payload: { taskId: string; reason?: string }): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                const success = await projectAgentService.rejectCurrentPlan(payload.taskId, payload.reason);
                return { success, error: success ? undefined : 'Failed to reject current plan' };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), reason: z.string().optional() })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-start-execution',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string }]>(
            'project:council-start-execution',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                const success = await projectAgentService.resumeTask(payload.taskId);
                return { success, error: success ? undefined : 'Failed to start execution' };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-pause-execution',
        createValidatedIpcHandler<{ success: true }, [{ taskId: string }]>(
            'project:council-pause-execution',
            async (event, payload: { taskId: string }): Promise<{ success: true }> => {
                validateSender(event);
                await projectAgentService.pauseTask(payload.taskId);
                return { success: true };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-resume-execution',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string }]>(
            'project:council-resume-execution',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                const success = await projectAgentService.resumeTask(payload.taskId);
                return { success, error: success ? undefined : 'Failed to resume execution' };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-get-timeline',
        createValidatedIpcHandler<{ success: boolean; events: AgentEventRecord[] }, [{ taskId: string }]>(
            'project:council-get-timeline',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; events: AgentEventRecord[] }> => {
                validateSender(event);
                const events = await projectAgentService.getTaskEvents(payload.taskId);
                return { success: true, events: events.events || [] };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );
    // ============================================

    ipcMain.handle(
        'project:get-telemetry',
        createValidatedIpcHandler<{ success: boolean; telemetry: TaskMetrics[] }, [{ taskId: string }]>(
            'project:get-telemetry',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; telemetry: TaskMetrics[] }> => {
                validateSender(event);
                return await projectAgentService.getTaskTelemetry(payload.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-task-history',
        createValidatedIpcHandler<AgentTaskHistoryItem[], [{ projectId?: string } | undefined]>(
            'project:get-task-history',
            async (event, payload?: { projectId?: string }): Promise<AgentTaskHistoryItem[]> => {
                validateSender(event);
                return await projectAgentService.getTaskHistory(payload?.projectId ?? '');
            },
            {
                argsSchema: z.tuple([z.object({ projectId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:delete-task',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string }]>(
            'project:delete-task',
            async (event, payload: { taskId: string }): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                const success = await projectAgentService.deleteTask(payload.taskId);
                return {
                    success,
                    error: success ? undefined : 'Failed to delete task'
                };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-available-models',
        createValidatedIpcHandler<{ success: boolean; models: AvailableModelInfo[] }, []>(
            'project:get-available-models',
            async (event): Promise<{ success: boolean; models: AvailableModelInfo[] }> => {
                validateSender(event);
                const models = await projectAgentService.getAvailableModels();
                return {
                    success: true,
                    models
                };
            },
            {
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:retry-step',
        createValidatedIpcHandler<void, [number | { index: number; taskId?: string }]>(
            'project:retry-step',
            async (event, payload: number | { index: number; taskId?: string }): Promise<void> => {
                validateSender(event);
                if (typeof payload === 'number') {
                    await projectAgentService.retryStep(payload);
                    return;
                }
                await projectAgentService.retryStep(payload.index, payload.taskId);
            },
            {
                argsSchema: z.tuple([z.union([z.number(), z.object({ index: z.number(), taskId: z.string().optional() })])]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:select-model',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string; provider: string; model: string }]>(
            'project:select-model',
            async (event, payload: { taskId: string; provider: string; model: string }): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                const success = await projectAgentService.selectModel(
                    payload.taskId,
                    payload.provider,
                    payload.model
                );
                return {
                    success,
                    error: success ? undefined : 'Failed to select model'
                };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), provider: z.string().min(1), model: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    // --- AGT-HIL: Human-in-the-Loop IPC handlers ---

    ipcMain.handle(
        'project:approve-step',
        createValidatedIpcHandler<void, [{ taskId: string; stepId: string }]>(
            'project:approve-step',
            async (event, payload: { taskId: string; stepId: string }): Promise<void> => {
                validateSender(event);
                await projectAgentService.approveStep(payload.taskId, payload.stepId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), stepId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:skip-step',
        createValidatedIpcHandler<void, [{ taskId: string; stepId: string }]>(
            'project:skip-step',
            async (event, payload: { taskId: string; stepId: string }): Promise<void> => {
                validateSender(event);
                await projectAgentService.skipStep(payload.taskId, payload.stepId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), stepId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:edit-step',
        createValidatedIpcHandler<void, [{ taskId: string; stepId: string; text: string }]>(
            'project:edit-step',
            async (event, payload: { taskId: string; stepId: string; text: string }): Promise<void> => {
                validateSender(event);
                await projectAgentService.editStep(payload.taskId, payload.stepId, payload.text);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), stepId: z.string().min(1), text: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:add-step-comment',
        createValidatedIpcHandler<void, [{ taskId: string; stepId: string; comment: string }]>(
            'project:add-step-comment',
            async (event, payload: { taskId: string; stepId: string; comment: string }): Promise<void> => {
                validateSender(event);
                await projectAgentService.addStepComment(payload.taskId, payload.stepId, payload.comment);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), stepId: z.string().min(1), comment: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:insert-intervention',
        createValidatedIpcHandler<void, [{ taskId: string; afterStepId: string }]>(
            'project:insert-intervention',
            async (event, payload: { taskId: string; afterStepId: string }): Promise<void> => {
                validateSender(event);
                await projectAgentService.insertInterventionPoint(payload.taskId, payload.afterStepId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), afterStepId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:resume-checkpoint',
        createValidatedIpcHandler<void, [string]>(
            'project:resume-checkpoint',
            async (event, checkpointId: string): Promise<void> => {
                validateSender(event);
                await projectAgentService.resumeFromCheckpoint(checkpointId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-checkpoints',
        createValidatedIpcHandler<AgentCheckpointItem[], [string]>(
            'project:get-checkpoints',
            async (event, taskId: string): Promise<AgentCheckpointItem[]> => {
                validateSender(event);
                return await projectAgentService.getCheckpoints(taskId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:rollback-checkpoint',
        createValidatedIpcHandler<RollbackCheckpointResult | null, [string]>(
            'project:rollback-checkpoint',
            async (event, checkpointId: string): Promise<RollbackCheckpointResult | null> => {
                validateSender(event);
                return await projectAgentService.rollbackCheckpoint(checkpointId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-plan-versions',
        createValidatedIpcHandler<PlanVersionItem[], [string]>(
            'project:get-plan-versions',
            async (event, taskId: string): Promise<PlanVersionItem[]> => {
                validateSender(event);
                return await projectAgentService.getPlanVersions(taskId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:delete-task-by-node',
        createValidatedIpcHandler<boolean, [string]>(
            'project:delete-task-by-node',
            async (event, nodeId: string): Promise<boolean> => {
                validateSender(event);
                return await projectAgentService.deleteTaskByNodeId(nodeId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:create-pr',
        createValidatedIpcHandler<{ success: boolean; url?: string; error?: string } | null, [{ taskId?: string } | undefined]>(
            'project:create-pr',
            async (event, payload?: { taskId?: string }): Promise<{ success: boolean; url?: string; error?: string } | null> => {
                validateSender(event);
                return await projectAgentService.createPullRequest(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-profiles',
        createValidatedIpcHandler<AgentProfile[], []>(
            'project:get-profiles',
            async (event): Promise<AgentProfile[]> => {
                validateSender(event);
                return await projectAgentService.getProfiles();
            },
            {
                responseSchema: z.array(AgentProfileSchema),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:register-profile',
        createValidatedIpcHandler<AgentProfile | null, [AgentProfile]>(
            'project:register-profile',
            async (event, profile: AgentProfile): Promise<AgentProfile | null> => {
                validateSender(event);
                return await projectAgentService.registerProfile(profile);
            },
            {
                argsSchema: z.tuple([AgentProfileSchema]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:delete-profile',
        createValidatedIpcHandler<boolean, [string]>(
            'project:delete-profile',
            async (event, id: string): Promise<boolean> => {
                validateSender(event);
                return await projectAgentService.deleteProfile(id);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-routing-rules',
        createValidatedIpcHandler<ModelRoutingRule[], []>(
            'project:get-routing-rules',
            async (event): Promise<ModelRoutingRule[]> => {
                validateSender(event);
                return projectAgentService.getRoutingRules();
            },
            {
                responseSchema: z.array(ModelRoutingRuleSchema),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:set-routing-rules',
        createValidatedIpcHandler<{ success: true }, [ModelRoutingRule[]]>(
            'project:set-routing-rules',
            async (event, rules: ModelRoutingRule[]): Promise<{ success: true }> => {
                validateSender(event);
                projectAgentService.setRoutingRules(rules);
                return { success: true };
            },
            {
                argsSchema: z.tuple([z.array(ModelRoutingRuleSchema)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:create-voting-session',
        createValidatedIpcHandler<VotingSession | null, [{ taskId: string; stepIndex: number; question: string; options: string[] }]>(
            'project:create-voting-session',
            async (
                event,
                payload: { taskId: string; stepIndex: number; question: string; options: string[] }
            ): Promise<VotingSession | null> => {
                validateSender(event);
                return projectAgentService.createVotingSession(
                    payload.taskId,
                    payload.stepIndex,
                    payload.question,
                    payload.options
                );
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stepIndex: z.number().int().nonnegative(),
                    question: z.string().min(1),
                    options: z.array(z.string()).min(2)
                })]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:submit-vote',
        createValidatedIpcHandler<VotingSession | null, [{
            sessionId: string;
            modelId: string;
            provider: string;
            decision: string;
            confidence: number;
            reasoning?: string;
        }]>(
            'project:submit-vote',
            async (
                event,
                payload: {
                    sessionId: string;
                    modelId: string;
                    provider: string;
                    decision: string;
                    confidence: number;
                    reasoning?: string;
                }
            ): Promise<VotingSession | null> => {
                validateSender(event);
                return await projectAgentService.submitVote({
                    sessionId: payload.sessionId,
                    modelId: payload.modelId,
                    provider: payload.provider,
                    decision: payload.decision,
                    confidence: payload.confidence,
                    reasoning: payload.reasoning
                });
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    modelId: z.string().min(1),
                    provider: z.string().min(1),
                    decision: z.string().min(1),
                    confidence: z.number().min(0).max(100),
                    reasoning: z.string().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:request-votes',
        createValidatedIpcHandler<VotingSession | null, [{ sessionId: string; models: Array<{ provider: string; model: string }> }]>(
            'project:request-votes',
            async (event, payload: { sessionId: string; models: Array<{ provider: string; model: string }> }): Promise<VotingSession | null> => {
                validateSender(event);
                return await projectAgentService.requestVotes(payload.sessionId, payload.models);
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    models: z.array(z.object({ provider: z.string(), model: z.string() }))
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:resolve-voting',
        createValidatedIpcHandler<VotingSession | null, [string]>(
            'project:resolve-voting',
            async (event, sessionId: string): Promise<VotingSession | null> => {
                validateSender(event);
                return projectAgentService.resolveVoting(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-voting-session',
        createValidatedIpcHandler<VotingSession | null, [string]>(
            'project:get-voting-session',
            async (event, sessionId: string): Promise<VotingSession | null> => {
                validateSender(event);
                return projectAgentService.getVotingSession(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:list-voting-sessions',
        createValidatedIpcHandler<VotingSession[], [{ taskId?: string } | undefined]>(
            'project:list-voting-sessions',
            async (event, payload?: { taskId?: string }): Promise<VotingSession[]> => {
                validateSender(event);
                return projectAgentService.getVotingSessions(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                responseSchema: z.array(VotingSessionSchema),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:override-voting',
        createValidatedIpcHandler<VotingSession | null, [{ sessionId: string; finalDecision: string; reason?: string }]>(
            'project:override-voting',
            async (
                event,
                payload: { sessionId: string; finalDecision: string; reason?: string }
            ): Promise<VotingSession | null> => {
                validateSender(event);
                return projectAgentService.overrideVotingDecision(
                    payload.sessionId,
                    payload.finalDecision,
                    payload.reason
                );
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    finalDecision: z.string().min(1),
                    reason: z.string().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-voting-analytics',
        createValidatedIpcHandler<VotingAnalytics, [{ taskId?: string } | undefined]>(
            'project:get-voting-analytics',
            async (event, payload?: { taskId?: string }): Promise<VotingAnalytics> => {
                validateSender(event);
                return projectAgentService.getVotingAnalytics(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-voting-config',
        createValidatedIpcHandler<VotingConfiguration, []>(
            'project:get-voting-config',
            async (event): Promise<VotingConfiguration> => {
                validateSender(event);
                return projectAgentService.getVotingConfiguration();
            },
            {
                responseSchema: VotingConfigurationSchema,
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:update-voting-config',
        createValidatedIpcHandler<VotingConfiguration, [Partial<VotingConfiguration>]>(
            'project:update-voting-config',
            async (event, patch: Partial<VotingConfiguration>): Promise<VotingConfiguration> => {
                validateSender(event);
                return projectAgentService.updateVotingConfiguration(patch);
            },
            {
                argsSchema: z.tuple([VotingConfigurationSchema.partial()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:list-voting-templates',
        createValidatedIpcHandler<VotingTemplate[], []>(
            'project:list-voting-templates',
            async (event): Promise<VotingTemplate[]> => {
                validateSender(event);
                return projectAgentService.getVotingTemplates();
            },
            {
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:build-consensus',
        createValidatedIpcHandler<ConsensusResult | null, [Array<{ modelId: string; provider: string; output: string }>]>(
            'project:build-consensus',
            async (event, outputs: Array<{ modelId: string; provider: string; output: string }>): Promise<ConsensusResult | null> => {
                validateSender(event);
                return await projectAgentService.buildConsensus(outputs);
            },
            {
                argsSchema: z.tuple([z.array(z.object({ modelId: z.string(), provider: z.string(), output: z.string() }))]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:create-debate-session',
        createValidatedIpcHandler<DebateSession | null, [{ taskId: string; stepIndex: number; topic: string }]>(
            'project:create-debate-session',
            async (
                event,
                payload: { taskId: string; stepIndex: number; topic: string }
            ): Promise<DebateSession | null> => {
                validateSender(event);
                return projectAgentService.createDebateSession(payload.taskId, payload.stepIndex, payload.topic);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stepIndex: z.number().int().nonnegative(),
                    topic: z.string().min(1)
                })]),
                responseSchema: DebateSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:submit-debate-argument',
        createValidatedIpcHandler<DebateSession | null, [{
            sessionId: string;
            agentId: string;
            provider: string;
            side: DebateSide;
            content: string;
            confidence: number;
            citations?: DebateCitation[];
        }]>(
            'project:submit-debate-argument',
            async (
                event,
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
                validateSender(event);
                return projectAgentService.submitDebateArgument(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    agentId: z.string().min(1),
                    provider: z.string().min(1),
                    side: DebateSideSchema,
                    content: z.string().min(1),
                    confidence: z.number().min(0).max(100),
                    citations: z.array(DebateCitationSchema).optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:resolve-debate-session',
        createValidatedIpcHandler<DebateSession | null, [string]>(
            'project:resolve-debate-session',
            async (event, sessionId: string): Promise<DebateSession | null> => {
                validateSender(event);
                return projectAgentService.resolveDebateSession(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:override-debate-session',
        createValidatedIpcHandler<DebateSession | null, [{ sessionId: string; moderatorId: string; decision: DebateSide | 'balanced'; reason?: string }]>(
            'project:override-debate-session',
            async (
                event,
                payload: { sessionId: string; moderatorId: string; decision: DebateSide | 'balanced'; reason?: string }
            ): Promise<DebateSession | null> => {
                validateSender(event);
                return projectAgentService.overrideDebateSession(
                    payload.sessionId,
                    payload.moderatorId,
                    payload.decision,
                    payload.reason
                );
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    moderatorId: z.string().min(1),
                    decision: z.union([DebateSideSchema, z.literal('balanced')]),
                    reason: z.string().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle('project:get-debate-session', createSafeIpcHandler('project:get-debate-session', async (event, sessionId: string) => {
        const getMainWindow = (): BrowserWindow | null => {
            return BrowserWindow.getAllWindows()[0] || null;
        };
        createMainWindowSenderValidator(getMainWindow, 'debate-session')(event);
        z.string().parse(sessionId);
        return projectAgentService.getDebateSession(sessionId);
    }, null));

    ipcMain.handle(
        'project:list-debate-history',
        createValidatedIpcHandler<DebateSession[], [{ taskId?: string } | undefined]>(
            'project:list-debate-history',
            async (event, payload?: { taskId?: string }): Promise<DebateSession[]> => {
                validateSender(event);
                return projectAgentService.getDebateHistory(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-debate-replay',
        createValidatedIpcHandler<DebateReplay | null, [string]>(
            'project:get-debate-replay',
            async (event, sessionId: string): Promise<DebateReplay | null> => {
                validateSender(event);
                return projectAgentService.getDebateReplay(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:generate-debate-summary',
        createValidatedIpcHandler<string | null, [string]>(
            'project:generate-debate-summary',
            async (event, sessionId: string): Promise<string | null> => {
                validateSender(event);
                return projectAgentService.generateDebateSummary(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-teamwork-analytics',
        createValidatedIpcHandler<AgentTeamworkAnalytics | null, [{ taskId?: string } | undefined]>(
            'project:get-teamwork-analytics',
            async (event): Promise<AgentTeamworkAnalytics | null> => {
                validateSender(event);
                return projectAgentService.getTeamworkAnalytics();
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    registerCouncilMessagingHandlers(projectAgentService);

    // AGENT-08: Performance Metrics
    ipcMain.handle(
        'project:get-performance-metrics',
        createValidatedIpcHandler<AgentPerformanceMetrics | null, [string]>(
            'project:get-performance-metrics',
            async (event, taskId: string): Promise<AgentPerformanceMetrics | null> => {
                validateSender(event);
                return projectAgentService.getPerformanceService().getMetrics(taskId) ?? null;
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:health',
        createValidatedIpcHandler<{ success: true; data: { status: string } }, []>(
            'project:health',
            async (event): Promise<{ success: true; data: { status: string } }> => {
                validateSender(event);
                return {
                    success: true,
                    data: {
                        status: 'healthy'
                    }
                };
            },
            {
                wrapResponse: true
            }
        )
    );

    registerCanvasPersistenceHandlers(databaseService, projectAgentService);
}

function registerCouncilMessagingHandlers(projectAgentService: ProjectAgentService): void {
    const getMainWindow = (): BrowserWindow | null => {
        return BrowserWindow.getAllWindows()[0] || null;
    };
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'council messaging');

    ipcMain.handle(
        'project:council-send-message',
        createValidatedIpcHandler<AgentCollaborationMessage | null, [{
            taskId: string;
            stageId: string;
            fromAgentId: string;
            toAgentId?: string;
            intent: AgentCollaborationIntent;
            priority?: AgentCollaborationPriority;
            payload: Record<string, string | number | boolean | null>;
            expiresAt?: number;
        }]>(
            'project:council-send-message',
            async (event, payload): Promise<AgentCollaborationMessage | null> => {
                validateSender(event);
                return await projectAgentService.sendCollaborationMessage(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().min(1),
                    fromAgentId: z.string().min(1),
                    toAgentId: z.string().optional(),
                    intent: AgentCollaborationIntentSchema,
                    priority: AgentCollaborationPrioritySchema.optional(),
                    payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
                    expiresAt: z.number().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-get-messages',
        createValidatedIpcHandler<AgentCollaborationMessage[], [{
            taskId: string;
            stageId?: string;
            agentId?: string;
            includeExpired?: boolean;
        }]>(
            'project:council-get-messages',
            async (event, payload): Promise<AgentCollaborationMessage[]> => {
                validateSender(event);
                return await projectAgentService.getCollaborationMessages(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().optional(),
                    agentId: z.string().optional(),
                    includeExpired: z.boolean().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-cleanup-expired-messages',
        createValidatedIpcHandler<{ success: true; removed: number }, [{ taskId?: string } | undefined]>(
            'project:council-cleanup-expired-messages',
            async (event, payload?: { taskId?: string }): Promise<{ success: true; removed: number }> => {
                validateSender(event);
                const removed = await projectAgentService.cleanupExpiredCollaborationMessages(payload?.taskId);
                return { success: true, removed };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-handle-quota-interrupt',
        createValidatedIpcHandler<QuotaInterruptResult | null, [QuotaInterruptInput]>(
            'project:council-handle-quota-interrupt',
            async (event, payload): Promise<QuotaInterruptResult | null> => {
                validateSender(event);
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
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().optional(),
                    provider: z.string().min(1),
                    model: z.string().min(1),
                    reason: z.string().optional(),
                    autoSwitch: z.boolean().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-register-worker-availability',
        createValidatedIpcHandler<WorkerAvailabilityRecord | null, [WorkerAvailabilityInput]>(
            'project:council-register-worker-availability',
            async (event, payload): Promise<WorkerAvailabilityRecord | null> => {
                validateSender(event);
                return projectAgentService.registerWorkerAvailability(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    agentId: z.string().min(1),
                    status: z.enum(['available', 'busy', 'offline']),
                    reason: z.string().optional(),
                    skills: z.array(z.string()).optional(),
                    contextReadiness: z.number().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-list-available-workers',
        createValidatedIpcHandler<WorkerAvailabilityRecord[], [{ taskId: string }]>(
            'project:council-list-available-workers',
            async (event, payload): Promise<WorkerAvailabilityRecord[]> => {
                validateSender(event);
                return projectAgentService.listAvailableWorkers(payload.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-score-helper-candidates',
        createValidatedIpcHandler<HelperCandidateScore[], [HelperCandidateInput]>(
            'project:council-score-helper-candidates',
            async (event, payload): Promise<HelperCandidateScore[]> => {
                validateSender(event);
                return projectAgentService.scoreHelperCandidates(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().min(1),
                    requiredSkills: z.array(z.string()),
                    blockedAgentIds: z.array(z.string()).optional(),
                    contextReadinessOverrides: z.record(z.string(), z.number()).optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-generate-helper-handoff-package',
        createValidatedIpcHandler<HelperHandoffPackage, [HelperHandoffInput]>(
            'project:council-generate-helper-handoff-package',
            async (event, payload): Promise<HelperHandoffPackage> => {
                validateSender(event);
                return projectAgentService.generateHelperHandoffPackage(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().min(1),
                    ownerAgentId: z.string().min(1),
                    helperAgentId: z.string().min(1),
                    stageGoal: z.string().min(1),
                    acceptanceCriteria: z.array(z.string()),
                    constraints: z.array(z.string()),
                    contextNotes: z.string().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-review-helper-merge-gate',
        createValidatedIpcHandler<HelperMergeGateDecision, [HelperMergeGateInput]>(
            'project:council-review-helper-merge-gate',
            async (event, payload): Promise<HelperMergeGateDecision> => {
                validateSender(event);
                return projectAgentService.reviewHelperMergeGate(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    acceptanceCriteria: z.array(z.string()),
                    constraints: z.array(z.string()),
                    helperOutput: z.string().min(1),
                    reviewerNotes: z.string().optional()
                })]),
                wrapResponse: true
            }
        )
    );
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
    const getMainWindow = (): BrowserWindow | null => {
        return BrowserWindow.getAllWindows()[0] || null;
    };
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'canvas persistence');

    ipcMain.handle(
        'project:save-canvas-nodes',
        createValidatedIpcHandler<void, [CanvasNode[]]>(
            'project:save-canvas-nodes',
            async (event, nodes: CanvasNode[]): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }
                await databaseService.uac.saveCanvasNodes(nodes);
            },
            {
                argsSchema: z.tuple([z.array(z.record(z.string(), z.any()))]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-canvas-nodes',
        createValidatedIpcHandler<CanvasNode[], []>(
            'project:get-canvas-nodes',
            async (event): Promise<CanvasNode[]> => {
                validateSender(event);
                if (!databaseService) {
                    return [];
                }
                const records = await databaseService.uac.getCanvasNodes();
                return records.map((r: UacCanvasNodeRecord) => ({
                    id: r.id,
                    type: r.type,
                    position: { x: r.position_x, y: r.position_y },
                    data: JSON.parse(r.data),
                }));
            },
            {
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:delete-canvas-node',
        createValidatedIpcHandler<void, [string]>(
            'project:delete-canvas-node',
            async (event, id: string): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }
                await databaseService.uac.deleteCanvasNode(id);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:save-canvas-edges',
        createValidatedIpcHandler<void, [CanvasEdge[]]>(
            'project:save-canvas-edges',
            async (event, edges: CanvasEdge[]): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }
                await databaseService.uac.saveCanvasEdges(edges);
            },
            {
                argsSchema: z.tuple([z.array(z.record(z.string(), z.any()))]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-canvas-edges',
        createValidatedIpcHandler<CanvasEdge[], []>(
            'project:get-canvas-edges',
            async (event): Promise<CanvasEdge[]> => {
                validateSender(event);
                if (!databaseService) {
                    return [];
                }
                const records = await databaseService.uac.getCanvasEdges();
                return records.map((r: UacCanvasEdgeRecord) => ({
                    id: r.id,
                    source: r.source,
                    target: r.target,
                    sourceHandle: r.source_handle ?? undefined,
                    targetHandle: r.target_handle ?? undefined,
                }));
            },
            {
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:delete-canvas-edge',
        createValidatedIpcHandler<void, [string]>(
            'project:delete-canvas-edge',
            async (event, id: string): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }
                await databaseService.uac.deleteCanvasEdge(id);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    // ===== AGT-TPL: Agent Template Handlers =====

    ipcMain.handle(
        'project:get-templates',
        createValidatedIpcHandler<AgentTemplate[], [AgentTemplateCategory | undefined]>(
            'project:get-templates',
            async (event, category?: AgentTemplateCategory): Promise<AgentTemplate[]> => {
                validateSender(event);
                if (!projectAgentService) {
                    return [];
                }
                if (category) {
                    return projectAgentService.getTemplatesByCategory(category);
                }
                return projectAgentService.getTemplates();
            },
            {
                argsSchema: z.tuple([z.string().optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:save-template',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [AgentTemplate]>(
            'project:save-template',
            async (event, template: AgentTemplate): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                if (!projectAgentService) {
                    return { success: false, error: 'Database not available' };
                }
                return await projectAgentService.saveTemplate(template);
            },
            {
                argsSchema: z.tuple([z.record(z.string(), z.any())]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:delete-template',
        createValidatedIpcHandler<{ success: boolean }, [string]>(
            'project:delete-template',
            async (event, id: string): Promise<{ success: boolean }> => {
                validateSender(event);
                if (!projectAgentService) {
                    return { success: false };
                }
                const success = await projectAgentService.deleteTemplate(id);
                return { success };
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:export-template',
        createValidatedIpcHandler<AgentTemplateExport | null, [string]>(
            'project:export-template',
            async (event, id: string): Promise<AgentTemplateExport | null> => {
                validateSender(event);
                if (!projectAgentService) {
                    return null;
                }
                return projectAgentService.exportTemplate(id);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:import-template',
        createValidatedIpcHandler<{ success: boolean; template?: AgentTemplate; error?: string }, [AgentTemplateExport]>(
            'project:import-template',
            async (event, exported: AgentTemplateExport): Promise<{ success: boolean; template?: AgentTemplate; error?: string }> => {
                validateSender(event);
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
            },
            {
                argsSchema: z.tuple([z.record(z.string(), z.any())]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:apply-template',
        createValidatedIpcHandler<{ success: boolean; error?: string; template?: AgentTemplate; task?: string; steps?: string[] }, [{ templateId: string; values: Record<string, string | number | boolean> }]>(
            'project:apply-template',
            async (event, payload): Promise<{ success: boolean; error?: string; template?: AgentTemplate; task?: string; steps?: string[] }> => {
                validateSender(event);
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
            },
            {
                argsSchema: z.tuple([z.object({
                    templateId: z.string().min(1),
                    values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-template',
        createValidatedIpcHandler<AgentTemplate | null, [string]>(
            'project:get-template',
            async (event, id: string): Promise<AgentTemplate | null> => {
                validateSender(event);
                if (!projectAgentService) {
                    return null;
                }
                return projectAgentService.getTemplates().find(template => template.id === id) ?? null;
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );
}

