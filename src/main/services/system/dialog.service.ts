/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { DIALOG_CHANNELS } from '@shared/constants/ipc-channels';
import { BrowserWindow, dialog, IpcMainInvokeEvent } from 'electron';

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

export class DialogService extends BaseService {
    constructor(private mainWindowProvider: () => BrowserWindow | null) {
        super('DialogService');
    }

    private createDialogFailure(error: string, messageKey: string) {
        return { success: false, error, messageKey };
    }

    @ipc(DIALOG_CHANNELS.SELECT_DIRECTORY)
    async selectDirectoryIpc() {
        return this.showOpenDialog({
            properties: ['openDirectory', 'createDirectory']
        });
    }

    @ipc(DIALOG_CHANNELS.SHOW_OPEN_DIALOG)
    async showOpenDialogIpc(_event: IpcMainInvokeEvent, options: Electron.OpenDialogOptions) {
        return this.showOpenDialog(options);
    }

    async showOpenDialog(options: Electron.OpenDialogOptions) {
        const win = this.mainWindowProvider();
        if (!win) {
            return this.createDialogFailure(
                DIALOG_ERROR_MESSAGE.WINDOW_NOT_FOUND,
                DIALOG_MESSAGE_KEY.WINDOW_NOT_FOUND
            );
        }

        const result = await dialog.showOpenDialog(win, options);

        if (result.canceled) {
            return this.createDialogFailure(
                DIALOG_ERROR_MESSAGE.CANCELED,
                DIALOG_MESSAGE_KEY.CANCELED
            );
        }

        return { success: true, filePaths: result.filePaths, path: result.filePaths[0] };
    }

    @ipc(DIALOG_CHANNELS.SAVE_FILE)
    async saveFileIpc(_event: IpcMainInvokeEvent, options: { filename: string; content: string }) {
        if (!options?.filename) {
            return this.createDialogFailure(
                DIALOG_ERROR_MESSAGE.INVALID_OPTIONS,
                DIALOG_MESSAGE_KEY.INVALID_OPTIONS
            );
        }

        const win = this.mainWindowProvider();
        if (!win) {
            return this.createDialogFailure(
                DIALOG_ERROR_MESSAGE.WINDOW_NOT_FOUND,
                DIALOG_MESSAGE_KEY.WINDOW_NOT_FOUND
            );
        }

        const result = await dialog.showSaveDialog(win, {
            defaultPath: options.filename
        });

        if (result.canceled) {
            return this.createDialogFailure(
                DIALOG_ERROR_MESSAGE.CANCELED,
                DIALOG_MESSAGE_KEY.CANCELED
            );
        }

        return { success: true, filePath: result.filePath };
    }

    @ipc(DIALOG_CHANNELS.SHOW_MESSAGE_BOX)
    async showMessageBoxIpc(_event: IpcMainInvokeEvent, options: Electron.MessageBoxOptions) {
        const win = this.mainWindowProvider();
        if (!win) {
            return this.createDialogFailure(
                DIALOG_ERROR_MESSAGE.WINDOW_NOT_FOUND,
                DIALOG_MESSAGE_KEY.WINDOW_NOT_FOUND
            );
        }
        return dialog.showMessageBox(win, options);
    }
}

