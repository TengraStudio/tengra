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
import { AuditLogService } from '@main/services/system/audit-log.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain } from 'electron';

/**
 * Registers IPC handlers for audit logging operations
 */
export function registerAuditIpc(getMainWindow: () => BrowserWindow | null, auditLogService: AuditLogService): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'audit operation');

    /**
     * Get audit logs based on filters
     */
    ipcMain.handle('audit:get-logs', createIpcHandler('audit:get-logs', async (event, filters: {
        startDate?: string;
        endDate?: string;
        category?: string;
    }) => {
        validateSender(event);
        try {
            const logs = await auditLogService.getLogs(filters);
            return logs;
        } catch (error) {
            return [];
        }
    }, { wrapResponse: true }));
}
