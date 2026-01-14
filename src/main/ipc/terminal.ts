import { TerminalService } from '@main/services/project/terminal.service'
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util'
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron'

let terminalService: TerminalService | null = null

export function registerTerminalIpc(getWindow: () => BrowserWindow | null) {
    ipcMain.setMaxListeners(50)
    try {
        terminalService = new TerminalService()
        console.log('[IPC] Terminal service initialized')
    } catch (error) {
        console.error('[IPC] Failed to initialize terminal service:', error)
        terminalService = null
    }

    // Check availability
    ipcMain.handle('terminal:isAvailable', createIpcHandler('terminal:isAvailable', async () => {
        return terminalService?.isAvailable() ?? false
    }))

    // Get available shells
    ipcMain.handle('terminal:getShells', createSafeIpcHandler('terminal:getShells', async () => {
        return terminalService?.getAvailableShells() ?? []
    }, []))

    // Create session
    ipcMain.handle('terminal:create', createIpcHandler('terminal:create', async (_event: IpcMainInvokeEvent, options: {
        id: string
        shell?: string
        cwd?: string
        cols?: number
        rows?: number
    }) => {
        if (!terminalService) {
            throw new Error('Service not initialized')
        }

        const success = terminalService.createSession({
            ...options,
            onData: (data: string) => {
                getWindow()?.webContents.send('terminal:data', { id: options.id, data })
            },
            onExit: (code: number) => {
                getWindow()?.webContents.send('terminal:exit', { id: options.id, code })
            }
        })
        return { success }
    }))

    // Write to session
    ipcMain.handle('terminal:write', createSafeIpcHandler('terminal:write', async (_event: IpcMainInvokeEvent, sessionId: string, data: string) => {
        if (!terminalService) {return false}
        return terminalService.write(sessionId, data) ?? false
    }, false))

    // Resize session
    ipcMain.handle('terminal:resize', createSafeIpcHandler('terminal:resize', async (_event: IpcMainInvokeEvent, sessionId: string, cols: number, rows: number) => {
        if (!terminalService) {return false}
        return terminalService.resize(sessionId, cols, rows) ?? false
    }, false))

    // Kill session
    ipcMain.handle('terminal:kill', createSafeIpcHandler('terminal:kill', async (_event: IpcMainInvokeEvent, sessionId: string) => {
        if (!terminalService) {return false}
        return terminalService.kill(sessionId) ?? false
    }, false))

    // Get active sessions
    ipcMain.handle('terminal:getSessions', createSafeIpcHandler('terminal:getSessions', async () => {
        if (!terminalService) {return []}
        return terminalService.getActiveSessions() ?? []
    }, []))

    // Read session buffer
    ipcMain.handle('terminal:readBuffer', createSafeIpcHandler('terminal:readBuffer', async (_event: IpcMainInvokeEvent, sessionId: string) => {
        if (!terminalService) {return ''}
        return terminalService.getSessionBuffer(sessionId) ?? ''
    }, ''))
}
