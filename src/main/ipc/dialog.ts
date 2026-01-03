import { BrowserWindow, dialog, ipcMain } from 'electron'

export function registerDialogIpc(getMainWindow: () => BrowserWindow | null) {
    ipcMain.handle('dialog:selectDirectory', async () => {
        const win = getMainWindow()
        if (!win) return { success: false, error: 'Window not found' }
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
        if (!win) return { success: false, error: 'Window not found' }
        const { filePath } = await dialog.showSaveDialog(win, {
            defaultPath: filename
        })
        if (filePath) {
            require('fs').writeFileSync(filePath, content)
            return { success: true, path: filePath }
        }
        return { success: false, error: 'Canceled' }
    })
}
