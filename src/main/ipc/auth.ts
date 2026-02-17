import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import {
    accountIdSchema,
    authTokenDataSchema,
    providerSchema,
    sessionIdSchema,
    sessionLimitSchema
} from '@main/ipc/validation';
import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { CopilotService } from '@main/services/llm/copilot.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService, TokenData } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createIpcHandler as baseCreateIpcHandler, createValidatedIpcHandler as baseCreateValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { IpcValue, JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

export interface AuthIpcDependencies {
    proxyService: ProxyService;
    copilotService: CopilotService;
    authService: AuthService;
    auditLogService?: AuditLogService;
    getMainWindow: () => BrowserWindow | null;
    eventBus: EventBusService;
}

/**
 * Registers IPC handlers for authentication.
 * @param deps Dependencies for the authentication IPC handlers.
 * @param deps.proxyService Service for proxy authentication.
 * @param deps.copilotService Service for Copilot integration.
 * @param deps.authService Service for GitHub authentication.
 * @param deps.getMainWindow Function to get the main browser window.
 * @param deps.eventBus Service for event broadcasting.
 */
export function registerAuthIpc(deps: AuthIpcDependencies) {
    const { proxyService, copilotService, authService, auditLogService, getMainWindow, eventBus } = deps;
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'auth operation');
    const createIpcHandler = <T = JsonValue, Args extends unknown[] = unknown[]>(
        handlerName: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>
    ) => baseCreateIpcHandler<T, Args>(
        handlerName,
        async (event, ...args) => {
            validateSender(event);
            return handler(event, ...args);
        }
    );
    const createValidatedIpcHandler = <T = JsonValue, Args extends unknown[] = unknown[]>(
        handlerName: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
        options: Parameters<typeof baseCreateValidatedIpcHandler<T, Args>>[2]
    ) => baseCreateValidatedIpcHandler<T, Args>(
        handlerName,
        async (event, ...args) => {
            validateSender(event);
            return handler(event, ...args);
        },
        options
    );
    const registerSecureBatchableHandler = (
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: IpcValue[]) => Promise<IpcValue>
    ) => {
        registerBatchableHandler(channel, async (event, ...args) => {
            validateSender(event);
            return await handler(event, ...args);
        });
    };
    // --- GitHub/Copilot Device Code Flow ---

    ipcMain.handle('auth:github-login', createIpcHandler('auth:github-login', async (_event, appId: 'profile' | 'copilot' = 'copilot') => {
        return await proxyService.initiateGitHubAuth(appId);
    }));

    ipcMain.handle('auth:poll-token', createIpcHandler('auth:poll-token', async (_event, deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'copilot') => {
        try {
            const response = await proxyService.waitForGitHubToken(deviceCode, interval, appId);
            const token = response.access_token;
            const provider = appId === 'copilot' ? 'copilot' : 'github';

            const { email, displayName, avatarUrl } = await fetchGitHubIdentity(proxyService, token);

            const tokenData: TokenData = {
                accessToken: token,
                refreshToken: response.refresh_token,
                expiresAt: response.expires_in ? Date.now() + (response.expires_in * 1000) : undefined,
                scope: appId === 'copilot' ? 'read:user user:email' : 'read:user user:email repo',
                email,
                displayName,
                avatarUrl
            };

            appLogger.info('AuthIPC', `Linking ${provider} account for identity: ${email ?? 'unknown'}`);
            await authService.linkAccount(provider, tokenData);
            await auditLogService?.logAuthenticationEvent('auth.poll-token.link-account', true, {
                provider,
                email
            });

            if (appId === 'copilot') {
                copilotService.setGithubToken(token);
            }

            return { success: true, token };
        } catch (error) {
            await auditLogService?.logAuthenticationEvent('auth.poll-token.link-account', false, {
                error: getErrorMessage(error as Error)
            });
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }));

    // Note: The following handlers are registered in batch handlers below for optimization
    // - auth:get-linked-accounts
    // - auth:get-active-linked-account
    // - auth:has-linked-account

    ipcMain.handle('auth:set-active-linked-account', createValidatedIpcHandler('auth:set-active-linked-account', async (_event, provider: string, accountId: string) => {
        try {
            await authService.setActiveAccount(provider, accountId);
            await auditLogService?.logAuthenticationEvent('auth.set-active-account', true, { provider, accountId });
            return { success: true };
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to set active linked account', error as Error);
            await auditLogService?.logAuthenticationEvent('auth.set-active-account', false, {
                provider,
                accountId,
                error: getErrorMessage(error as Error)
            });
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }, {
        argsSchema: z.tuple([providerSchema, accountIdSchema]),
        schemaVersion: 1
    }));

    ipcMain.handle('auth:link-account', createValidatedIpcHandler('auth:link-account', async (_event, provider: string, tokenData: TokenData) => {
        try {
            const account = await authService.linkAccount(provider, tokenData);
            await auditLogService?.logAuthenticationEvent('auth.link-account', true, {
                provider,
                accountId: account.id
            });
            return { success: true, account };
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to link account', error as Error);
            await auditLogService?.logAuthenticationEvent('auth.link-account', false, {
                provider,
                error: getErrorMessage(error as Error)
            });
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }, {
        argsSchema: z.tuple([providerSchema, authTokenDataSchema]),
        schemaVersion: 1
    }));

    ipcMain.handle('auth:unlink-account', createValidatedIpcHandler('auth:unlink-account', async (_event, accountId: string) => {
        try {
            await authService.unlinkAccount(accountId);
            await auditLogService?.logAuthenticationEvent('auth.unlink-account', true, { accountId });
            return { success: true };
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to unlink account', error as Error);
            await auditLogService?.logAuthenticationEvent('auth.unlink-account', false, {
                accountId,
                error: getErrorMessage(error as Error)
            });
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }, {
        argsSchema: z.tuple([accountIdSchema]),
        schemaVersion: 1
    }));

    ipcMain.handle('auth:unlink-provider', createValidatedIpcHandler('auth:unlink-provider', async (_event, provider: string) => {
        try {
            await authService.unlinkAllForProvider(provider);
            await auditLogService?.logAuthenticationEvent('auth.unlink-provider', true, { provider });
            return { success: true };
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to unlink provider', error as Error);
            await auditLogService?.logAuthenticationEvent('auth.unlink-provider', false, {
                provider,
                error: getErrorMessage(error as Error)
            });
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }, {
        argsSchema: z.tuple([providerSchema]),
        schemaVersion: 1
    }));

    ipcMain.handle('auth:detect-provider', createIpcHandler('auth:detect-provider', async (_event, providerHint?: string, tokenData?: TokenData) => {
        const provider = authService.detectProvider(providerHint, tokenData);
        return { provider };
    }));

    ipcMain.handle('auth:get-provider-health', createIpcHandler('auth:get-provider-health', async (_event, provider?: string) => {
        return await authService.getProviderHealth(provider);
    }));

    ipcMain.handle('auth:get-provider-analytics', createIpcHandler('auth:get-provider-analytics', async () => {
        return await authService.getProviderAnalytics();
    }));

    ipcMain.handle('auth:rotate-token-encryption', createIpcHandler('auth:rotate-token-encryption', async (_event, provider?: string) => {
        return await authService.rotateTokenEncryption(provider);
    }));

    ipcMain.handle('auth:revoke-account-token', createIpcHandler('auth:revoke-account-token', async (
        _event,
        accountId: string,
        options?: { revokeAccess?: boolean; revokeRefresh?: boolean; revokeSession?: boolean }
    ) => {
        await authService.revokeAccountTokens(accountId, options);
        return { success: true };
    }));

    ipcMain.handle('auth:get-token-analytics', createIpcHandler('auth:get-token-analytics', async (_event, provider?: string) => {
        return await authService.getTokenAnalytics(provider);
    }));

    ipcMain.handle('auth:start-session', createValidatedIpcHandler('auth:start-session', async (
        _event,
        provider: string,
        accountId?: string,
        source?: string
    ) => {
        return { sessionId: authService.startSession(provider, accountId, source) };
    }, {
        argsSchema: z.tuple([providerSchema, accountIdSchema.optional(), z.string().max(128).optional()]),
        schemaVersion: 1
    }));

    ipcMain.handle('auth:touch-session', createValidatedIpcHandler('auth:touch-session', async (_event, sessionId: string) => {
        return { success: authService.touchSession(sessionId) };
    }, {
        argsSchema: z.tuple([sessionIdSchema]),
        schemaVersion: 1
    }));

    ipcMain.handle('auth:end-session', createValidatedIpcHandler('auth:end-session', async (_event, sessionId: string) => {
        return { success: authService.endSession(sessionId) };
    }, {
        argsSchema: z.tuple([sessionIdSchema]),
        schemaVersion: 1
    }));

    ipcMain.handle('auth:set-session-limit', createValidatedIpcHandler('auth:set-session-limit', async (_event, provider: string, limit: number) => {
        return { limit: authService.setSessionLimit(provider, limit) };
    }, {
        argsSchema: z.tuple([providerSchema, sessionLimitSchema]),
        schemaVersion: 1
    }));

    ipcMain.handle('auth:get-session-analytics', createIpcHandler('auth:get-session-analytics', async (_event, provider?: string) => {
        return authService.getSessionAnalytics(provider);
    }));

    ipcMain.handle('auth:set-session-timeout', createValidatedIpcHandler('auth:set-session-timeout', async (_event, timeoutMs: number) => {
        return { timeoutMs: authService.setSessionIdleTimeout(timeoutMs) };
    }, {
        argsSchema: z.tuple([z.number().int().min(60_000).max(7 * 24 * 60 * 60 * 1000)]),
        schemaVersion: 1
    }));

    ipcMain.handle('auth:get-session-timeout', createIpcHandler('auth:get-session-timeout', async () => {
        return { timeoutMs: authService.getSessionIdleTimeout() };
    }));

    // Note: auth:has-linked-account is registered in batch handlers below

    // Register commonly batched handlers
    registerSecureBatchableHandler('auth:get-linked-accounts', async (_event, ...args): Promise<import('@shared/types/common').JsonValue> => {
        const provider = args[0] as string | undefined;
        try {
            if (provider) {
                return (await authService.getAccountsByProvider(provider)) as unknown as JsonValue;
            }
            return (await authService.getAllAccounts()) as unknown as JsonValue;
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to get linked accounts (batched)', error as Error);
            return [];
        }
    });

    registerSecureBatchableHandler('auth:get-active-linked-account', async (_event, ...args): Promise<import('@shared/types/common').JsonValue> => {
        const provider = args[0] as string;
        try {
            return (await authService.getActiveAccount(provider)) as unknown as JsonValue;
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to get active linked account (batched)', error as Error);
            return null;
        }
    });

    registerSecureBatchableHandler('auth:has-linked-account', async (_event, ...args) => {
        const provider = args[0] as string;
        try {
            return await authService.hasLinkedAccount(provider);
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to check linked account (batched)', error as Error);
            return false;
        }
    });

    // --- Event Bridge to Renderer ---

    eventBus.on('account:linked', (payload) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('auth:account-changed', { type: 'linked', ...payload });
        }
    });

    eventBus.on('account:updated', (payload) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('auth:account-changed', { type: 'updated', ...payload });
        }
    });

    eventBus.on('account:unlinked', (payload) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('auth:account-changed', { type: 'unlinked', ...payload });
        }
    });
}

