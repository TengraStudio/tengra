import { ExportService } from '@main/services/export/export.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

export function registerExportIpc(exportService: ExportService) {
    ipcMain.handle('export:markdown', createIpcHandler('export:markdown', async (_event, content: string, filePath: string) => {
        return exportService.exportToMarkdown(content, filePath);
    }));

    ipcMain.handle('export:pdf', createIpcHandler('export:pdf', async (_event, htmlContent: string, filePath: string) => {
        return exportService.exportToPDF(htmlContent, filePath);
    }));
}
