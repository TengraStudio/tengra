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
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, clipboard, ipcMain } from 'electron';

export function registerClipboardIpc(getMainWindow: () => BrowserWindow | null): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'clipboard operation');

    ipcMain.handle('clipboard:writeText', createIpcHandler('clipboard:writeText', async (event, text: string) => {
        validateSender(event);
        clipboard.writeText(text);
    }));

    ipcMain.handle('clipboard:readText', createIpcHandler('clipboard:readText', async (event) => {
        validateSender(event);
        return clipboard.readText();
    }));
}
