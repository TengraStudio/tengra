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
import { SecurityService } from '@main/services/security/security.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain } from 'electron';

export function registerSecurityIpc(
    securityService: SecurityService,
    getMainWindow: () => BrowserWindow | null
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'security operation');

    ipcMain.handle('security:reset-master-key', createIpcHandler('security:reset-master-key', async (event) => {
        validateSender(event);
        return await securityService.resetMasterKey();
    }));
}
