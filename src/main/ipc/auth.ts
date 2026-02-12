import { appLogger } from '@main/logging/logger';
import { CopilotService } from '@main/services/llm/copilot.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService, TokenData } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain } from 'electron';

export interface AuthIpcDependencies {
    proxyService: ProxyService;
    copilotService: CopilotService;
    authService: AuthService;
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
    const { proxyService, copilotService, authService, getMainWindow, eventBus } = deps;
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

            if (appId === 'copilot') {
                copilotService.setGithubToken(token);
            }

            return { success: true, token };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }));

    // Note: The following handlers are registered in batch handlers below for optimization
    // - auth:get-linked-accounts
    // - auth:get-active-linked-account
    // - auth:has-linked-account

    ipcMain.handle('auth:set-active-linked-account', createIpcHandler('auth:set-active-linked-account', async (_event, provider: string, accountId: string) => {
        try {
            await authService.setActiveAccount(provider, accountId);
            return { success: true };
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to set active linked account', error as Error);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }));

    ipcMain.handle('auth:link-account', createIpcHandler('auth:link-account', async (_event, provider: string, tokenData: TokenData) => {
        try {
            const account = await authService.linkAccount(provider, tokenData);
            return { success: true, account };
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to link account', error as Error);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }));

    ipcMain.handle('auth:unlink-account', createIpcHandler('auth:unlink-account', async (_event, accountId: string) => {
        try {
            await authService.unlinkAccount(accountId);
            return { success: true };
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to unlink account', error as Error);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }));

    ipcMain.handle('auth:unlink-provider', createIpcHandler('auth:unlink-provider', async (_event, provider: string) => {
        try {
            await authService.unlinkAllForProvider(provider);
            return { success: true };
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to unlink provider', error as Error);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }));

    // Note: auth:has-linked-account is registered in batch handlers below

    // Register commonly batched handlers
    registerBatchableHandler('auth:get-linked-accounts', async (_event, ...args): Promise<import('@shared/types/common').JsonValue> => {
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

    registerBatchableHandler('auth:get-active-linked-account', async (_event, ...args): Promise<import('@shared/types/common').JsonValue> => {
        const provider = args[0] as string;
        try {
            return (await authService.getActiveAccount(provider)) as unknown as JsonValue;
        } catch (error) {
            appLogger.error('AuthIPC', 'Failed to get active linked account (batched)', error as Error);
            return null;
        }
    });

    registerBatchableHandler('auth:has-linked-account', async (_event, ...args) => {
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
        getMainWindow()?.webContents.send('auth:account-changed', { type: 'linked', ...payload });
    });

    eventBus.on('account:updated', (payload) => {
        getMainWindow()?.webContents.send('auth:account-changed', { type: 'updated', ...payload });
    });

    eventBus.on('account:unlinked', (payload) => {
        getMainWindow()?.webContents.send('auth:account-changed', { type: 'unlinked', ...payload });
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
