import { HistoryImportService } from '@main/services/external/history-import.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain } from 'electron';

export function registerHistoryIpc(historyImportService: HistoryImportService) {
    ipcMain.handle('history:import', async (_event, provider: string) => {
        try {
            return await historyImportService.importChatHistory(provider);
        } catch (error) {
            console.error('[IPC] history:import failed:', getErrorMessage(error as Error));
            return { success: false, message: getErrorMessage(error as Error) };
        }
    });

    ipcMain.handle('history:import-json', async (_event, jsonContent: string) => {
        try {
            return await historyImportService.importFromJson(jsonContent);
        } catch (error) {
            console.error('[IPC] history:import-json failed:', getErrorMessage(error as Error));
            return { success: false, message: getErrorMessage(error as Error) };
        }
    });
}
