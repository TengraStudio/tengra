import { MultiAgentOrchestratorService } from '@main/services/project/orchestrator.service';
import { OrchestratorState, ProjectStep } from '@shared/types/project-agent';
import { BrowserWindow, ipcMain } from 'electron';

export function registerOrchestratorIpc(
    orchestrator: MultiAgentOrchestratorService,
    getMainWindow: () => BrowserWindow | null
) {
    // Forward orchestrator updates to renderer
    const eventBus = orchestrator.eventBus;
    eventBus.on('orchestrator:update', (state: OrchestratorState) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('orchestrator:update', state);
        }
    });

    ipcMain.handle('orchestrator:start', async (_, task: string, projectId?: string) => {
        await orchestrator.orchestrate(task, projectId);
    });

    ipcMain.handle('orchestrator:approve', async (_, plan: ProjectStep[]) => {
        await orchestrator.approvePlan(plan);
    });

    ipcMain.handle('orchestrator:get-state', async () => {
        return orchestrator.getState();
    });

    ipcMain.handle('orchestrator:stop', async () => {
        await orchestrator.stop();
    });
}
