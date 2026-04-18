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
import { DatabaseService } from '@main/services/data/database.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for database migration management
 */
export function registerMigrationIpc(databaseService: DatabaseService) {
    appLogger.info('MigrationIPC', 'Registering migration IPC handlers');

    /**
     * Get migration status
     */
    ipcMain.handle('migration:status', createSafeIpcHandler('migration:status',
        async () => {
            return databaseService.getMigrationStatus();
        }, null
    ));

    /**
     * Note: Actual migration/rollback operations are handled automatically
     * during database initialization. These endpoints are for status checking only.
     * Direct migration control can be added if needed for admin/debugging purposes.
     */
}
