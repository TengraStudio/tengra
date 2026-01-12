import { ipcMain } from 'electron'
import { DatabaseService } from '../services/data/database.service'
import { createSafeIpcHandler } from '../utils/ipc-wrapper.util'

/**
 * Registers IPC handlers for database migration management
 */
export function registerMigrationIpc(databaseService: DatabaseService) {
    /**
     * Get migration status
     */
    ipcMain.handle('migration:status', createSafeIpcHandler('migration:status', async () => {
        return databaseService.getMigrationStatus()
    }, []))

    /**
     * Note: Actual migration/rollback operations are handled automatically
     * during database initialization. These endpoints are for status checking only.
     * Direct migration control can be added if needed for admin/debugging purposes.
     */
}
