import { ipcMain } from 'electron'
import { ProcessService } from '../services/process.service'

export const registerProcessIpc = (processService: ProcessService) => {
    ipcMain.handle('process:spawn', (_, command: string, args: string[], cwd: string) => {
        return processService.spawn(command, args, cwd)
    })

    ipcMain.handle('process:kill', (_, id: string) => {
        return processService.kill(id)
    })

    ipcMain.handle('process:list', () => {
        return processService.getRunningTasks()
    })

    ipcMain.handle('process:scan-scripts', (_, rootPath: string) => {
        return processService.scanScripts(rootPath)
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
    processService.on('data', ({ id, data }) => {
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('process:data', { id, data })
        })
    })

    processService.on('exit', ({ id, code }) => {
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('process:exit', { id, code })
        })
    })
}
