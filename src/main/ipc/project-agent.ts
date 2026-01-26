import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { ipcMain } from 'electron';

export function registerProjectAgentIpc(projectAgentService: ProjectAgentService) {
    ipcMain.handle('project:start', async (_, task: string) => {
        await projectAgentService.start(task);
    });

    ipcMain.handle('project:stop', async () => {
        await projectAgentService.stop();
    });

    ipcMain.handle('project:get-status', async () => {
        return await projectAgentService.getStatus();
    });
}
