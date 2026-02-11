import { DatabaseService } from '@main/services/data/database.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { IpcValue, JsonObject } from '@shared/types/common';
import {
    AgentProfile,
    AgentStartOptions,
    AgentTemplate,
    AgentTemplateExport,
    ProjectState,
    ProjectStep,
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
    ipcMain.handle('project:start', async (_, options: AgentStartOptions) => {
        await projectAgentService.start(options);
    });

    ipcMain.handle('project:stop', async () => {
        await projectAgentService.stop();
    });

    ipcMain.handle('project:reset-state', async () => {
        await projectAgentService.resetState();
    });

    ipcMain.handle('project:plan', async (_, options: AgentStartOptions) => {
        await projectAgentService.generatePlan(options);
    });

    ipcMain.handle('project:approve', async (_, plan: ProjectStep[]) => {
        await projectAgentService.approvePlan(plan);
    });

    ipcMain.handle('project:get-status', async () => {
        return await projectAgentService.getStatus();
    });

    ipcMain.handle('project:retry-step', async (_, index: number) => {
        await projectAgentService.retryStep(index);
    });

    ipcMain.handle('project:resume-checkpoint', async (_, checkpointId: string) => {
        await projectAgentService.resumeFromCheckpoint(checkpointId);
    });

    ipcMain.handle('project:get-task-history', async (_, projectId: string) => {
        return await projectAgentService.getTaskHistory(projectId);
    });

    ipcMain.handle('project:get-checkpoints', async (_, taskId: string) => {
        return await projectAgentService.getCheckpoints(taskId);
    });

    ipcMain.handle('project:rollback-checkpoint', async (_, checkpointId: string) => {
        return await projectAgentService.rollbackCheckpoint(checkpointId);
    });

    ipcMain.handle('project:get-plan-versions', async (_, taskId: string) => {
        return await projectAgentService.getPlanVersions(taskId);
    });

    ipcMain.handle('project:delete-task-by-node', async (_, nodeId: string) => {
        return await projectAgentService.deleteTaskByNodeId(nodeId);
    });

    ipcMain.handle('project:get-profiles', async () => {
        return await projectAgentService.getProfiles();
    });

    ipcMain.handle('project:register-profile', async (_, profile: AgentProfile) => {
        return await projectAgentService.registerProfile(profile);
    });

    ipcMain.handle('project:delete-profile', async (_, id: string) => {
        return await projectAgentService.deleteProfile(id);
    });

    registerLegacyProjectAgentCompatibilityHandlers(projectAgentService);
    registerCanvasPersistenceHandlers(databaseService);
}

function registerLegacyProjectAgentCompatibilityHandlers(
    projectAgentService: ProjectAgentService
): void {
    registerLegacyProjectAgentMutationHandlers(projectAgentService);
    registerLegacyProjectAgentQueryHandlers(projectAgentService);
}

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

function registerCanvasPersistenceHandlers(databaseService?: DatabaseService): void {
    ipcMain.handle('project:save-canvas-nodes', async (_, nodes: CanvasNode[]) => {
        if (!databaseService) {
            return;
        }
        await databaseService.uac.saveCanvasNodes(nodes);
    });

    ipcMain.handle('project:get-canvas-nodes', async () => {
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
    });

    ipcMain.handle('project:delete-canvas-node', async (_, id: string) => {
        if (!databaseService) {
            return;
        }
        await databaseService.uac.deleteCanvasNode(id);
    });

    ipcMain.handle('project:save-canvas-edges', async (_, edges: CanvasEdge[]) => {
        if (!databaseService) {
            return;
        }
        await databaseService.uac.saveCanvasEdges(edges);
    });

    ipcMain.handle('project:get-canvas-edges', async () => {
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
    });

    ipcMain.handle('project:delete-canvas-edge', async (_, id: string) => {
        if (!databaseService) {
            return;
        }
        await databaseService.uac.deleteCanvasEdge(id);
    });

    // ===== AGT-TPL: Agent Template Handlers =====

    ipcMain.handle('project:get-templates', async () => {
        if (!databaseService) {
            return [];
        }
        return await databaseService.getAgentTemplates();
    });

    ipcMain.handle('project:save-template', async (_, template: AgentTemplate) => {
        if (!databaseService) {
            return { success: false, error: 'Database not available' };
        }
        await databaseService.saveAgentTemplate(template);
        return { success: true };
    });

    ipcMain.handle('project:delete-template', async (_, id: string) => {
        if (!databaseService) {
            return { success: false, error: 'Database not available' };
        }
        await databaseService.deleteAgentTemplate(id);
        return { success: true };
    });

    ipcMain.handle('project:export-template', async (_, id: string) => {
        if (!databaseService) {
            return null;
        }
        const templates = await databaseService.getAgentTemplates();
        const template = templates.find(t => t.id === id);
        if (!template) {
            return null;
        }
        const exported: AgentTemplateExport = {
            version: 1,
            template: { ...template, isBuiltIn: false },
            exportedAt: Date.now(),
        };
        return exported;
    });

    ipcMain.handle('project:import-template', async (_, exported: AgentTemplateExport) => {
        if (!databaseService) {
            return { success: false, error: 'Database not available' };
        }
        if (exported.version !== 1) {
            return { success: false, error: 'Unsupported export version' };
        }
        const now = Date.now();
        const importedTemplate: AgentTemplate = {
            ...exported.template,
            id: `template-imported-${Date.now()}`,
            isBuiltIn: false,
            createdAt: now,
            updatedAt: now,
        };
        await databaseService.saveAgentTemplate(importedTemplate);
        return { success: true, template: importedTemplate };
    });
}
