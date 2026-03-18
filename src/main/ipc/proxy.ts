import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { createSafeIpcHandler as baseCreateSafeIpcHandler,createValidatedIpcHandler as baseCreateValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { IpcValue } from '@shared/types/common';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

import { providerNameSchema, proxyAccountIdSchema, rateLimitConfigSchema,sessionKeySchema } from './validation';

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
    const validateSender = createMainWindowSenderValidator(getMainWindow ?? (() => null), 'proxy operation');
    const createSafeIpcHandler = <T = IpcValue, Args extends RuntimeValue[] = RuntimeValue[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
        defaultValue: T
    ) => baseCreateSafeIpcHandler<T, Args>(channel, async (event, ...args) => {
        validateSender(event);
        return await handler(event, ...args);
    }, defaultValue);
    const createValidatedIpcHandler = <T = IpcValue, Args extends RuntimeValue[] = RuntimeValue[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
        options: Parameters<typeof baseCreateValidatedIpcHandler<T, Args>>[2]
    ) => baseCreateValidatedIpcHandler<T, Args>(channel, async (event, ...args) => {
        validateSender(event);
        return await handler(event, ...args);
    }, options);
    const registerSecureBatchableHandler = (
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: IpcValue[]) => Promise<IpcValue>
    ) => {
        registerBatchableHandler(channel, async (event, ...args) => {
            validateSender(event);
            return await handler(event, ...args);
        });
    };

    // Register batchable quota handlers for efficient batch loading
    registerSecureBatchableHandler('getQuota', async (): Promise<IpcValue> => {
        return serializeToIpc(await proxyService.getQuota());
    });

    registerSecureBatchableHandler('getCopilotQuota', async (): Promise<IpcValue> => {
        return serializeToIpc(await proxyService.getCopilotQuota());
    });

    registerSecureBatchableHandler('getCodexUsage', async (): Promise<IpcValue> => {
        return serializeToIpc(await proxyService.getCodexUsage());
    });

    registerSecureBatchableHandler('getClaudeQuota', async (): Promise<IpcValue> => {
        return serializeToIpc(await proxyService.getClaudeQuota());
    });

    ipcMain.handle('proxy:antigravityLogin', createSafeIpcHandler('proxy:antigravityLogin', async () => {
        return await proxyService.getAntigravityAuthUrl();
    }, { url: '', state: '' }));

    ipcMain.handle('proxy:claudeLogin', createSafeIpcHandler('proxy:claudeLogin', async () => {
        // Try to get OAuth URL (same as anthropicLogin)
        // This will open the browser for OAuth flow
        return await proxyService.getAnthropicAuthUrl();
    }, { url: '', state: '' }));



    ipcMain.handle('proxy:saveClaudeSession', createValidatedIpcHandler('proxy:saveClaudeSession', async (_event, sessionKey: string, accountId?: string) => {
        try {
            return await proxyService.quotaService.saveClaudeSession(sessionKey, accountId);
        } catch (error) {
            appLogger.error('proxy', 'Failed to save manual session:', error as Error);
            return { success: false, error: (error as Error).message };
        }
    }, {
        argsSchema: z.tuple([sessionKeySchema, proxyAccountIdSchema]),
        defaultValue: { success: false, error: 'Validation failed' }
    }));



    ipcMain.handle('proxy:anthropicLogin', createSafeIpcHandler('proxy:anthropicLogin', async () => {
        // Legacy OAuth flow - still available but doesn't capture sessionKey
        return await proxyService.getAnthropicAuthUrl();
    }, { url: '', state: '' }));

    ipcMain.handle('proxy:codexLogin', createSafeIpcHandler('proxy:codexLogin', async () => {
        return await proxyService.getCodexAuthUrl();
    }, { url: '', state: '' }));

    ipcMain.handle('proxy:getModels', createSafeIpcHandler('proxy:getModels', async () => {
        return await proxyService.getModels();
    }, { data: [] }));

    ipcMain.handle('proxy:getQuota', createSafeIpcHandler('proxy:getQuota', async () => {
        return await proxyService.getQuota();
    }, { accounts: [] }));

    ipcMain.handle('proxy:getCopilotQuota', createSafeIpcHandler('proxy:getCopilotQuota', async () => {
        return await proxyService.getCopilotQuota();
    }, { accounts: [] }));

    ipcMain.handle('proxy:getCodexUsage', createSafeIpcHandler('proxy:getCodexUsage', async () => {
        return await proxyService.getCodexUsage();
    }, { accounts: [] }));

    ipcMain.handle('proxy:getClaudeQuota', createSafeIpcHandler('proxy:getClaudeQuota', async () => {
        return await proxyService.getClaudeQuota();
    }, { accounts: [] }));

    ipcMain.handle('proxy:get-rate-limit-metrics', createSafeIpcHandler('proxy:get-rate-limit-metrics', async () => {
        return proxyService.getProviderRateLimitMetrics();
    }, { generatedAt: 0, providers: [] }));

    ipcMain.handle('proxy:get-rate-limit-config', createSafeIpcHandler('proxy:get-rate-limit-config', async () => {
        return proxyService.getProviderRateLimitConfig();
    }, {}));

    ipcMain.handle('proxy:set-rate-limit-config', createValidatedIpcHandler('proxy:set-rate-limit-config', async (_event, provider: string, config: {
        windowMs?: number;
        maxRequests?: number;
        warningThreshold?: number;
        maxQueueSize?: number;
        allowPremiumBypass?: boolean;
    }) => {
        return proxyService.setProviderRateLimitConfig(provider, config);
    }, {
        argsSchema: z.tuple([providerNameSchema, rateLimitConfigSchema])
    }));

    ipcMain.handle('proxy:deleteAuthFile', createSafeIpcHandler('proxy:deleteAuthFile', async () => {
        // Legacy file-based auth is now handled via HTTP API
        return { success: true };
    }, { success: true }));

    // Sync auth files - now handled automatically by HTTP auth API
    ipcMain.handle('proxy:syncAuthFiles', createSafeIpcHandler('proxy:syncAuthFiles', async () => {
        // Auth sync is now automatic via HTTP API - no manual sync needed
        return { success: true };
    }, { success: true }));

    ipcMain.handle('proxy:downloadAuthFile', createSafeIpcHandler('proxy:downloadAuthFile', async () => {
        // Legacy file-based auth is now handled via HTTP API
        return { success: false, error: 'Not supported' };
    }, { success: false, error: 'Not supported' }));

    if (eventBus && getMainWindow) {
        eventBus.onCustom('proxy:rate-limit-warning', (payload) => {
            const win = getMainWindow();
            if (win && !win.isDestroyed()) {
                win.webContents.send('proxy:rate-limit-warning', payload);
            }
        });
    }
}
