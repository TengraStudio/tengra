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
import type { ProxyService } from '@main/services/proxy/proxy.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for embedded proxy operations
 */
export function registerProxyEmbedIpc(proxyService: ProxyService): void {
    appLogger.info('ProxyEmbedIPC', 'Registering proxy embed IPC handlers');

    /**
     * Start the embedded proxy
     */
    ipcMain.handle('proxy-embed:start', createIpcHandler('proxy-embed:start', async (_event, options?: { port?: number }) => {
        try {
            const status = await proxyService.startEmbeddedProxy(options);
            return { success: status.running, port: status.port, error: status.error };
        } catch (error) {
            appLogger.error('ProxyEmbedIPC', 'Failed to start proxy', error as Error);
            return { success: false, error: (error as Error).message };
        }
    }, { wrapResponse: true }));

    /**
     * Stop the embedded proxy
     */
    ipcMain.handle('proxy-embed:stop', createIpcHandler('proxy-embed:stop', async () => {
        try {
            await proxyService.stopEmbeddedProxy();
            return { success: true };
        } catch (error) {
            appLogger.error('ProxyEmbedIPC', 'Failed to stop proxy', error as Error);
            return { success: false, error: (error as Error).message };
        }
    }, { wrapResponse: true }));

    /**
     * Get the status of the embedded proxy
     */
    ipcMain.handle('proxy-embed:status', createIpcHandler('proxy-embed:status', async () => {
        const status = proxyService.getEmbeddedProxyStatus();
        return {
            isRunning: status.running,
            port: status.port,
            uptime: 0,
            totalRequests: 0, // Placeholder if not available in service
            activeConnections: 0 // Placeholder if not available in service
        };
    }, { wrapResponse: true }));
}
