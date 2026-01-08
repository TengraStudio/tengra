import { ipcMain } from 'electron'
import { AgentCouncilService } from '../services/agent-council.service'
import { DatabaseService } from '../services/data/database.service'

export function registerCouncilIpc(agentCouncil: AgentCouncilService, _db: DatabaseService) {
    ipcMain.handle('council:create', async (_, goal) => {
        return agentCouncil.createSession(goal)
    })

    ipcMain.handle('council:get-all', async () => {
        return agentCouncil.getSessions()
    })

    ipcMain.handle('council:get', async (_, id) => {
        return agentCouncil.getSession(id)
    })

    ipcMain.handle('council:log', async (_, sessionId, agentId, message, type) => {
        return agentCouncil.addLog(sessionId, agentId, message, type)
    })

    ipcMain.on('council:run-step', (_, sessionId) => {
        // Run asynchronously without blocking IPC
        agentCouncil.runSessionStep(sessionId).catch(err => {
            console.error('[Council] Step error:', err)
        })
    })

    ipcMain.on('council:start-loop', (_, sessionId) => {
        agentCouncil.startSessionLoop(sessionId).catch(err => {
            console.error('[Council] Start loop error:', err)
        })
    })

    ipcMain.on('council:stop-loop', (_, sessionId) => {
        agentCouncil.stopSessionLoop(sessionId).catch(err => {
            console.error('[Council] Stop loop error:', err)
        })
    })
}
