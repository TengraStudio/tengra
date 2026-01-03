import { ipcMain } from 'electron'
import { HistoryImportService } from '../services/history-import.service'

export function registerHistoryIpc(historyImportService: HistoryImportService) {
    ipcMain.handle('history:import', async (_event, provider: string) => {
        return await historyImportService.importChatHistory(provider)
    })

    ipcMain.handle('history:import-json', async (_event, jsonContent: string) => {
        return await historyImportService.importFromJson(jsonContent)
    })
}
