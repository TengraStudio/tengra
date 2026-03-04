import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { DatabaseService } from '@main/services/data/database.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    AgentProfileSchema,
    AgentStartOptionsSchema,
    ModelRoutingRuleSchema,
    ProjectStateSchema,
    ProjectStepSchema,
} from '@shared/schemas/project-agent-hardening.schema';
import type { AgentEventRecord, TaskMetrics } from '@shared/types/agent-state';
import type {
    AgentProfile,
    AgentStartOptions,
    AgentTaskHistoryItem,
    ModelRoutingRule,
    ProjectState,
    ProjectStep,
} from '@shared/types/project-agent';
import type {
    AgentCheckpointItem,
    PlanVersionItem,
    RollbackCheckpointResult,
} from '@shared/types/project-agent';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

import { registerProjectAgentCanvasHandlers } from './project-agent-canvas';
import { registerProjectAgentCouncilHandlers } from './project-agent-council';
import { registerProjectAgentDecisionHandlers } from './project-agent-decision';

interface AvailableModelInfo {
    id: string;
    name: string;
    provider: string;
}

type TaskMessagesResult = Awaited<ReturnType<ProjectAgentService['getTaskMessages']>>;

const PROJECT_UPDATE_THROTTLE_MS = 50;
const STREAM_EVENT_VERSION = 'v1' as const;

const createEventDedupeKey = (prefix: string, taskId: string, sequence: number): string => {
    return `${STREAM_EVENT_VERSION}:${prefix}:${taskId}:${Date.now()}:${sequence}`;
};

function registerProjectAgentAdvancedHandlers(
    projectAgentService: ProjectAgentService,
    validateSender: ReturnType<typeof createMainWindowSenderValidator>
): void {
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
        createValidatedIpcHandler<TaskMessagesResult, [{ taskId: string }]>(
            'project:get-messages',
            async (event, payload: { taskId: string }): Promise<TaskMessagesResult> => {
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

    registerProjectAgentAdvancedHandlers(projectAgentService, validateSender);

    registerProjectAgentDecisionHandlers(projectAgentService, getMainWindow);

    registerProjectAgentCouncilHandlers(projectAgentService, getMainWindow);

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

    registerProjectAgentCanvasHandlers(getMainWindow, databaseService, projectAgentService);
}

