/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import type { DatabaseService } from '@main/services/data/database.service';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for database migration management
 */
export function registerMigrationIpc(databaseService: DatabaseService) {
    appLogger.info('MigrationIPC', 'Registering migration IPC handlers');

    /**
     * Get migration status
     */
    ipcMain.handle('migration:status', async () => {
        try {
            return await databaseService.getMigrationStatus();
        } catch (error) {
            appLogger.error('MigrationIPC', `Failed to get status: ${error}`);
            return null;
        }
    });

    /**
     * Get migration history
     */
    ipcMain.handle('migration:history', async () => {
        try {
            return await databaseService.getMigrationHistory();
        } catch (error) {
            appLogger.error('MigrationIPC', `Failed to get history: ${error}`);
            return [];
        }
    });
}
