import { appLogger } from '@main/logging/logger';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { IpcValue } from '@shared/types/common';
import { BrowserWindow, ipcMain } from 'electron';

/**
 * Registers IPC handlers for proxy operations including quota retrieval, authentication, and model listing.
 * @param proxyService - The proxy service instance for handling proxy operations
 * @param _processManager - Optional proxy process manager (reserved for future use)
 * @param _authService - Optional auth service (reserved for future use)
 */
export function registerProxyIpc(
    proxyService: ProxyService,
    _processManager?: ProxyProcessManager,
    _authService?: AuthService,
    getMainWindow?: () => BrowserWindow | null,
    eventBus?: EventBusService
) {
    // Register batchable quota handlers for efficient batch loading
    registerBatchableHandler('getQuota', async (): Promise<IpcValue> => {
        return (await proxyService.getQuota()) as unknown as IpcValue;
    });

    registerBatchableHandler('getCopilotQuota', async (): Promise<IpcValue> => {
        return (await proxyService.getCopilotQuota()) as unknown as IpcValue;
    });

    registerBatchableHandler('getCodexUsage', async (): Promise<IpcValue> => {
        return (await proxyService.getCodexUsage()) as unknown as IpcValue;
    });

    registerBatchableHandler('getClaudeQuota', async (): Promise<IpcValue> => {
        return (await proxyService.getClaudeQuota()) as unknown as IpcValue;
    });

    ipcMain.handle('proxy:antigravityLogin', async () => {
        return await proxyService.getAntigravityAuthUrl();
    });

    ipcMain.handle('proxy:claudeLogin', async () => {
        // Try to get OAuth URL (same as anthropicLogin)
        // This will open the browser for OAuth flow
        return await proxyService.getAnthropicAuthUrl();
    });



    ipcMain.handle('proxy:saveClaudeSession', async (_event, sessionKey: string, accountId?: string) => {
        try {
            return await proxyService.quotaService.saveClaudeSession(sessionKey, accountId);
        } catch (error) {
            appLogger.error('proxy', 'Failed to save manual session:', error as Error);
            return { success: false, error: (error as Error).message };
        }
    });



    ipcMain.handle('proxy:anthropicLogin', async () => {
        // Legacy OAuth flow - still available but doesn't capture sessionKey
        return await proxyService.getAnthropicAuthUrl();
    });

    ipcMain.handle('proxy:codexLogin', async () => {
        return await proxyService.getCodexAuthUrl();
    });

    ipcMain.handle('proxy:getModels', async () => {
        return await proxyService.getModels();
    });

    ipcMain.handle('proxy:getQuota', async () => {
        return await proxyService.getQuota();
    });

    ipcMain.handle('proxy:getCopilotQuota', async () => {
        return await proxyService.getCopilotQuota();
    });

    ipcMain.handle('proxy:getCodexUsage', async () => {
        return await proxyService.getCodexUsage();
    });

    ipcMain.handle('proxy:getClaudeQuota', async () => {
        return await proxyService.getClaudeQuota();
    });

    ipcMain.handle('proxy:get-rate-limit-metrics', async () => {
        return proxyService.getProviderRateLimitMetrics();
    });

    ipcMain.handle('proxy:get-rate-limit-config', async () => {
        return proxyService.getProviderRateLimitConfig();
    });

    ipcMain.handle('proxy:set-rate-limit-config', async (_event, provider: string, config: {
        windowMs?: number;
        maxRequests?: number;
        warningThreshold?: number;
        maxQueueSize?: number;
        allowPremiumBypass?: boolean;
    }) => {
        return proxyService.setProviderRateLimitConfig(provider, config);
    });

    ipcMain.handle('proxy:deleteAuthFile', async () => {
        // Legacy file-based auth is now handled via HTTP API
        return { success: true };
    });

    // Sync auth files - now handled automatically by HTTP auth API
    ipcMain.handle('proxy:syncAuthFiles', async () => {
        // Auth sync is now automatic via HTTP API - no manual sync needed
        return { success: true };
    });

    ipcMain.handle('proxy:downloadAuthFile', async () => {
        // Legacy file-based auth is now handled via HTTP API
        return { success: false, error: 'Not supported' };
    });

    if (eventBus && getMainWindow) {
        eventBus.onCustom('proxy:rate-limit-warning', (payload) => {
            const win = getMainWindow();
            if (win && !win.isDestroyed()) {
                win.webContents.send('proxy:rate-limit-warning', payload);
            }
        });
    }
}
