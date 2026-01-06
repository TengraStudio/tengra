import { ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { BrowserWindow } from 'electron'

export function registerExportIpc(getWindow: () => BrowserWindow | null) {
    ipcMain.handle('files:exportChatToPdf', async (_event, _chatId: string, title: string) => {
        const window = getWindow()
        if (!window) return { success: false, error: 'No window' }

        try {
            const { filePath, canceled } = await dialog.showSaveDialog(window, {
                title: 'Export Chat to PDF',
                defaultPath: join(process.env.USERPROFILE || '', 'Documents', `${title || 'chat'}.pdf`),
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
            })

            if (canceled || !filePath) return { success: false }

            const data = await window.webContents.printToPDF({
                printBackground: true
            })

            writeFileSync(filePath, data)
            return { success: true, path: filePath }
        } catch (error: any) {
            console.error('Export PDF error:', error)
            return { success: false, error: error.message }
        }
    })
}
