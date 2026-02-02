import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { AgentStartOptions, ProjectState, ProjectStep } from '@shared/types/project-agent';
import { BrowserWindow, ipcMain } from 'electron';

export function registerProjectAgentIpc(
    projectAgentService: ProjectAgentService,
    getMainWindow: () => BrowserWindow | null
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

    ipcMain.handle('project:get-profiles', async () => {
        return await projectAgentService.getProfiles();
    });
}
