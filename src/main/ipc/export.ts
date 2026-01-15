import { appLogger } from '@main/logging/logger'
import { ExportFormat, ExportOptions, exportService } from '@main/services/data/export.service'
import { Chat } from '@shared/types/chat'
import { ipcMain } from 'electron'
import { BrowserWindow } from 'electron'

export function registerExportIpc(getWindow: () => BrowserWindow | null) {
    // Set window reference on service
    const updateWindow = () => {
        exportService.setWindow(getWindow());
    };

    // Legacy PDF export (prints current view)
    ipcMain.handle('files:exportChatToPdf', async (_event, _chatId: string, title: string) => {
        updateWindow();
        const chat: Chat = {
            id: _chatId,
            title: title || 'Untitled Chat',
            model: 'Unknown',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        return exportService.exportToPDF(chat, { title });
    });

    // Export chat to various formats
    ipcMain.handle('export:chat', async (_event, chat: Chat, options: ExportOptions) => {
        updateWindow();
        appLogger.info('ExportIpc', `Exporting chat "${chat.title}" as ${options.format}`);
        return exportService.exportChat(chat, options);
    });

    // Export chat to specific format (convenience handlers)
    ipcMain.handle('export:chatToMarkdown', async (_event, chat: Chat, options?: Partial<ExportOptions>) => {
        updateWindow();
        return exportService.exportChat(chat, { ...options, format: 'markdown' as ExportFormat });
    });

    ipcMain.handle('export:chatToHTML', async (_event, chat: Chat, options?: Partial<ExportOptions>) => {
        updateWindow();
        return exportService.exportChat(chat, { ...options, format: 'html' as ExportFormat });
    });

    ipcMain.handle('export:chatToJSON', async (_event, chat: Chat, options?: Partial<ExportOptions>) => {
        updateWindow();
        return exportService.exportChat(chat, { ...options, format: 'json' as ExportFormat });
    });

    ipcMain.handle('export:chatToText', async (_event, chat: Chat, options?: Partial<ExportOptions>) => {
        updateWindow();
        return exportService.exportChat(chat, { ...options, format: 'txt' as ExportFormat });
    });

    ipcMain.handle('export:chatToPDF', async (_event, chat: Chat, options?: Partial<ExportOptions>) => {
        updateWindow();
        return exportService.exportToPDF(chat, options);
    });

    // Get export content without saving (for clipboard)
    ipcMain.handle('export:getContent', async (_event, chat: Chat, options: ExportOptions) => {
        try {
            const content = exportService.getExportContent(chat, options);
            return { success: true, content };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    });
}
