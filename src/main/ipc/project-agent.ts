import { DatabaseService } from '@main/services/data/database.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { IpcValue, JsonObject } from '@shared/types/common';
import {
    AgentProfile,
    AgentStartOptions,
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
    ModelRoutingRule,
    ProjectState,
    ProjectStep,
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

interface LegacyStartTaskPayload {
    projectId?: string;
    description?: string;
    files?: Array<{ name?: string; path?: string }>;
    provider?: string;
    model?: string;
    nodeId?: string;
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

function asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null) {
        return value as Record<string, unknown>;
    }
    return {};
}

function getPayload<T>(value: unknown): T {
    return asRecord(value) as T;
}

function toJsonValue(value: unknown): IpcValue {
    if (value === null) {
        return null;
    }
    if (value === undefined) {
        return undefined;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(item => {
            const normalized = toJsonValue(item);
            return normalized === undefined ? null : normalized;
        });
    }
    if (typeof value === 'object') {
        const normalizedObject: JsonObject = {};
        for (const [key, entryValue] of Object.entries(value)) {
            const normalized = toJsonValue(entryValue);
            if (normalized !== undefined) {
                normalizedObject[key] = normalized;
            }
        }
        return normalizedObject;
    }
    return String(value);
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

    eventBus.on('project:update', (state: ProjectState) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('project:update', state);

            const currentTaskId = projectAgentService.getCurrentTaskId() ?? '';
            if (currentTaskId && state.status === 'running' && lastStatus !== 'running') {
                win.webContents.send('agent-event', {
                    type: 'agent:task_started',
                    data: {
                        taskId: currentTaskId,
                        description: state.currentTask,
                    },
                });
            }

            win.webContents.send('agent-event', {
                type: 'agent:state_changed',
                data: {
                    taskId: currentTaskId,
                    state: state.status,
                },
            });
            lastStatus = state.status;
        }
    });
    ipcMain.handle('project:start', createSafeIpcHandler('project:start', async (_, options: AgentStartOptions) => {
        await projectAgentService.start(options);
    }, undefined));

    ipcMain.handle('project:stop', createSafeIpcHandler('project:stop', async (_, payload?: { taskId?: string }) => {
        await projectAgentService.stop(payload?.taskId);
    }, undefined));

    ipcMain.handle('project:reset-state', createSafeIpcHandler('project:reset-state', async () => {
        await projectAgentService.resetState();
    }, undefined));

    ipcMain.handle('project:plan', createSafeIpcHandler('project:plan', async (_, options: AgentStartOptions) => {
        await projectAgentService.generatePlan(options);
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

    ipcMain.handle('project:get-status', createSafeIpcHandler('project:get-status', async (_, payload?: { taskId?: string }) => {
        return await projectAgentService.getStatus(payload?.taskId);
    }, null));

    ipcMain.handle('project:retry-step', createSafeIpcHandler('project:retry-step', async (_, payload: number | { index: number; taskId?: string }) => {
        if (typeof payload === 'number') {
            await projectAgentService.retryStep(payload);
            return;
        }
        await projectAgentService.retryStep(payload.index, payload.taskId);
    }, undefined));

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

    ipcMain.handle(
        'project:build-consensus',
        createSafeIpcHandler('project:build-consensus', async (_, outputs: Array<{ modelId: string; provider: string; output: string }>) => {
            return await projectAgentService.buildConsensus(outputs);
        }, null)
    );

    // AGENT-08: Performance Metrics
    ipcMain.handle('project:get-performance-metrics', createSafeIpcHandler('project:get-performance-metrics', async (_, taskId: string) => {
        validateString(taskId, 'taskId');
        const metrics = projectAgentService.getPerformanceService().getMetrics(taskId);
        return metrics ?? null;
    }, null));

    registerLegacyProjectAgentCompatibilityHandlers(projectAgentService);
    registerCanvasPersistenceHandlers(databaseService, projectAgentService);
}

/**
 * Registers legacy project agent compatibility handlers that bridge
 * old-style `project-agent:*` channels to the current service API.
 * @param projectAgentService - The project agent service instance
 */
function registerLegacyProjectAgentCompatibilityHandlers(
    projectAgentService: ProjectAgentService
): void {
    registerLegacyProjectAgentMutationHandlers(projectAgentService);
    registerLegacyProjectAgentQueryHandlers(projectAgentService);
}

/**
 * Registers legacy mutation handlers for project agent task lifecycle
 * operations (start, pause, stop, resume, approve, reject, delete).
 * @param projectAgentService - The project agent service instance
 */
function registerLegacyProjectAgentMutationHandlers(
    projectAgentService: ProjectAgentService
): void {
    registerBatchableHandler('project-agent:start-task', async (_event, ...args) => {
        const payload = getPayload<LegacyStartTaskPayload>(args[0]);
        const options: AgentStartOptions = {
            task: payload.description ?? '',
            projectId: payload.projectId,
            nodeId: payload.nodeId,
            agentProfileId: 'default',
            model:
                payload.provider && payload.model
                    ? {
                        provider: payload.provider,
                        model: payload.model,
                    }
                    : undefined,
            attachments: (payload.files ?? []).map(file => ({
                name: file.name ?? '',
                path: file.path ?? '',
                size: 0,
            })),
        };

        await projectAgentService.start(options);
        return {
            success: true,
            taskId: projectAgentService.getCurrentTaskId(),
        };
    });

    registerBatchableHandler('project-agent:pause-task', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, error: 'taskId is required' };
        }

        await projectAgentService.pauseTask(taskId);
        return { success: true };
    });

    registerBatchableHandler('project-agent:stop-task', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (taskId) {
            await projectAgentService.pauseTask(taskId);
        }
        await projectAgentService.stop();
        return { success: true };
    });

    registerBatchableHandler('project-agent:save-snapshot', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, error: 'taskId is required' };
        }

        const checkpointId = await projectAgentService.saveSnapshot(taskId);
        return {
            success: Boolean(checkpointId),
            checkpointId,
        };
    });

    registerBatchableHandler('project-agent:resume-task', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, error: 'taskId is required' };
        }

        const success = await projectAgentService.resumeTask(taskId);
        return { success, error: success ? undefined : 'Failed to resume task' };
    });

    registerBatchableHandler('project-agent:approve-plan', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, error: 'taskId is required' };
        }
        const success = await projectAgentService.approveCurrentPlan(taskId);
        return { success, error: success ? undefined : 'Failed to approve plan' };
    });

    registerBatchableHandler('project-agent:reject-plan', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string; reason?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, error: 'taskId is required' };
        }
        const success = await projectAgentService.rejectCurrentPlan(taskId, payload.reason);
        return { success, error: success ? undefined : 'Failed to reject plan' };
    });

    registerBatchableHandler('project-agent:delete-task', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, error: 'taskId is required' };
        }
        const success = await projectAgentService.deleteTask(taskId);
        return { success, error: success ? undefined : 'Failed to delete task' };
    });

    registerBatchableHandler('project-agent:select-model', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string; provider?: string; model?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId || !payload.provider || !payload.model) {
            return { success: false, error: 'taskId, provider and model are required' };
        }
        const success = await projectAgentService.selectModel(
            taskId,
            payload.provider,
            payload.model
        );
        return { success, error: success ? undefined : 'Failed to select model' };
    });

    registerBatchableHandler('project-agent:subscribe-events', async () => {
        return { success: true };
    });
}

