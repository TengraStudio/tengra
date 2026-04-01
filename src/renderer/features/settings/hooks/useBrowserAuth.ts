import { useCallback, useEffect, useMemo, useRef } from 'react';

import { AppSettings } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { AuthBusyState, AuthStatusState, BrowserOAuthProvider } from '../types';

import { UseLinkedAccountsResult } from './useLinkedAccounts';

type ProviderType = BrowserOAuthProvider | 'copilot';
const BROWSER_AUTH_ACCOUNT_LOAD_TIMEOUT_MS = 10_000;
const BROWSER_AUTH_LOGIN_INIT_TIMEOUT_MS = 15_000;
const BROWSER_AUTH_STATUS_TIMEOUT_MS = 10_000;

interface BrowserAuthPollStatus {
    status: string
    error?: string
    provider?: string
    state?: string
    accountId?: string
    account_id?: string
    account?: {
        id?: string
        provider?: string
    }
}

interface BrowserAccountSnapshot {
    id: string
    provider: string
    createdAt?: number
}

interface AuthAccountChangedPayload {
    type?: string
    provider?: string
    accountId?: string
    account_id?: string
}

interface BrowserAuthRequest {
    provider: BrowserOAuthProvider
    state: string
    accountId: string
    initialAccountIds: string[]
    startedAt: number
}

interface BrowserAuthOptions {
    settings: AppSettings | null
    updateSettings: (settings: AppSettings, save: boolean) => Promise<void>
    linkedAccounts: UseLinkedAccountsResult
    authBusy: AuthBusyState | null
    setAuthBusy: (busy: AuthBusyState | null) => void
    setAuthNotice: (message: string, duration?: number) => void
    onRefreshModels?: () => void
    onShowManualSession?: (id: string, email?: string) => void
}

const PROVIDER_ACCOUNT_ALIASES: Record<BrowserOAuthProvider, string[]> = {
    codex: ['codex', 'openai'],
    claude: ['claude', 'anthropic'],
    antigravity: ['antigravity', 'google', 'gemini']
};

const PROVIDER_SETTINGS_UPDATERS: Record<ProviderType, (settings: AppSettings) => AppSettings> = {
    copilot: settings => ({ ...settings, copilot: { connected: false } }),
    codex: settings => ({
        ...settings,
        openai: settings.openai?.apiKey === 'connected' ? { ...settings.openai, apiKey: '' } : settings.openai,
        codex: { connected: false }
    }),
    claude: settings => ({
        ...settings,
        claude: settings.claude?.apiKey === 'connected' ? { ...settings.claude, apiKey: '' } : settings.claude,
        anthropic: settings.anthropic?.apiKey === 'connected' ? { ...settings.anthropic, apiKey: '' } : settings.anthropic
    }),
    antigravity: settings => ({
        ...settings,
        antigravity: { ...(settings.antigravity ?? { connected: false }), connected: false }
    })
};

function isBrowserOAuthProvider(provider: string | null | undefined): provider is BrowserOAuthProvider {
    return provider === 'codex' || provider === 'claude' || provider === 'antigravity';
}

function toBrowserAuthRequest(authBusy: AuthBusyState | null): BrowserAuthRequest | null {
    if (!authBusy || !isBrowserOAuthProvider(authBusy.provider) || !authBusy.state || !authBusy.accountId) {
        return null;
    }
    return {
        provider: authBusy.provider,
        state: authBusy.state,
        accountId: authBusy.accountId,
        initialAccountIds: authBusy.initialAccountIds ?? [],
        startedAt: authBusy.startedAt
    };
}

function extractPayloadAccountId(payload?: AuthAccountChangedPayload): string | undefined {
    if (!payload) {
        return undefined;
    }
    return payload.accountId ?? payload.account_id;
}

function extractPayloadProvider(payload?: AuthAccountChangedPayload): string | undefined {
    return payload?.provider?.toLowerCase();
}

function extractStatusAccountId(status: BrowserAuthPollStatus): string | undefined {
    return status.accountId ?? status.account_id ?? status.account?.id;
}

function buildAuthStatus(accounts: UseLinkedAccountsResult['accounts']): AuthStatusState {
    const hasProvider = (aliases: string[]) =>
        accounts.some(account => aliases.includes(account.provider.toLowerCase()));

    return {
        codex: hasProvider(PROVIDER_ACCOUNT_ALIASES.codex),
        claude: hasProvider(PROVIDER_ACCOUNT_ALIASES.claude),
        antigravity: hasProvider(PROVIDER_ACCOUNT_ALIASES.antigravity),
        copilot: hasProvider(['copilot', 'copilot_token'])
    };
}

