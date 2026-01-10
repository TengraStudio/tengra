import { ipcMain, BrowserWindow } from 'electron'
import { TerminalService } from '../services/terminal.service'
import { getErrorMessage } from '../../shared/utils/error.util'

let terminalService: TerminalService | null = null

ipcMain.setMaxListeners(50)

export function registerTerminalIpc(getWindow: () => BrowserWindow | null) {
    terminalService = new TerminalService()

    // Check availability
    ipcMain.handle('terminal:isAvailable', () => {
        return terminalService?.isAvailable() ?? false
    })

    // Get available shells
    ipcMain.handle('terminal:getShells', () => {
        return terminalService?.getAvailableShells() ?? []
    })

    // Create session
    ipcMain.handle('terminal:create', async (_event, options: {
        id: string
        shell?: string
        cwd?: string
        cols?: number
        rows?: number
    }) => {
        if (!terminalService) return { success: false, error: 'Service not initialized' }

        try {
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
        } catch (error) {
            console.error('[IPC] terminal:create failed:', getErrorMessage(error as Error))
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Write to session
    ipcMain.handle('terminal:write', (_event, sessionId: string, data: string) => {
        try {
            return terminalService?.write(sessionId, data) ?? false
        } catch (error) {
            console.error('[IPC] terminal:write failed:', getErrorMessage(error as Error))
            return false
        }
    })

    // Resize session
    ipcMain.handle('terminal:resize', (_event, sessionId: string, cols: number, rows: number) => {
        try {
            return terminalService?.resize(sessionId, cols, rows) ?? false
        } catch (error) {
            console.error('[IPC] terminal:resize failed:', getErrorMessage(error as Error))
            return false
        }
    })

    // Kill session
    ipcMain.handle('terminal:kill', (_event, sessionId: string) => {
        try {
            return terminalService?.kill(sessionId) ?? false
        } catch (error) {
            console.error('[IPC] terminal:kill failed:', getErrorMessage(error as Error))
            return false
        }
    })

    // Get active sessions
    ipcMain.handle('terminal:getSessions', () => {
        return terminalService?.getActiveSessions() ?? []
    })

    // Read session buffer
    ipcMain.handle('terminal:readBuffer', (_event, sessionId: string) => {
        return terminalService?.getSessionBuffer(sessionId) ?? ''
    })
}