/**
 * Registers legacy query handlers for retrieving project agent status,
 * messages, events, telemetry, task history, and available models.
 * @param projectAgentService - The project agent service instance
 */
function registerLegacyProjectAgentQueryHandlers(projectAgentService: ProjectAgentService): void {
    registerBatchableHandler('project-agent:get-status', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, error: 'taskId is required' };
        }
        return await projectAgentService.getTaskStatusDetails(taskId);
    });

    registerBatchableHandler('project-agent:get-messages', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, messages: [] };
        }
        return await projectAgentService.getTaskMessages(taskId);
    });

    registerBatchableHandler('project-agent:get-events', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, events: [] };
        }
        const result = await projectAgentService.getTaskEvents(taskId);
        return {
            success: result.success,
            events: result.events.map(eventItem => ({
                id: eventItem.id,
                type: eventItem.type,
                timestamp:
                    eventItem.timestamp instanceof Date
                        ? eventItem.timestamp.toISOString()
                        : String(eventItem.timestamp),
                payload: toJsonValue(eventItem.payload) ?? null,
            })),
        };
    });

    registerBatchableHandler('project-agent:get-telemetry', async (_event, ...args) => {
        const payload = getPayload<{ taskId?: string }>(args[0]);
        const taskId = typeof args[0] === 'string' ? args[0] : payload.taskId;
        if (!taskId) {
            return { success: false, telemetry: [] };
        }
        return await projectAgentService.getTaskTelemetry(taskId);
    });

    registerBatchableHandler('project-agent:get-task-history', async (_event, ...args) => {
        const payload = getPayload<{ projectId?: string }>(args[0]);
        const projectId = typeof args[0] === 'string' ? args[0] : payload.projectId;
        if (!projectId) {
            return [];
        }
        const history = await projectAgentService.getTaskHistory(projectId);
        return history.map(item => ({
            id: item.id,
            description: item.description,
            provider: item.provider,
            model: item.model,
            status: item.status,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            latestCheckpointId: item.latestCheckpointId,
        }));
    });

    registerBatchableHandler('project-agent:get-available-models', async () => {
        return projectAgentService.getAvailableModels();
    });
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
