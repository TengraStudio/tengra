import { BrowserWindow, ipcMain, shell } from 'electron'
import { appLogger } from '../logging/logger'
import { exec } from 'child_process'

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

    ipcMain.handle('shell:openExternal', async (_event, url) => {
        console.log('[MAIN] shell:openExternal handle called with URL:', url)
        appLogger.info(`shell:openExternal handle called with URL: ${url}`, { source: 'window-ipc' })

        // Handle safe-file:// protocol for local images
        if (url.startsWith('safe-file://')) {
            const filePath = url.replace('safe-file://', '')
            console.log('[MAIN] Opening local file path:', filePath)
            try {
                const error = await shell.openPath(decodeURIComponent(filePath))
                if (error) {
                    console.error('[MAIN] shell.openPath failed:', error)
                    return { success: false, error }
                }
                return { success: true }
            } catch (e) {
                console.error('[MAIN] Safe file open catch:', e)
                return { success: false, error: String(e) }
            }
        }

        try {
            const parsed = new URL(url)
            const urlString = parsed.toString()

            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                console.log('[MAIN] Opening URL with shell.openExternal...')
                try {
                    await shell.openExternal(urlString)
                    return { success: true }
                } catch (e) {
                    console.error('[MAIN] shell.openExternal failed:', e)
                    if (process.platform === 'win32') {
                        console.log('[MAIN] Falling back to PowerShell/CMD for Windows...')
                        exec(`powershell -Command "Start-Process '${urlString}'"`)
                        exec(`start "" "${urlString}"`)
                        return { success: true, warning: 'Fallback triggered' }
                    }
                    return { success: false, error: String(e) }
                }
            } else {
                return { success: false, error: 'Forbidden protocol' }
            }
        } catch (e) {
            console.error('[MAIN] openExternal catch:', e)
            return { success: false, error: String(e) }
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

    ipcMain.handle('shell:runCommand', async (_event, command, args, cwd) => {
        const { spawn } = require('child_process')
        return new Promise((resolve) => {
            const child = spawn(command, args, {
                cwd: cwd || process.cwd(),
                shell: true
            })

            let stdout = ''
            let stderr = ''

            child.stdout.on('data', (data: Buffer) => {
                stdout += data.toString()
            })

            child.stderr.on('data', (data: Buffer) => {
                stderr += data.toString()
            })

            child.on('close', (code: number | null) => {
                resolve({ stdout, stderr, code: code || 0 })
            })

            child.on('error', (err: Error) => {
                resolve({ stdout, stderr, code: 1, error: err.message })
            })
        })
    })
}