/**
 * Helper to fetch GitHub identity (email, name, avatar) from a token
 * Extracted to reduce cyclomatic complexity in IPC handlers
 */
async function fetchGitHubIdentity(proxyService: ProxyService, token: string): Promise<{
    email?: string,
    displayName?: string,
    avatarUrl?: string
}> {
    let email: string | undefined;
    let displayName: string | undefined;
    let avatarUrl: string | undefined;

    try {
        const profile = await proxyService.fetchGitHubProfile(token);
        displayName = profile.displayName;
        avatarUrl = profile.avatarUrl;
        email = profile.email;
        appLogger.info('AuthIPC', `GitHub profile fetch result: ${displayName}, email=${email ? '[PRESENT]' : '[MISSING]'}`);

        // If email still missing, fetch specifically
        if (!email) {
            email = await proxyService.fetchGitHubEmails(token);
            appLogger.info('AuthIPC', `GitHub email fallback fetch result: ${email ? '[PRESENT]' : '[MISSING]'}`);
        }

        // Final fallback for user identity: use login (username) if email is still missing
        if (!email && profile.login) {
            email = `${profile.login}@github.com`;
            appLogger.info('AuthIPC', `Using GitHub login as identity fallback: ${email}`);
        }
    } catch (err) {
        appLogger.error('AuthIPC', 'Failed to fetch GitHub identity', err as Error);
    }

    return { email, displayName, avatarUrl };
}
