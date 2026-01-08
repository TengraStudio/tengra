import { ipcMain } from 'electron'
import { CouncilService } from '../services/council.service'
import { DatabaseService } from '../services/database.service'

export function registerCouncilIpc(council: CouncilService, _db: DatabaseService) {
    ipcMain.handle('council:create', async (_, goal) => {
        return council.createSession(goal)
    })

    ipcMain.handle('council:get-all', async () => {
        return council.getSessions()
    })

    ipcMain.handle('council:get', async (_, id) => {
        return council.getSession(id)
    })

    ipcMain.handle('council:log', async (_, sessionId, agentId, message, type) => {
        return council.addLog(sessionId, agentId, message, type)
    })

    ipcMain.on('council:run-step', (_, sessionId) => {
        // Run asynchronously without blocking IPC
        council.runSessionStep(sessionId).catch(err => {
            console.error('[Council] Step error:', err)
        })
    })

    ipcMain.on('council:start-loop', (_, sessionId) => {
        council.startSessionLoop(sessionId).catch(err => {
            console.error('[Council] Start loop error:', err)
        })
    })

    ipcMain.on('council:stop-loop', (_, sessionId) => {
        council.stopSessionLoop(sessionId).catch(err => {
            console.error('[Council] Stop loop error:', err)
        })
    })
}
