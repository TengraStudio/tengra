import { ipcMain } from 'electron'
import { ProcessService } from '../services/process.service'
import { getErrorMessage } from '../../shared/utils/error.util'

export const registerProcessIpc = (processService: ProcessService) => {
    ipcMain.handle('process:spawn', async (_, command: string, args: string[], cwd: string) => {
        try {
            return processService.spawn(command, args, cwd)
        } catch (error) {
            console.error('[IPC] process:spawn failed:', getErrorMessage(error as Error))
            return null
        }
    })

    ipcMain.handle('process:kill', async (_, id: string) => {
        try {
            return processService.kill(id)
        } catch (error) {
            console.error('[IPC] process:kill failed:', getErrorMessage(error as Error))
            return false
        }
    })

    ipcMain.handle('process:list', async () => {
        try {
            return processService.getRunningTasks()
        } catch (error) {
            console.error('[IPC] process:list failed:', getErrorMessage(error as Error))
            return []
        }
    })

    ipcMain.handle('process:scan-scripts', async (_, rootPath: string) => {
        try {
            return await processService.scanScripts(rootPath)
        } catch (error) {
            console.error('[IPC] process:scan-scripts failed:', getErrorMessage(error as Error))
            return {}
        }
    })

    ipcMain.handle('process:resize', (_, id: string, cols: number, rows: number) => {
        processService.resize(id, cols, rows)
    })

    ipcMain.handle('process:write', (_, id: string, data: string) => {
        processService.write(id, data)
    })

    // Bridge events
    // We need a way to send 'data' and 'exit' events to the renderer.
    // The renderer should listen to 'process:output:{id}' or similar.
    // Since id is dynamic, we can send a global 'process:event' or specific if we passed webContents.
    // For now, let's assume we send to the sender of the spawn command - but strictly simpler:
    // We will emit on the main window or all windows.
    // Actually, ProcessService emits events. We can hook them up here.

    // Note: This requires holding a reference to the window or using `event.sender` from the spawn call.
    // However, since spawn is a handle (async), we return the ID. 
    // We'll set up a global listener on processService once and broadcast.
    /*
    processService.on('data', ({ id, data }) => {
        // Broadcast to all windows? Or manageable via specific channel?
        // Using `webContents.getAllWebContents().forEach(wc => wc.send('process:data', { id, data }))`
        // requires 'electron' import.
    })
    */
}

import { BrowserWindow } from 'electron'

export const setupProcessEvents = (processService: ProcessService) => {
    const buffers = new Map<string, string>()
    let timer: NodeJS.Timeout | null = null

    const flush = () => {
        if (buffers.size === 0) return

        BrowserWindow.getAllWindows().forEach(win => {
            if (win.isDestroyed()) return
            buffers.forEach((data, id) => {
                win.webContents.send('process:data', { id, data })
            })
        })
        buffers.clear()
        timer = null
    }

    processService.on('data', ({ id, data }) => {
        const current = buffers.get(id) || ''
        buffers.set(id, current + data)

        if (!timer) {
            timer = setTimeout(flush, 100)
        }
    })

    processService.on('exit', ({ id, code }) => {
        // Flush immediately on exit
        flush()
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('process:exit', { id, code })
            }
        })
    })
}
