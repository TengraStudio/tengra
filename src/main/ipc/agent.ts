/**
 * IPC handlers for Agent Service
 */
import { AgentService } from '@main/services/llm/agent.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { ipcMain } from 'electron';

export function registerAgentIpc(agentService: AgentService) {
    /**
     * Get all agents
     * Returns an empty array on failure
     */
    ipcMain.handle('agent:get-all', createSafeIpcHandler('agent:get-all', async () => {
        const agents = await agentService.getAllAgents();
        return safeJsonParse(JSON.stringify(agents), agents);
    }, []));

    /**
     * Get a specific agent by ID
     * Returns null on failure
     */
    ipcMain.handle('agent:get', createSafeIpcHandler('agent:get', async (_event, id: string) => {
        return await agentService.getAgent(id);
    }, null));

    // Future: agent:create, agent:delete
}

