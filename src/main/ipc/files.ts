import { resolve } from 'path'

import { FileSystemService } from '@main/services/data/filesystem.service'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'

export function registerFilesIpc(
    getMainWindow: () => BrowserWindow | null,
    fileSystemService: FileSystemService,
    allowedRoots: Set<string>
) {
    ipcMain.handle('files:selectDirectory', async () => {
        const win = getMainWindow()
        if (!win) {return { success: false }}
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory']
        })
        if (result.canceled) {return { success: false }}
        const chosenPath = result.filePaths[0]
        if (chosenPath) {
            allowedRoots.add(resolve(chosenPath))
            fileSystemService.updateAllowedRoots(Array.from(allowedRoots))
        }
        return { success: true, path: chosenPath }
    })

    ipcMain.handle('files:listDirectory', async (_event, dirPath: string) => {
        return await fileSystemService.listDirectory(dirPath)
    })

    ipcMain.handle('files:readFile', async (_event, filePath: string) => {
        return await fileSystemService.readFile(filePath)
    })

    ipcMain.handle('files:readImage', async (_event, filePath: string) => {
        return await fileSystemService.readImage(filePath)
    })

    ipcMain.handle('files:writeFile', async (_event, filePath: string, content: string) => {
        return await fileSystemService.writeFile(filePath, content)
    })

    ipcMain.handle('files:createDirectory', async (_event, dirPath: string) => {
        return await fileSystemService.createDirectory(dirPath)
    })

    ipcMain.handle('files:deleteFile', async (_event, filePath: string) => {
        return await fileSystemService.deleteFile(filePath)
    })

    ipcMain.handle('files:deleteDirectory', async (_event, dirPath: string) => {
        return await fileSystemService.deleteDirectory(dirPath)
    })

    ipcMain.handle('files:renamePath', async (_event, oldPath: string, newPath: string) => {
        return await fileSystemService.moveFile(oldPath, newPath)
    })

    ipcMain.handle('files:searchFiles', async (_event, rootPath: string, pattern: string) => {
        return await fileSystemService.searchFiles(rootPath, pattern)
    })

    ipcMain.handle('files:searchFilesStream', async (_event, rootPath: string, pattern: string, jobId: string) => {
        const win = getMainWindow()
        if (!win) {return { success: false }}

        // Run search in background (don't await fully to blocking return, but here we invoke so we kind of do)
        // Actually for a stream we should probably just return 'started' and emit events
        // But handling the promise ensures strictly sequential if needed.
        // Better: fire and forget the search, let generic events handle results.

        fileSystemService.searchFilesStream(rootPath, pattern, (filePath) => {
            if (!win.isDestroyed()) {
                win.webContents.send(`files:search-result:${jobId}`, filePath)
            }
        }).then(() => {
            if (!win.isDestroyed()) {
                win.webContents.send(`files:search-complete:${jobId}`)
            }
        })

        return { success: true, jobId }
    })

    ipcMain.handle('app:getUserDataPath', () => {
        return app.getPath('userData')
    })
}
