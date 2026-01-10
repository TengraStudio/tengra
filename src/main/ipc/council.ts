import { ipcMain } from 'electron'
import { AgentCouncilService } from '../services/agent-council.service'
import { DatabaseService } from '../services/data/database.service'
import { getErrorMessage } from '../../shared/utils/error.util'

export function registerCouncilIpc(agentCouncil: AgentCouncilService, _db: DatabaseService) {
    ipcMain.handle('council:create', async (_, goal) => {
        try {
            return await agentCouncil.createSession(goal)
        } catch (error) {
            console.error('[IPC] council:create failed:', getErrorMessage(error as Error))
            throw error // Or return a normalized error
        }
    })

    ipcMain.handle('council:get-all', async () => {
        try {
            return await agentCouncil.getSessions()
        } catch (error) {
            console.error('[IPC] council:get-all failed:', getErrorMessage(error as Error))
            return []
        }
    })

    ipcMain.handle('council:get', async (_, id) => {
        try {
            return await agentCouncil.getSession(id)
        } catch (error) {
            console.error('[IPC] council:get failed:', getErrorMessage(error as Error))
            return null
        }
    })

    ipcMain.handle('council:log', async (_, sessionId, agentId, message, type) => {
        try {
            return await agentCouncil.addLog(sessionId, agentId, message, type)
        } catch (error) {
            console.error('[IPC] council:log failed:', getErrorMessage(error as Error))
            return null
        }
    })

    ipcMain.on('council:run-step', (_, sessionId) => {
        // Run asynchronously without blocking IPC
        agentCouncil.runSessionStep(sessionId).catch(err => {
            console.error('[Council] Step error:', err)
        })
    })

    ipcMain.on('council:start-loop', (_, sessionId) => {
        agentCouncil.startSessionLoop(sessionId).catch(err => {
            console.error('[Council] Start loop error:', getErrorMessage(err))
        })
    })

    ipcMain.on('council:stop-loop', (_, sessionId) => {
        agentCouncil.stopSessionLoop(sessionId).catch(err => {
            console.error('[Council] Stop loop error:', getErrorMessage(err))
        })
    })
}
