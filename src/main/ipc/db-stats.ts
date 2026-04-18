/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Database Stats IPC Handler
 * Returns detailed database statistics for the dashboard UI.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { DatabaseService } from '@main/services/data/database.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Detailed database statistics for the size dashboard. */
export interface DatabaseSizeStats {
    dbSize: number;
    chatCount: number;
    messageCount: number;
    workspaceCount: number;
    folderCount: number;
    promptCount: number;
}

/**
 * Registers IPC handler for detailed database statistics.
 * @param getMainWindow - Getter for the main BrowserWindow.
 * @param databaseService - The database service instance.
 */
export function registerDbStatsIpc(
    getMainWindow: () => BrowserWindow | null,
    databaseService: DatabaseService
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'db stats');

    ipcMain.handle('db:size-stats', createIpcHandler(
        'db:size-stats',
        async (event: IpcMainInvokeEvent): Promise<DatabaseSizeStats> => {
            validateSender(event);
            const stats = await databaseService.getStats();
            const workspaces = await databaseService.workspaces.getWorkspaces();
            const folders = await databaseService.system.getFolders();
            const prompts = await databaseService.system.getPrompts();

            return {
                dbSize: stats.dbSize,
                chatCount: stats.chatCount,
                messageCount: stats.messageCount,
                workspaceCount: workspaces.length,
                folderCount: folders.length,
                promptCount: prompts.length,
            };
        }
    ));
}
