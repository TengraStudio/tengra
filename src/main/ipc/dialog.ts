/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, dialog, ipcMain } from 'electron';
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

}
