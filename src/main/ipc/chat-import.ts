/**
 * Chat Import IPC Handlers
 * Exposes chat import functionality for external AI tool formats.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { ChatImportResult, ChatImportService, ImportFormat } from '@main/services/data/chat-import.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Registers IPC handlers for chat import operations.
 * @param getMainWindow - Getter for the main BrowserWindow.
 * @param chatImportService - The chat import service instance.
 */
export function registerChatImportIpc(
    getMainWindow: () => BrowserWindow | null,
    chatImportService: ChatImportService
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'chat import');

    ipcMain.handle('chat:import', createIpcHandler(
        'chat:import',
        async (
            event: IpcMainInvokeEvent,
            filePath: string,
            format: ImportFormat
        ): Promise<ChatImportResult> => {
            validateSender(event);
            if (!filePath || typeof filePath !== 'string') {
                throw new Error('filePath must be a non-empty string');
            }
            const validFormats: ImportFormat[] = ['chatgpt', 'claude', 'tengra-json'];
            if (!validFormats.includes(format)) {
                throw new Error(`Invalid format: ${format}`);
            }
            return chatImportService.importFromFile(filePath, format);
        }
    ));
}
