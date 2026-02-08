import { DatabaseService } from '@main/services/data/database.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { AgentProfile, AgentStartOptions, ProjectState, ProjectStep } from '@shared/types/project-agent';
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

export function registerProjectAgentIpc(
    projectAgentService: ProjectAgentService,
    getMainWindow: () => BrowserWindow | null,
    databaseService?: DatabaseService
) {
    // Forward project updates to renderer
    const eventBus = projectAgentService.eventBus;
    eventBus.on('project:update', (state: ProjectState) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('project:update', state);
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

    ipcMain.handle('project:get-profiles', async () => {
        return await projectAgentService.getProfiles();
    });

    ipcMain.handle('project:register-profile', async (_, profile: AgentProfile) => {
        return await projectAgentService.registerProfile(profile);
    });

    ipcMain.handle('project:delete-profile', async (_, id: string) => {
        return await projectAgentService.deleteProfile(id);
    });

    // ==================== Canvas Persistence ====================

    ipcMain.handle('project:save-canvas-nodes', async (_, nodes: CanvasNode[]) => {
        if (!databaseService) { return; }
        await databaseService.uac.saveCanvasNodes(nodes);
    });

    ipcMain.handle('project:get-canvas-nodes', async () => {
        if (!databaseService) { return []; }
        const records = await databaseService.uac.getCanvasNodes();
        return records.map(r => ({
            id: r.id,
            type: r.type,
            position: { x: r.position_x, y: r.position_y },
            data: JSON.parse(r.data)
        }));
    });

    ipcMain.handle('project:delete-canvas-node', async (_, id: string) => {
        if (!databaseService) { return; }
        await databaseService.uac.deleteCanvasNode(id);
    });

    ipcMain.handle('project:save-canvas-edges', async (_, edges: CanvasEdge[]) => {
        if (!databaseService) { return; }
        await databaseService.uac.saveCanvasEdges(edges);
    });

    ipcMain.handle('project:get-canvas-edges', async () => {
        if (!databaseService) { return []; }
        const records = await databaseService.uac.getCanvasEdges();
        return records.map(r => ({
            id: r.id,
            source: r.source,
            target: r.target,
            sourceHandle: r.source_handle ?? undefined,
            targetHandle: r.target_handle ?? undefined
        }));
    });

    ipcMain.handle('project:delete-canvas-edge', async (_, id: string) => {
        if (!databaseService) { return; }
        await databaseService.uac.deleteCanvasEdge(id);
    });
}
