import { spawn } from 'child_process'

import { appLogger } from '@main/logging/logger'
import { getErrorMessage } from '@shared/utils/error.util'
import { BrowserWindow, ipcMain, shell } from 'electron'

export function registerWindowIpc(getMainWindow: () => BrowserWindow | null) {
    ipcMain.on('window:minimize', () => getMainWindow()?.minimize())
    ipcMain.on('window:maximize', () => {
        const win = getMainWindow()
        if (!win) { return }
        if (win.isMaximized()) {
            win.unmaximize()
        } else {
            win.maximize()
        }
    })
    ipcMain.on('window:close', () => getMainWindow()?.close())
    ipcMain.on('window:toggle-compact', (_event, enabled) => {
        const win = getMainWindow()
        if (!win) { return }
        if (enabled) {
            win.setSize(400, 600)
        } else {
            win.setSize(1200, 800)
        }
    })
    ipcMain.on('window:resize', (_event, resolution: string) => {
        const win = getMainWindow()
        if (!win) { return }
        const [width, height] = resolution.split('x').map(Number)
        if (width && height) {
            win.setSize(width, height)
            win.center()
        }
    })

    ipcMain.on('window:toggle-fullscreen', () => {
        const win = getMainWindow()
        if (!win) { return }
        win.setFullScreen(!win.isFullScreen())
    })

    ipcMain.handle('shell:openExternal', async (_event, url) => {
        appLogger.info('WindowIPC', `shell:openExternal handle called with URL: ${url}`)

        // Handle safe-file:// protocol for local images
        if (url.startsWith('safe-file://')) {
            const filePath = url.replace('safe-file://', '')
            appLogger.info('WindowIPC', `Opening local file path: ${filePath}`)
            try {
                const error = await shell.openPath(decodeURIComponent(filePath))
                if (error) {
                    appLogger.error('WindowIPC', `shell.openPath failed: ${error}`)
                    return { success: false, error }
                }
                return { success: true }
            } catch (e) {
                appLogger.error('WindowIPC', `Safe file open catch: ${e}`)
                return { success: false, error: String(e) }
            }
        }

        try {
            const parsed = new URL(url)
            const urlString = parsed.toString()

            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                appLogger.info('WindowIPC', `Opening URL with shell.openExternal: ${urlString}`)
                try {
                    await shell.openExternal(urlString)
                    return { success: true }
                } catch (e) {
                    appLogger.error('WindowIPC', `shell.openExternal failed: ${getErrorMessage(e as Error)}`)
                    return { success: false, error: String(e) }
                }
            } else {
                return { success: false, error: 'Forbidden protocol' }
            }
        } catch (e) {
            appLogger.error('WindowIPC', `openExternal catch: ${e}`)
            return { success: false, error: String(e) }
        }
    })

    ipcMain.handle('shell:openTerminal', async (_event, command) => {
        if (process.platform === 'win32') {
            // Sanitize command - remove shell metacharacters to prevent injection
            // Block: pipes, redirects, semicolons, backticks, $(), newlines
            const sanitized = command
                .replace(/[&|><;`$(){}[\]\n\r]/g, '')
                .replace(/\$\([^)]*\)/g, '') // Remove $(...) substitution
                .trim()

            if (!sanitized) {
                appLogger.warn('WindowIPC', 'Command was empty after sanitization')
                return false
            }

            spawn('cmd', ['/k', sanitized], { shell: false })
        } else {
            // Basic fallback for Linux/Mac
            appLogger.warn('WindowIPC', `Open terminal not fully supported on non-windows yet: ${command}`)
        }
        return true
    })

    ipcMain.handle('shell:runCommand', async (_event, command, args, cwd) => {
        return new Promise((resolve) => {
            appLogger.info('WindowIPC', `Running command: ${command} ${args.join(' ')}`)
            const child = spawn(command, args, {
                cwd: cwd ?? process.cwd(),
                shell: false // Disable shell for security
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
                resolve({ stdout, stderr, code: code ?? 0 })
            })

            child.on('error', (err: Error) => {
                resolve({ stdout, stderr, code: 1, error: err.message })
            })
        })
    })
}
