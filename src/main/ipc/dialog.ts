import { promises as fs } from 'fs'

import { BrowserWindow, dialog, ipcMain } from 'electron'

export function registerDialogIpc(getMainWindow: () => BrowserWindow | null) {
    ipcMain.handle('dialog:selectDirectory', async () => {
        const win = getMainWindow()
        if (!win) { return { success: false, error: 'Window not found' } }
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory', 'createDirectory']
        })
        if (result.canceled) {
            return { success: false, error: 'Canceled' }
        }
        return { success: true, path: result.filePaths[0] }
    })

    ipcMain.handle('dialog:saveFile', async (_event, { content, filename }) => {
        const win = getMainWindow()
        if (!win) { return { success: false, error: 'Window not found' } }
        const { filePath } = await dialog.showSaveDialog(win, {
            defaultPath: filename
        })
        if (filePath) {
            try {
                await fs.writeFile(filePath, content)
                return { success: true, path: filePath }
            } catch (error) {
                return { success: false, error: (error as Error).message }
            }
        }
        return { success: false, error: 'Canceled' }
    })
}
