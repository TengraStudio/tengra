import { AgentCouncilService } from '@main/services/agent-council.service'
import { DatabaseService } from '@main/services/data/database.service'
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util'
import { ipcMain, IpcMainInvokeEvent } from 'electron'

export function registerCouncilIpc(agentCouncil: AgentCouncilService, _db: DatabaseService) {
    ipcMain.handle('council:create', createIpcHandler('council:create', async (_event: IpcMainInvokeEvent, goal: string) => {
        return await agentCouncil.createSession(goal)
    }))

    ipcMain.handle('council:get-all', createSafeIpcHandler('council:get-all', async () => {
        return await agentCouncil.getSessions()
    }, []))

    ipcMain.handle('council:get', createSafeIpcHandler('council:get', async (_event: IpcMainInvokeEvent, id: string) => {
        return await agentCouncil.getSession(id)
    }, null))

    ipcMain.handle('council:log', createSafeIpcHandler('council:log', async (_event: IpcMainInvokeEvent, sessionId: string, agentId: string, message: string, type: string) => {
        const logType = (type === 'error' || type === 'info' || type === 'success' || type === 'plan' || type === 'action') 
            ? type 
            : 'info'
        return await agentCouncil.addLog(sessionId, agentId, message, logType)
    }, null))

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
