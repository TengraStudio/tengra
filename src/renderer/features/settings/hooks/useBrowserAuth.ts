/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { AppSettings } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { AuthBusyState, AuthStatusState, BrowserOAuthProvider } from '../types';

import { UseLinkedAccountsResult } from './useLinkedAccounts';

type UnsafeValue = ReturnType<typeof JSON.parse>;

type ProviderType = BrowserOAuthProvider | 'copilot';
const BROWSER_AUTH_ACCOUNT_LOAD_TIMEOUT_MS = 10_000;
const BROWSER_AUTH_LOGIN_INIT_TIMEOUT_MS = 15_000;
const BROWSER_AUTH_STATUS_TIMEOUT_MS = 10_000;
const BROWSER_AUTH_FLOW_TIMEOUT_MS = 30_000;
const BROWSER_AUTH_MAX_POLL_ATTEMPTS = 10;

function extractErrorMessage(error: Error | string): string {
    return typeof error === 'string' ? error : error.message;
}

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
    t?: (key: string, options?: Record<string, string | number>) => string
    onRefreshModels?: () => void
    onShowManualSession?: (id: string, email?: string) => void
}

function defaultBrowserAuthTranslation(
    key: string,
    options?: Record<string, string | number>
): string {
    const provider = String(options?.provider ?? 'provider');
    const reason = String(options?.reason ?? 'Unknown error');

    switch (key) {
    case 'auth.providerSuccess':
        return `${provider} success!`;
    case 'auth.preparingConnection':
        return 'Preparing connection...';
    case 'auth.connecting':
        return 'Connecting...';
    case 'auth.providerTimeout':
        return `${provider} connection timed out.`;
    case 'auth.providerFailed':
        return `${provider} connection failed.`;
    case 'auth.failedUrlForProvider':
        return `Failed to start ${provider} authentication.`;
    case 'auth.failedWithReason':
        return `Connection failed: ${reason}`;
    case 'auth.connectionFailedGeneric':
        return 'Connection failed.';
    case 'auth.connectionCancelled':
        return 'Connection cancelled.';
    case 'auth.anotherFlowRunning':
        return 'Another authentication flow is already running.';
    case 'auth.savingSession':
        return 'Saving session...';
    case 'common.success':
        return 'Success';
    case 'common.unknownError':
        return 'Unknown error';
    default:
        return key;
    }
}

const PROVIDER_ACCOUNT_ALIASES: Record<BrowserOAuthProvider, string[]> = {
    codex: ['codex', 'openai'],
    claude: ['claude', 'anthropic'],
    antigravity: ['antigravity', 'google', 'gemini'],
    ollama: ['ollama']
};

const PROVIDER_SETTINGS_UPDATERS: Record<ProviderType, (settings: AppSettings) => AppSettings> = {
    copilot: settings => ({ ...settings, copilot: { connected: false } }),
    codex: settings => ({
        ...settings,
        codex: { connected: false }
    }),
    claude: settings => ({ ...settings }),
    antigravity: settings => ({
        ...settings,
        antigravity: { ...(settings.antigravity ?? { connected: false }), connected: false }
    }),
    ollama: settings => ({
        ...settings,
        ollama: { ...settings.ollama }
    })
};

