import { promises as fs } from 'fs';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, dialog, ipcMain } from 'electron';

/** Maximum file content size allowed (10MB) */
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;
/** Maximum filename length */
const MAX_FILENAME_LENGTH = 255;
const DIALOG_MESSAGE_KEY = {
    WINDOW_NOT_FOUND: 'mainProcess.dialog.windowNotFound',
    CANCELED: 'mainProcess.dialog.canceled',
    OPERATION_FAILED: 'mainProcess.dialog.operationFailed',
    INVALID_OPTIONS: 'mainProcess.dialog.invalidOptionsProvided',
    SAVE_FAILED: 'mainProcess.dialog.saveOperationFailed'
} as const;
const DIALOG_ERROR_MESSAGE = {
    WINDOW_NOT_FOUND: 'Window not found',
    CANCELED: 'Canceled',
    OPERATION_FAILED: 'Dialog operation failed',
    INVALID_OPTIONS: 'Invalid options provided',
    SAVE_FAILED: 'Save operation failed'
} as const;

function createDialogFailure(error: string, messageKey: string): {
    success: false;
    error: string;
    messageKey: string;
} {
    return { success: false, error, messageKey };
}

interface SaveFileOptions {
    content: string;
    filename: string;
}

/**
 * Validates and sanitizes save file options
 */
function parseSaveFileOptions(value: RuntimeValue): SaveFileOptions | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const raw = value as Record<string, RuntimeValue>;

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
    appLogger.debug('DialogIPC', 'Registering dialog IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'dialog operation');

    ipcMain.handle(
        'dialog:selectDirectory',
        createSafeIpcHandler(
            'dialog:selectDirectory',
            async (event) => {
                validateSender(event);
                const win = getMainWindow();
                if (!win) {
                    return createDialogFailure(
                        DIALOG_ERROR_MESSAGE.WINDOW_NOT_FOUND,
                        DIALOG_MESSAGE_KEY.WINDOW_NOT_FOUND
                    );
                }

                const result = await dialog.showOpenDialog(win, {
                    properties: ['openDirectory', 'createDirectory']
                });

                if (result.canceled) {
                    return createDialogFailure(
                        DIALOG_ERROR_MESSAGE.CANCELED,
                        DIALOG_MESSAGE_KEY.CANCELED
                    );
                }

                return { success: true, path: result.filePaths[0] };
            },
            createDialogFailure(
                DIALOG_ERROR_MESSAGE.OPERATION_FAILED,
                DIALOG_MESSAGE_KEY.OPERATION_FAILED
            )
        )
    );

    ipcMain.handle(
        'dialog:saveFile',
        createSafeIpcHandler(
            'dialog:saveFile',
            async (event, optionsRaw: RuntimeValue) => {
                validateSender(event);
                const win = getMainWindow();
                if (!win) {
                    return createDialogFailure(
                        DIALOG_ERROR_MESSAGE.WINDOW_NOT_FOUND,
                        DIALOG_MESSAGE_KEY.WINDOW_NOT_FOUND
                    );
                }

                const options = parseSaveFileOptions(optionsRaw);
                if (!options) {
                    return createDialogFailure(
                        DIALOG_ERROR_MESSAGE.INVALID_OPTIONS,
                        DIALOG_MESSAGE_KEY.INVALID_OPTIONS
                    );
                }

                const { filePath } = await dialog.showSaveDialog(win, {
                    defaultPath: options.filename
                });

                if (!filePath) {
                    return createDialogFailure(
                        DIALOG_ERROR_MESSAGE.CANCELED,
                        DIALOG_MESSAGE_KEY.CANCELED
                    );
                }

                await fs.writeFile(filePath, options.content);
                appLogger.debug('DialogIPC', `File saved to ${filePath}`);
                return { success: true, path: filePath };
            },
            createDialogFailure(
                DIALOG_ERROR_MESSAGE.SAVE_FAILED,
                DIALOG_MESSAGE_KEY.SAVE_FAILED
            )
        )
    );
}
