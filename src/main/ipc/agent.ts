import { ipcMain } from 'electron'
import { AgentService } from '../services/agent.service'

export function registerAgentIpc(agentService: AgentService) {
    ipcMain.handle('agent:get-all', async () => {
        try {
            const agents = await agentService.getAllAgents()
            return JSON.parse(JSON.stringify(agents))
        } catch (error: any) {
            console.error('[IPC] agent:get-all failed:', error)
            return []
        }
    })

    ipcMain.handle('agent:get', async (_event, id) => {
        return await agentService.getAgent(id)
    })

    // Future: agent:create, agent:delete
}
