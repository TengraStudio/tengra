import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { ExportService } from '@main/services/export/export.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum content size for export (50MB) */
const MAX_CONTENT_SIZE = 50 * 1024 * 1024;
/** Maximum file path length */
const MAX_PATH_LENGTH = 1024;

/**
 * Validates export input parameters
 */
function validateExportInput(content: unknown, filePath: unknown): { content: string; filePath: string } | null {
    if (typeof content !== 'string' || typeof filePath !== 'string') {
        return null;
    }

    if (content.length > MAX_CONTENT_SIZE) {
        return null;
    }

    if (!filePath.trim() || filePath.length > MAX_PATH_LENGTH) {
        return null;
    }

    return { content, filePath: filePath.trim() };
}

/**
 * Registers IPC handlers for file export operations
 */
export function registerExportIpc(getMainWindow: () => BrowserWindow | null, exportService: ExportService): void {
    appLogger.info('ExportIPC', 'Registering export IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'export operation');

    ipcMain.handle(
        'export:markdown',
        createIpcHandler(
            'export:markdown',
            async (event: IpcMainInvokeEvent, contentRaw: unknown, filePathRaw: unknown) => {
                validateSender(event);
                const validated = validateExportInput(contentRaw, filePathRaw);
                if (!validated) {
                    throw new Error('Invalid export parameters');
                }
                return exportService.exportToMarkdown(validated.content, validated.filePath);
            }
        )
    );

    ipcMain.handle(
        'export:pdf',
        createIpcHandler(
            'export:pdf',
            async (event: IpcMainInvokeEvent, htmlContentRaw: unknown, filePathRaw: unknown) => {
                validateSender(event);
                const validated = validateExportInput(htmlContentRaw, filePathRaw);
                if (!validated) {
                    throw new Error('Invalid export parameters');
                }
                return exportService.exportToPDF(validated.content, validated.filePath);
            }
        )
    );
}
