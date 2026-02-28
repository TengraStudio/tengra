import { promises as fs } from 'fs';

import { appLogger } from '@main/logging/logger';
import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, dialog, ipcMain } from 'electron';

/** Maximum file content size allowed (10MB) */
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;
/** Maximum filename length */
const MAX_FILENAME_LENGTH = 255;

interface SaveFileOptions {
    content: string;
    filename: string;
}

/**
 * Validates and sanitizes save file options
 */
function parseSaveFileOptions(value: unknown): SaveFileOptions | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const raw = value as Record<string, unknown>;

    if (typeof raw.content !== 'string') {
        return null;
    }

    if (typeof raw.filename !== 'string' || !raw.filename.trim()) {
        return null;
    }

    const content = raw.content;
    const filename = raw.filename.trim().slice(0, MAX_FILENAME_LENGTH);

    // Validate content size
    if (content.length > MAX_CONTENT_SIZE) {
        return null;
    }

    // Basic filename sanitization - remove path traversal attempts
    const sanitizedFilename = filename.replace(/[/\\:*?"<>|]/g, '_');

    return { content, filename: sanitizedFilename };
}

/**
 * Registers IPC handlers for native dialog operations
 */
export function registerDialogIpc(getMainWindow: () => BrowserWindow | null): void {
    appLogger.info('DialogIPC', 'Registering dialog IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'dialog operation');

    ipcMain.handle(
        'dialog:selectDirectory',
        createSafeIpcHandler(
            'dialog:selectDirectory',
            async (event) => {
                validateSender(event);
                const win = getMainWindow();
                if (!win) {
                    return { success: false, error: 'Window not found' };
                }

                const result = await dialog.showOpenDialog(win, {
                    properties: ['openDirectory', 'createDirectory']
                });

                if (result.canceled) {
                    return { success: false, error: 'Canceled' };
                }

                return { success: true, path: result.filePaths[0] };
            },
            { success: false, error: 'Dialog operation failed' }
        )
    );

    ipcMain.handle(
        'dialog:saveFile',
        createSafeIpcHandler(
            'dialog:saveFile',
            async (event, optionsRaw: unknown) => {
                validateSender(event);
                const win = getMainWindow();
                if (!win) {
                    return { success: false, error: 'Window not found' };
                }

                const options = parseSaveFileOptions(optionsRaw);
                if (!options) {
                    return { success: false, error: 'Invalid options provided' };
                }

                const { filePath } = await dialog.showSaveDialog(win, {
                    defaultPath: options.filename
                });

                if (!filePath) {
                    return { success: false, error: 'Canceled' };
                }

                await fs.writeFile(filePath, options.content);
                appLogger.info('DialogIPC', `File saved to ${filePath}`);
                return { success: true, path: filePath };
            },
            { success: false, error: 'Save operation failed' }
        )
    );
}