function isBrowserOAuthProvider(provider: string | null | undefined): provider is BrowserOAuthProvider {
    return provider === 'codex' || provider === 'claude' || provider === 'antigravity' || provider === 'ollama';
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
        ollama: hasProvider(PROVIDER_ACCOUNT_ALIASES.ollama),
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
        t = defaultBrowserAuthTranslation,
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
            await window.electron.auth.cancelAuth(request.provider, request.state, request.accountId);
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
            const accounts = await window.electron.auth.getAccountsByProvider('claude');
            const firstAccount = accounts[0];
            if (firstAccount) {
                onShowManualSession?.(firstAccount.id, firstAccount.email);
            }
        } catch (error) {
            appLogger.error('BrowserAuth', 'Failed to load Claude accounts', error as Error);
        }
    }, [onShowManualSession]);

    const invokeBrowserAuthStatus = useCallback((request: BrowserAuthRequest) => {
        return window.electron.auth.getBrowserAuthStatus(
            request.provider,
            request.state,
            request.accountId
        ) as Promise<BrowserAuthPollStatus>;
    }, []);

    const completeBrowserAuth = useCallback(async (request: BrowserAuthRequest) => {

        appLogger.debug('BrowserAuth', `Completing ${request.provider} auth for ${request.accountId}`);
        activeRequestRef.current += 1;
        clearPollTimeout();
        pendingBrowserAuthRef.current = null;
        sawProviderAuthUpdateRef.current = false;
        setAuthBusy(null);
        setAuthNotice(t('frontend.auth.providerSuccess', { provider: request.provider }));

        try {
            await linkedAccounts.refreshAccounts();
            onRefreshModels?.();
            if (request.provider === 'claude') {
                await handleClaudeAccountShow();
            }
        } catch (error) {
            appLogger.error('BrowserAuth', 'Post-auth refresh failed', error as Error);
        }
    }, [clearPollTimeout, handleClaudeAccountShow, linkedAccounts, onRefreshModels, setAuthBusy, setAuthNotice, t]);

    const findLinkedBrowserAccount = useCallback(async (request: BrowserAuthRequest) => {
        const accounts = await withTimeout(
            window.electron.auth.getLinkedAccounts(),
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
        const removeListener = window.electron.auth.onAccountChanged(() => {
            const request = pendingBrowserAuthRef.current;
            if (!request) {
                return;
            }

            void refreshAuthStatus();
        });

        return () => {
            removeListener();
        };
    }, [refreshAuthStatus]);

    const pollConnection = useCallback((request: BrowserAuthRequest) => {
        const requestId = activeRequestRef.current;
        let attempts = 0;
        const hasAuthTimedOut = () => Date.now() - request.startedAt >= BROWSER_AUTH_FLOW_TIMEOUT_MS;

        const scheduleNextPoll = () => {
            pollTimeoutRef.current = setTimeout(() => {
                void poll();
            }, 3000);
        };

        const poll = async () => {
            if (!mountedRef.current || requestId !== activeRequestRef.current) {
                return;
            }
            if (hasAuthTimedOut()) {
                await cancelBrowserAuthAttempt(request);
                resetBrowserAuthState(t('frontend.auth.providerTimeout', { provider: request.provider }));
                return;
            }

            attempts += 1;
            try {
                const remainingFlowMs = BROWSER_AUTH_FLOW_TIMEOUT_MS - (Date.now() - request.startedAt);
                if (remainingFlowMs <= 0) {
                    await cancelBrowserAuthAttempt(request);
                    resetBrowserAuthState(t('frontend.auth.providerTimeout', { provider: request.provider }));
                    return;
                }
                const boundedAuthState = await withTimeout(
                    invokeBrowserAuthStatus(request),
                    Math.min(BROWSER_AUTH_STATUS_TIMEOUT_MS, remainingFlowMs),
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
                    const providerAccounts = getProviderAccounts(request, await window.electron.auth.getLinkedAccounts());
                    if (providerAccounts.length > 0) {
                        await completeBrowserAuth(request);
                        return;
                    }
                }

                if (boundedAuthState.status === 'error') {
                    await cancelBrowserAuthAttempt(request);
                    resetBrowserAuthState(boundedAuthState.error?.trim() || t('frontend.auth.providerFailed', { provider: request.provider }));
                    return;
                }

                if (attempts < BROWSER_AUTH_MAX_POLL_ATTEMPTS && !hasAuthTimedOut()) {
                    scheduleNextPoll();
                    return;
                }

                await cancelBrowserAuthAttempt(request);
                resetBrowserAuthState(t('frontend.auth.providerTimeout', { provider: request.provider }));
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

                if (attempts < BROWSER_AUTH_MAX_POLL_ATTEMPTS && !hasAuthTimedOut()) {
                    scheduleNextPoll();
                    return;
                }

                await cancelBrowserAuthAttempt(request);
                resetBrowserAuthState(t('frontend.auth.providerTimeout', { provider: request.provider }));
            }
        };

        pollTimeoutRef.current = setTimeout(() => {
            void poll();
        }, 2000);
    }, [cancelBrowserAuthAttempt, completeBrowserAuth, findLinkedBrowserAccount, invokeBrowserAuthStatus, resetBrowserAuthState, t]);

    const connectBrowserProvider = useCallback(async (provider: BrowserOAuthProvider) => {
        if (authBusy && !isBrowserOAuthProvider(authBusy.provider)) {
            setAuthNotice(t('frontend.auth.anotherFlowRunning'), 3000);
            return;
        }

        const requestId = activeRequestRef.current + 1;
        activeRequestRef.current = requestId;
        await cancelBrowserAuthAttempt(pendingBrowserAuth);
        clearPollTimeout();
        setAuthBusy(null);
        setAuthNotice(t('frontend.auth.preparingConnection'));

        try {
            appLogger.debug('BrowserAuth', `[${provider}] Step 1: Getting linked accounts (requestId=${requestId})`);
            const existingAccounts = await withTimeout(
                window.electron.auth.getLinkedAccounts(),
                BROWSER_AUTH_ACCOUNT_LOAD_TIMEOUT_MS,
                `${provider} linked-account bootstrap`
            );
            const initialAccountIds = getProviderAccountsForProvider(provider, existingAccounts)
                .map(account => account.id);

            // Special handling for Ollama native connect
            if (provider === 'ollama') {
                appLogger.debug('BrowserAuth', `[ollama] Step 2: Calling initiateConnect`);
                const response = await withTimeout(
                    window.electron.ollama.initiateConnect(),
                    BROWSER_AUTH_LOGIN_INIT_TIMEOUT_MS,
                    'ollama connect initialization'
                ) as UnsafeValue;

                if (requestId !== activeRequestRef.current) {return;}
                if (!response.success || !response.connectUrl || !response.code) {
                    resetBrowserAuthState(response.error || t('frontend.auth.failedUrlForProvider', { provider }));
                    return;
                }

                const request: BrowserAuthRequest = {
                    provider: 'ollama',
                    state: response.code, // use code as state for tracking
                    accountId: 'pending_ollama_' + response.code,
                    initialAccountIds,
                    startedAt: Date.now()
                };

                pendingBrowserAuthRef.current = request;
                setAuthBusy(request);
                window.electron.openExternal(response.connectUrl);
                setAuthNotice(t('frontend.auth.connecting'));

                // Custom polling for Ollama connect
                const pollOllama = async () => {
                    if (requestId !== activeRequestRef.current) {return;}
                    try {
                        const result = await window.electron.ollama.pollConnectStatus(
                            response.code,
                            response.privateKeyB64,
                            response.publicKeyB64
                        ) as UnsafeValue;
                        if (requestId !== activeRequestRef.current) {return;}
                        if (result.success) {
                            await completeBrowserAuth(request);
                        } else if (result.error && !result.error.includes('pending') && !result.error.includes('waiting')) {
                            resetBrowserAuthState(result.error);
                        } else {
                            pollTimeoutRef.current = setTimeout(() => {
                                void pollOllama();
                            }, 3000);
                        }
                    } catch {
                        if (requestId !== activeRequestRef.current) {return;}
                        pollTimeoutRef.current = setTimeout(() => {
                            void pollOllama();
                        }, 3000);
                    }
                };
                pollTimeoutRef.current = setTimeout(() => {
                    void pollOllama();
                }, 3000);
                return;
            }

            appLogger.debug('BrowserAuth', `[${provider}] Step 2: Calling ${provider}Login (initialAccounts=${initialAccountIds.length})`);
            const loginRequest = provider === 'codex'
                ? window.electron.auth.codexLogin()
                : provider === 'claude'
                    ? window.electron.auth.claudeLogin()
                    : window.electron.auth.antigravityLogin();

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
                resetBrowserAuthState(t('frontend.auth.failedUrlForProvider', { provider }));
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
            setAuthNotice(t('frontend.auth.connecting'));
            pollConnection(request);
        } catch (error) {
            appLogger.error('BrowserAuth', `Connection failure for ${provider}`, error as Error);
            const reason = extractErrorMessage(error as Error | string).trim();
            resetBrowserAuthState(
                reason.length > 0
                    ? t('frontend.auth.failedWithReason', { reason })
                    : t('frontend.auth.connectionFailedGeneric')
            );
        }
    }, [authBusy, cancelBrowserAuthAttempt, clearPollTimeout, completeBrowserAuth, pendingBrowserAuth, pollConnection, resetBrowserAuthState, setAuthBusy, setAuthNotice, t]);

    const cancelBrowserAuth = useCallback(async () => {
        await cancelBrowserAuthAttempt(pendingBrowserAuth);
        resetBrowserAuthState(t('frontend.auth.connectionCancelled'));
    }, [cancelBrowserAuthAttempt, pendingBrowserAuth, resetBrowserAuthState, t]);

    const cancelBrowserAuthForAccount = useCallback(async (accountId: string) => {
        if (pendingBrowserAuth?.accountId !== accountId) {
            return;
        }
        await cancelBrowserAuthAttempt(pendingBrowserAuth);
        resetBrowserAuthState(t('frontend.auth.connectionCancelled'));
    }, [cancelBrowserAuthAttempt, pendingBrowserAuth, resetBrowserAuthState, t]);

    const handleSaveClaudeSession = useCallback(async (key: string, id?: string) => {
        setAuthNotice(t('frontend.auth.savingSession'));
        try {
            const result = await window.electron.auth.saveClaudeSession(key.trim(), id);
            if (!result.success) {
                const errorMessage = result.error ?? t('common.unknownError');
                setAuthNotice(t('frontend.auth.failedWithReason', { reason: errorMessage }));
                return { success: false, error: errorMessage };
            }

            setAuthNotice(t('common.success'));
            await linkedAccounts.refreshAccounts();
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setAuthNotice(t('frontend.auth.failedWithReason', { reason: message }));
            return { success: false, error: message };
        } finally {
            setAuthBusy(null);
        }
    }, [linkedAccounts, setAuthBusy, setAuthNotice, t]);

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
        if (provider === 'ollama' && window.electron.auth.ollamaSignout) {
            const ollamaAccountId = linkedAccounts.accounts.find(account =>
                PROVIDER_ACCOUNT_ALIASES.ollama.includes(account.provider.toLowerCase())
            )?.id;
            try {
                const result = await window.electron.auth.ollamaSignout(ollamaAccountId);
                if (!result.success && !result.alreadySignedOut) {
                    appLogger.warn('BrowserAuth', `Ollama signout failed: ${result.error ?? 'UnsafeValue error'}`);
                }
            } catch (error) {
                appLogger.warn('BrowserAuth', 'Ollama signout request failed', error as Error);
            }
        }
        try {
            await window.electron.auth.unlinkProvider(provider);
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

