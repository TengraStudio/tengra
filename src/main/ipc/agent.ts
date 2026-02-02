import { appLogger } from '@main/logging/logger';
import { AgentService } from '@main/services/llm/agent.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { ipcMain } from 'electron';


export function registerAgentIpc(agentService: AgentService) {
    ipcMain.handle('agent:get-all', async () => {
        appLogger.info('ipc', 'agent:get-all called');
        try {
            const agents = await agentService.getAllAgents();
            return safeJsonParse(JSON.stringify(agents), agents);
        } catch (error) {
            appLogger.error('ipc', `agent:get-all failed: ${getErrorMessage(error as Error)}`);
            return [];
        }
    });

    ipcMain.handle('agent:get', async (_event, id) => {
        try {
            return await agentService.getAgent(id);
        } catch (error) {
            appLogger.error('ipc', `agent:get failed: ${getErrorMessage(error as Error)}`);
            return null;
        }
    });

    // Future: agent:create, agent:delete
}
