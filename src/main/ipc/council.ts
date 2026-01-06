import { ipcMain } from 'electron'
import { CouncilService, AgentConfig } from '../services/council.service'

export function registerCouncilIpc(councilService: CouncilService, databaseService: any) {
    ipcMain.handle('db:runCouncil', async (event, projectId: string, taskId: string, agents: AgentConfig[]) => {
        return await councilService.runCouncil(projectId, taskId, agents, (update) => {
            event.sender.send('council:update', update)
        })
    })
    ipcMain.handle('council:approvePlan', async (_event, sessionId: string, approved: boolean, editedPlan?: string) => {
        return councilService.approvePlan(sessionId, approved, editedPlan)
    })
    ipcMain.handle('council:generateAgents', async (_event, taskDescription: string) => {
        return await councilService.generateAgentsForTask(taskDescription)
    })
    ipcMain.handle('db:getCouncilSessions', async (_event, projectId?: string) => {
        return databaseService.getCouncilSessions(projectId)
    })
    ipcMain.handle('db:getCouncilSessionById', async (_event, id: string) => {
        return databaseService.getCouncilSessionById(id)
    })
}
