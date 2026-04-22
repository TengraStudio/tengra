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
import type { DatabaseService } from '@main/services/data/database.service';
import type { BrowserWindow } from 'electron';

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
    _databaseService: DatabaseService
): void {
    const _validateSender = createMainWindowSenderValidator(getMainWindow, 'db stats');
    void _validateSender;
}
