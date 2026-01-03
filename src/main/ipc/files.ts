import { BrowserWindow, dialog, ipcMain } from 'electron'
import { resolve } from 'path'
import { FileSystemService } from '../services/filesystem.service'

export function registerFilesIpc(
    getMainWindow: () => BrowserWindow | null,
    fileSystemService: FileSystemService,
    allowedRoots: Set<string>
) {
    ipcMain.handle('files:selectDirectory', async () => {
        const win = getMainWindow()
        if (!win) return { success: false }
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory']
        })
        if (result.canceled) return { success: false }
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
}
