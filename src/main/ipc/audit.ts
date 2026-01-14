import { AuditLogService } from '@main/services/audit-log.service'
import { createIpcHandler } from '@main/utils/ipc-wrapper.util'
import { ipcMain } from 'electron'

export function registerAuditIpc(auditLogService: AuditLogService) {
    ipcMain.handle('audit:getLogs', createIpcHandler('audit:getLogs', async (_event, options?: {
        category?: 'security' | 'settings' | 'authentication' | 'data' | 'system'
        startDate?: number
        endDate?: number
        limit?: number
    }) => {
        return await auditLogService.getLogs(options)
    }))

    ipcMain.handle('audit:clearLogs', createIpcHandler('audit:clearLogs', async () => {
        await auditLogService.clearLogs()
        return { success: true }
    }))
}
