import { auditGetLogsOptionsSchema } from '@main/ipc/validation';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';
import { z } from 'zod';

/**
 * Registers IPC handlers for audit log operations.
 * Handles retrieving and clearing audit logs.
 * @param auditLogService - Service for interacting with audit logs
 */
export function registerAuditIpc(auditLogService: AuditLogService) {
    /**
     * Retrieves audit logs with optional filtering.
     * @param options - Optional filtering criteria
     * @param options.category - Filter by audit category
     * @param options.startDate - Filter logs after this timestamp (ms)
     * @param options.endDate - Filter logs before this timestamp (ms)
     * @param options.limit - Maximum number of logs to return
     */
    ipcMain.handle('audit:getLogs', createValidatedIpcHandler('audit:getLogs', async (_event, options?: z.infer<typeof auditGetLogsOptionsSchema>) => {
        return await auditLogService.getLogs(options);
    }, {
        argsSchema: z.tuple([auditGetLogsOptionsSchema]),
        schemaVersion: 1
    }));

    /** Clears all audit logs. */
    ipcMain.handle('audit:clearLogs', createValidatedIpcHandler('audit:clearLogs', async () => {
        await auditLogService.clearLogs();
        return { success: true };
    }, { schemaVersion: 1 }));
}