function matchesBrowserAccount(
    request: BrowserAuthRequest,
    account: BrowserAccountSnapshot
): boolean {
    return account.id === request.accountId
        && PROVIDER_ACCOUNT_ALIASES[request.provider].includes(account.provider.toLowerCase());
}

function getProviderAccounts(
    request: BrowserAuthRequest,
    accounts: BrowserAccountSnapshot[]
): BrowserAccountSnapshot[] {
    return getProviderAccountsForProvider(request.provider, accounts);
}

function getProviderAccountsForProvider(
    provider: BrowserOAuthProvider,
    accounts: BrowserAccountSnapshot[]
): BrowserAccountSnapshot[] {
    return accounts.filter(account =>
        PROVIDER_ACCOUNT_ALIASES[provider].includes(account.provider.toLowerCase())
    );
}

function findRecentProviderAccounts(
    request: BrowserAuthRequest,
    accounts: BrowserAccountSnapshot[]
): BrowserAccountSnapshot[] {
    return getProviderAccounts(request, accounts)
        .filter(account => typeof account.createdAt === 'number' && account.createdAt >= request.startedAt - 15000)
        .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));
}

function findBrowserCompletionCandidate(
    request: BrowserAuthRequest,
    accounts: BrowserAccountSnapshot[]
): BrowserAccountSnapshot | null {
    const providerAccounts = getProviderAccounts(request, accounts);
    const exactMatch = providerAccounts.find(account => matchesBrowserAccount(request, account));
    if (exactMatch) {
        return exactMatch;
    }

    const newAccounts = providerAccounts.filter(account => !request.initialAccountIds.includes(account.id));
    if (newAccounts.length === 1) {
        return newAccounts[0] ?? null;
    }

    if (request.initialAccountIds.length === 0 && providerAccounts.length === 1) {
        return providerAccounts[0] ?? null;
    }

    const recentAccounts = findRecentProviderAccounts(request, accounts);
    if (recentAccounts.length > 0) {
        return recentAccounts[0] ?? null;
    }

    return null;
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
        return await Promise.race([
            operation,
            new Promise<T>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`${label} timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            })
        ]);
    } finally {
        if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
        }
    }
}

export function useBrowserAuth(options: BrowserAuthOptions) {
    const {
        settings,
        updateSettings,
        linkedAccounts,
        authBusy,
        setAuthBusy,
        setAuthNotice,
        onRefreshModels,
        onShowManualSession
    } = options;
    const mountedRef = useRef(true);
    const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeRequestRef = useRef(0);
    const pendingBrowserAuthRef = useRef<BrowserAuthRequest | null>(null);
    const sawProviderAuthUpdateRef = useRef(false);
    const authStatus = useMemo(() => buildAuthStatus(linkedAccounts.accounts), [linkedAccounts.accounts]);
    const pendingBrowserAuth = useMemo(() => toBrowserAuthRequest(authBusy), [authBusy]);

    useEffect(() => {
        pendingBrowserAuthRef.current = pendingBrowserAuth;
    }, [pendingBrowserAuth]);

    const clearPollTimeout = useCallback(() => {
        if (pollTimeoutRef.current !== null) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
        }
    }, []);

    const resetBrowserAuthState = useCallback((message?: string, duration = 2000) => {
        const request = pendingBrowserAuthRef.current;
        if (request) {
            appLogger.info('BrowserAuth', `Resetting ${request.provider} auth state for ${request.accountId}${message ? `: ${message}` : ''}`);
        }
        activeRequestRef.current += 1;
        clearPollTimeout();
        pendingBrowserAuthRef.current = null;
        sawProviderAuthUpdateRef.current = false;
        setAuthBusy(null);
        if (message) {
            setAuthNotice(message, duration);
        }
    }, [clearPollTimeout, setAuthBusy, setAuthNotice]);

    const cancelBrowserAuthAttempt = useCallback(async (request: BrowserAuthRequest | null) => {
        if (!request) {
            return;
        }

        try {
            await window.electron.cancelAuth(request.provider, request.state, request.accountId);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            appLogger.warn('BrowserAuth', `Failed to cancel ${request.provider} auth: ${message}`);
        }
    }, []);

    const refreshAuthStatus = useCallback(async () => {
        await linkedAccounts.refreshAccounts();
    }, [linkedAccounts]);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
            clearPollTimeout();
        };
    }, [clearPollTimeout]);

    const handleClaudeAccountShow = useCallback(async () => {
        try {
            const accounts = await window.electron.getAccountsByProvider('claude');
            const firstAccount = accounts[0];
            if (firstAccount) {
                onShowManualSession?.(firstAccount.id, firstAccount.email);
            }
        } catch (error) {
            appLogger.error('BrowserAuth', 'Failed to load Claude accounts', error as Error);
        }
    }, [onShowManualSession]);

    const completeBrowserAuth = useCallback(async (request: BrowserAuthRequest) => {

        appLogger.debug('BrowserAuth', `Completing ${request.provider} auth for ${request.accountId}`);
        activeRequestRef.current += 1;
        clearPollTimeout();
        pendingBrowserAuthRef.current = null;
        sawProviderAuthUpdateRef.current = false;
        setAuthBusy(null);
        setAuthNotice(`${request.provider} success!`);

        try {
            await linkedAccounts.refreshAccounts();
            onRefreshModels?.();
            if (request.provider === 'claude') {
                await handleClaudeAccountShow();
            }
        } catch (error) {
            appLogger.error('BrowserAuth', 'Post-auth refresh failed', error as Error);
        }
    }, [clearPollTimeout, handleClaudeAccountShow, linkedAccounts, onRefreshModels, setAuthBusy, setAuthNotice]);

    const findLinkedBrowserAccount = useCallback(async (request: BrowserAuthRequest) => {
        const accounts = await withTimeout(
            window.electron.getLinkedAccounts(),
            BROWSER_AUTH_ACCOUNT_LOAD_TIMEOUT_MS,
            `${request.provider} linked-account refresh`
        );
        return findBrowserCompletionCandidate(request, accounts);
    }, []);

    useEffect(() => {
        if (!pendingBrowserAuth) {
            return;
        }

        const completedAccount = findBrowserCompletionCandidate(pendingBrowserAuth, linkedAccounts.accounts);
        if (completedAccount) {
            void completeBrowserAuth(pendingBrowserAuth);
        }
    }, [completeBrowserAuth, linkedAccounts.accounts, pendingBrowserAuth]);

    useEffect(() => {
        const removeListener = window.electron.ipcRenderer.on('auth:account-changed', (_event, payload?: AuthAccountChangedPayload) => {
            const request = pendingBrowserAuthRef.current;
            if (!request) {
                return;
            }

            const changedProvider = extractPayloadProvider(payload);
            const changedAccountId = extractPayloadAccountId(payload);
            if (!changedProvider || !PROVIDER_ACCOUNT_ALIASES[request.provider].includes(changedProvider)) {
                return;
            }

            appLogger.debug(
                'BrowserAuth',
                `Received auth change event for ${request.provider}: payloadProvider=${changedProvider}, payloadAccount=${changedAccountId ?? 'missing'}, type=${payload?.type ?? 'missing'}`
            );

            if (payload?.type === 'linked' || payload?.type === 'updated') {
                sawProviderAuthUpdateRef.current = true;
            }

            if (changedAccountId === request.accountId) {
                void completeBrowserAuth(request);
                return;
            }

            if (changedAccountId && !request.initialAccountIds.includes(changedAccountId)) {
                void completeBrowserAuth(request);
                return;
            }

            if (payload?.type === 'linked' || payload?.type === 'updated') {
                void completeBrowserAuth(request);
                return;
            }

            void findLinkedBrowserAccount(request).then(completedAccount => {
                if (completedAccount && pendingBrowserAuthRef.current?.accountId === request.accountId) {
                    void completeBrowserAuth(request);
                }
            });
        });

        return () => {
            removeListener();
        };
    }, [completeBrowserAuth, findLinkedBrowserAccount]);

    const pollConnection = useCallback((request: BrowserAuthRequest) => {
        const requestId = activeRequestRef.current;
        let attempts = 0;

        const scheduleNextPoll = () => {
            pollTimeoutRef.current = setTimeout(() => {
                void poll();
            }, 3000);
        };

        const poll = async () => {
            if (!mountedRef.current || requestId !== activeRequestRef.current) {
                return;
            }

            attempts += 1;
            try {
                const boundedAuthState = await withTimeout(
                    window.electron.ipcRenderer.invoke(
                        'proxy:getAuthStatus',
                        request.provider,
                        request.state,
                        request.accountId
                    ) as Promise<BrowserAuthPollStatus>,
                    BROWSER_AUTH_STATUS_TIMEOUT_MS,
                    `${request.provider} auth status`
                );

                if (!mountedRef.current || requestId !== activeRequestRef.current) {
                    return;
                }

                const matchingLinkedAccount = await findLinkedBrowserAccount(request);
                const statusAccountId = extractStatusAccountId(boundedAuthState);
                const isMatchingStatus = boundedAuthState.status === 'ok';

                appLogger.info(
                    'BrowserAuth',
                    `Poll ${request.provider} auth: status=${boundedAuthState.status}, requested=${request.accountId}, statusAccount=${statusAccountId ?? 'missing'}, linkedMatch=${matchingLinkedAccount?.id ?? 'none'}, attempt=${attempts}`
                );

                if (isMatchingStatus && statusAccountId && statusAccountId !== request.accountId) {
                    appLogger.debug(
                        'BrowserAuth',
                        `Completing ${request.provider} auth with reconciled account ${statusAccountId} (requested ${request.accountId})`
                    );
                }

                if (isMatchingStatus || matchingLinkedAccount) {
                    await completeBrowserAuth(request);
                    return;
                }

                if (sawProviderAuthUpdateRef.current) {
                    const providerAccounts = getProviderAccounts(request, await window.electron.getLinkedAccounts());
                    if (providerAccounts.length > 0) {
                        await completeBrowserAuth(request);
                        return;
                    }
                }

                if (boundedAuthState.status === 'error') {
                    await cancelBrowserAuthAttempt(request);
                    resetBrowserAuthState(boundedAuthState.error?.trim() || `${request.provider} failed`);
                    return;
                }

                if (attempts < 30) {
                    scheduleNextPoll();
                    return;
                }

                await cancelBrowserAuthAttempt(request);
                resetBrowserAuthState(`${request.provider} timeout`);
            } catch (error) {
                appLogger.error('BrowserAuth', 'pollConnection error', error as Error);
                if (!mountedRef.current || requestId !== activeRequestRef.current) {
                    return;
                }

                const matchingLinkedAccount = await findLinkedBrowserAccount(request);
                if (matchingLinkedAccount) {
                    await completeBrowserAuth(request);
                    return;
                }

                if (attempts < 30) {
                    scheduleNextPoll();
                    return;
                }

                await cancelBrowserAuthAttempt(request);
                resetBrowserAuthState(`${request.provider} timeout`);
            }
        };

        pollTimeoutRef.current = setTimeout(() => {
            void poll();
        }, 2000);
    }, [cancelBrowserAuthAttempt, completeBrowserAuth, findLinkedBrowserAccount, resetBrowserAuthState]);

    const connectBrowserProvider = useCallback(async (provider: BrowserOAuthProvider) => {
        if (authBusy && !isBrowserOAuthProvider(authBusy.provider)) {
            setAuthNotice('Another authentication flow is already running.', 3000);
            return;
        }

        const requestId = activeRequestRef.current + 1;
        activeRequestRef.current = requestId;
        await cancelBrowserAuthAttempt(pendingBrowserAuth);
        clearPollTimeout();
        setAuthBusy(null);
        setAuthNotice('Preparing connection...');

        try {
            appLogger.debug('BrowserAuth', `[${provider}] Step 1: Getting linked accounts (requestId=${requestId})`);
            const existingAccounts = await withTimeout(
                window.electron.getLinkedAccounts(),
                BROWSER_AUTH_ACCOUNT_LOAD_TIMEOUT_MS,
                `${provider} linked-account bootstrap`
            );
            const initialAccountIds = getProviderAccountsForProvider(provider, existingAccounts)
                .map(account => account.id);
            appLogger.debug('BrowserAuth', `[${provider}] Step 2: Calling ${provider}Login (initialAccounts=${initialAccountIds.length})`);
            const loginRequest = provider === 'codex'
                ? window.electron.codexLogin()
                : provider === 'claude'
                    ? window.electron.claudeLogin()
                    : window.electron.antigravityLogin();
            const response = await withTimeout(
                loginRequest,
                BROWSER_AUTH_LOGIN_INIT_TIMEOUT_MS,
                `${provider} auth initialization`
            );
            appLogger.debug('BrowserAuth', `[${provider}] Step 3: Got response. url=${response.url ? 'present' : 'MISSING'}, state=${response.state ? 'present' : 'MISSING'}, accountId=${response.accountId ?? 'MISSING'}, keys=${Object.keys(response).join(',')}`);

            if (requestId !== activeRequestRef.current) {
                appLogger.debug('BrowserAuth', `[${provider}] Step 3b: STALE REQUEST — requestId=${requestId}, activeRef=${activeRequestRef.current}`);
                return;
            }
            if (!response.url || !response.state || !response.accountId) {
                appLogger.debug('BrowserAuth', `[${provider}] Step 3c: MISSING DATA — url=${!!response.url}, state=${!!response.state}, accountId=${!!response.accountId}`);
                resetBrowserAuthState(`Failed URL for ${provider}`);
                return;
            }

            const request: BrowserAuthRequest = {
                provider,
                state: response.state,
                accountId: response.accountId,
                initialAccountIds,
                startedAt: Date.now()
            };

            appLogger.debug(
                'BrowserAuth',
                `Starting ${provider} browser auth with request account ${request.accountId} (initial accounts: ${initialAccountIds.join(', ') || 'none'})`
            );
            pendingBrowserAuthRef.current = request;
            sawProviderAuthUpdateRef.current = false;
            setAuthBusy(request);
            appLogger.debug('BrowserAuth', `[${provider}] Step 4: Opening browser with URL`);
            window.electron.openExternal(response.url);
            setAuthNotice('Connecting...');
            pollConnection(request);
        } catch (error) {
            appLogger.error('BrowserAuth', `Connection failure for ${provider}`, error as Error);
            resetBrowserAuthState('Connection failed.');
        }
    }, [authBusy, cancelBrowserAuthAttempt, clearPollTimeout, pendingBrowserAuth, pollConnection, resetBrowserAuthState, setAuthBusy, setAuthNotice]);

    const cancelBrowserAuth = useCallback(async () => {
        await cancelBrowserAuthAttempt(pendingBrowserAuth);
        resetBrowserAuthState('Connection cancelled.');
    }, [cancelBrowserAuthAttempt, pendingBrowserAuth, resetBrowserAuthState]);

    const cancelBrowserAuthForAccount = useCallback(async (accountId: string) => {
        if (pendingBrowserAuth?.accountId !== accountId) {
            return;
        }
        await cancelBrowserAuthAttempt(pendingBrowserAuth);
        resetBrowserAuthState('Connection cancelled.');
    }, [cancelBrowserAuthAttempt, pendingBrowserAuth, resetBrowserAuthState]);

    const handleSaveClaudeSession = useCallback(async (key: string, id?: string) => {
        setAuthNotice('Saving session...');
        try {
            const result = await window.electron.saveClaudeSession(key.trim(), id);
            if (!result.success) {
                const errorMessage = result.error ?? 'Unknown';
                setAuthNotice(`Failed: ${errorMessage}`);
                return { success: false, error: errorMessage };
            }

            setAuthNotice('Success!');
            await linkedAccounts.refreshAccounts();
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setAuthNotice(`Failed: ${message}`);
            return { success: false, error: message };
        } finally {
            setAuthBusy(null);
        }
    }, [linkedAccounts, setAuthBusy, setAuthNotice]);

    const disconnectProvider = useCallback(async (provider: ProviderType) => {
        if (!settings) {
            return;
        }

        if (pendingBrowserAuth?.provider === provider) {
            await cancelBrowserAuthAttempt(pendingBrowserAuth);
            clearPollTimeout();
            setAuthBusy(null);
        }

        const updatedSettings = PROVIDER_SETTINGS_UPDATERS[provider](settings);
        try {
            await window.electron.unlinkProvider(provider);
        } catch (error) {
            appLogger.error('BrowserAuth', 'Provider unlink failed', error as Error);
        }

        await updateSettings(updatedSettings, true);
        await linkedAccounts.refreshAccounts();
    }, [cancelBrowserAuthAttempt, clearPollTimeout, linkedAccounts, pendingBrowserAuth, setAuthBusy, settings, updateSettings]);

    return {
        authStatus,
        refreshAuthStatus,
        connectBrowserProvider,
        cancelBrowserAuth,
        cancelBrowserAuthForAccount,
        handleSaveClaudeSession,
        disconnectProvider
    };
}
