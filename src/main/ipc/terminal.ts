/**
 * Terminal IPC - Exposes terminal service to renderer process
 */
import { ipcMain, BrowserWindow } from 'electron'
import { TerminalService } from '../services/terminal.service'

let terminalService: TerminalService | null = null

export function registerTerminalIpc(browserWindow: BrowserWindow) {
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
    ipcMain.handle('terminal:create', (_event, options: {
        id: string
        shell?: string
        cwd?: string
        cols?: number
        rows?: number
    }) => {
        if (!terminalService) return { success: false, error: 'Service not initialized' }

        const success = terminalService.createSession({
            ...options,
            onData: (data: string) => {
                browserWindow.webContents.send('terminal:data', { id: options.id, data })
            },
            onExit: (code: number) => {
                browserWindow.webContents.send('terminal:exit', { id: options.id, code })
            }
        })

        return { success }
    })

    // Write to session
    ipcMain.handle('terminal:write', (_event, sessionId: string, data: string) => {
        return terminalService?.write(sessionId, data) ?? false
    })

    // Resize session
    ipcMain.handle('terminal:resize', (_event, sessionId: string, cols: number, rows: number) => {
        return terminalService?.resize(sessionId, cols, rows) ?? false
    })

    // Kill session
    ipcMain.handle('terminal:kill', (_event, sessionId: string) => {
        return terminalService?.kill(sessionId) ?? false
    })

    // Get active sessions
    ipcMain.handle('terminal:getSessions', () => {
        return terminalService?.getActiveSessions() ?? []
    })

    // Cleanup on window close
    browserWindow.on('closed', () => {
        terminalService?.dispose()
        terminalService = null
    })
}
