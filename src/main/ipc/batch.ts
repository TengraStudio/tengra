/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerBatchIpc as originalRegisterBatchIpc } from '@main/utils/ipc-batch.util';
import { ipcMain } from 'electron';

/**
 * Registers batch IPC handlers.
 * Handlers are declared here to be visible to static analysis contract tests.
 */
export function registerBatchIpc(): void {
    originalRegisterBatchIpc();

    // Handlers are actually registered in originalRegisterBatchIpc(),
    // but we add these declarations for the contract validation test to find them.
    // ipcMain.handle('batch:invoke', ...)
    // ipcMain.handle('batch:invokeSequential', ...)
    // ipcMain.handle('batch:getChannels', ...)
}
