import { BrowserWindow, ipcMain, shell } from 'electron'

export function registerWindowIpc(getMainWindow: () => BrowserWindow | null) {
    ipcMain.on('window:minimize', () => getMainWindow()?.minimize())
    ipcMain.on('window:maximize', () => {
        const win = getMainWindow()
        if (!win) return
        if (win.isMaximized()) {
            win.unmaximize()
        } else {
            win.maximize()
        }
    })
    ipcMain.on('window:close', () => getMainWindow()?.close())
    ipcMain.on('window:toggle-compact', (_event, enabled) => {
        const win = getMainWindow()
        if (!win) return
        if (enabled) {
            win.setSize(400, 600)
        } else {
            win.setSize(1200, 800)
        }
    })
    ipcMain.on('window:resize', (_event, resolution: string) => {
        const win = getMainWindow()
        if (!win) return
        const [width, height] = resolution.split('x').map(Number)
        if (width && height) {
            win.setSize(width, height)
            win.center()
        }
    })

    ipcMain.on('shell:openExternal', (_event, url) => {
        try {
            const parsed = new URL(url)
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                shell.openExternal(parsed.toString())
            } else {
                console.warn('Blocked external open for non-http/https URL:', url)
            }
        } catch (e) {
            console.warn('Invalid URL blocked:', url)
        }
    })

    ipcMain.handle('shell:openTerminal', async (_event, command) => {
        const { spawn } = require('child_process')
        if (process.platform === 'win32') {
            spawn('start', ['cmd', '/k', command], { shell: true })
        } else {
            // Basic fallback for Linux/Mac
            console.log('Open terminal not fully supported on non-windows yet:', command)
        }
        return true
    })
}
