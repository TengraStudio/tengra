import { ipcMain } from 'electron'
import { AuditLogService } from '../services/audit-log.service'
import { createIpcHandler } from '../utils/ipc-wrapper.util'

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
