/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for metrics and analytics
 */
export function registerMetricsIpc(): void {
    /**
     * Get application metrics
     */
    ipcMain.handle('metrics:get', createIpcHandler('metrics:get', async () => {
        return {
            cpu: process.getCPUUsage(),
            memory: process.getProcessMemoryInfo(),
            uptime: process.uptime()
        };
    }, { wrapResponse: true }));

    /**
     * Record a custom metric
     */
    ipcMain.handle('metrics:record', createIpcHandler('metrics:record', async (event, name: string, value: any) => {
        // Implementation placeholder for analytics
        return { success: true };
    }, { wrapResponse: true }));
}
