/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LinkedAccountInfo } from '@/electron.d';
import { appLogger } from '@/utils/renderer-logger';

const LINKED_ACCOUNTS_CACHE_TTL_MS = 10_000;
let linkedAccountsCache: { value: LinkedAccountInfo[]; expiresAt: number } | null = null;
let linkedAccountsInFlight: Promise<LinkedAccountInfo[]> | null = null;

const PROVIDER_ALIASES: Record<string, string[]> = {
    codex: ['codex', 'openai'],
    claude: ['claude', 'anthropic'],
    antigravity: ['antigravity', 'google', 'gemini'],
    ollama: ['ollama'],
    copilot: ['copilot', 'copilot_token'],
    opencode: ['opencode']
};

function matchesProviderAlias(accountProvider: string, requestedProvider: string): boolean {
    const normalizedAccountProvider = accountProvider.toLowerCase();
    const normalizedRequestedProvider = requestedProvider.toLowerCase();
    const aliases = PROVIDER_ALIASES[normalizedRequestedProvider] ?? [normalizedRequestedProvider];
    return aliases.includes(normalizedAccountProvider);
}

export interface UseLinkedAccountsResult {
    accounts: LinkedAccountInfo[]
    loading: boolean
    getAccountsByProvider: (provider: string) => LinkedAccountInfo[]
    getActiveAccount: (provider: string) => LinkedAccountInfo | undefined
    hasAccount: (provider: string) => boolean
    refreshAccounts: () => Promise<void>
    unlinkAccount: (accountId: string) => Promise<void>
    setActiveAccount: (provider: string, accountId: string) => Promise<void>
    linkAccount: (provider: string, tokenData: { key?: string; accessToken?: string; metadata?: Record<string, unknown> }) => Promise<void>
}

export function invalidateLinkedAccountsSnapshot(): void {
    linkedAccountsCache = null;
}

export async function fetchLinkedAccountsSnapshot(forceRefresh = false): Promise<LinkedAccountInfo[]> {
    const now = Date.now();
    if (!forceRefresh && linkedAccountsCache && linkedAccountsCache.expiresAt > now) {
        return linkedAccountsCache.value;
    }

    if (!forceRefresh && linkedAccountsInFlight) {
        return linkedAccountsInFlight;
    }

    linkedAccountsInFlight = window.electron.auth.getLinkedAccounts()
        .then(accounts => {
            linkedAccountsCache = {
                value: accounts,
                expiresAt: Date.now() + LINKED_ACCOUNTS_CACHE_TTL_MS,
            };
            return accounts;
        })
        .finally(() => {
            linkedAccountsInFlight = null;
        });

    return linkedAccountsInFlight;
}

/**
 * Hook for managing linked accounts using the new multi-account API.
 * Memoized to prevent excessive re-renders.
 */
export function useLinkedAccounts(): UseLinkedAccountsResult {
    const [accounts, setAccounts] = useState<LinkedAccountInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const initialFetchDone = useRef(false);

    const refreshAccounts = useCallback(async () => {
        try {
            setLoading(true);
            const linkedAccounts = await fetchLinkedAccountsSnapshot(true);
            setAccounts(linkedAccounts);
        } catch (error) {
            appLogger.error('LinkedAccounts', 'Failed to fetch linked accounts', error as Error);
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Only fetch once on mount
    useEffect(() => {
        if (!initialFetchDone.current) {
            initialFetchDone.current = true;
            const idleCallback = (window as Window & {
                requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number
            }).requestIdleCallback;
            if (idleCallback) {
                idleCallback(() => {
                    void refreshAccounts();
                }, { timeout: 1500 });
            } else {
                window.setTimeout(() => {
                    void refreshAccounts();
                }, 120);
            }
        }

        // Listen for account change events from main process (e.g. multi-account linking)
        const removeListener = window.electron.auth.onAccountChanged(() => {
            invalidateLinkedAccountsSnapshot();
            void refreshAccounts();
        });

        return () => {
            removeListener();
        };
    }, [refreshAccounts]);

    // Memoize these functions to prevent re-renders
    const getAccountsByProvider = useCallback((provider: string): LinkedAccountInfo[] => {
        return accounts.filter(a => matchesProviderAlias(a.provider, provider));
    }, [accounts]);

    const getActiveAccount = useCallback((provider: string): LinkedAccountInfo | undefined => {
        return accounts.find(a => matchesProviderAlias(a.provider, provider) && a.isActive);
    }, [accounts]);

    const hasAccount = useCallback((provider: string): boolean => {
        return accounts.some(a => matchesProviderAlias(a.provider, provider));
    }, [accounts]);

    const unlinkAccount = useCallback(async (accountId: string) => {
        try {
            await window.electron.auth.unlinkAccount(accountId);
            invalidateLinkedAccountsSnapshot();
            await refreshAccounts();
        } catch (error) {
            appLogger.error('LinkedAccounts', 'Failed to unlink account', error as Error);
        }
    }, [refreshAccounts]);

    const setActiveAccount = useCallback(async (provider: string, accountId: string) => {
        try {
            await window.electron.auth.setActiveLinkedAccount(provider, accountId);
            invalidateLinkedAccountsSnapshot();
            await refreshAccounts();
        } catch (error) {
            appLogger.error('LinkedAccounts', 'Failed to set active account', error as Error);
        }
    }, [refreshAccounts]);

    const linkAccount = useCallback(async (provider: string, tokenData: { key?: string; accessToken?: string; metadata?: Record<string, unknown> }) => {
        try {
            await window.electron.auth.linkAccount(provider, tokenData);
            invalidateLinkedAccountsSnapshot();
            await refreshAccounts();
        } catch (error) {
            appLogger.error('LinkedAccounts', 'Failed to link account', error as Error);
        }
    }, [refreshAccounts]);

    // Memoize the entire return object to prevent unnecessary re-renders
    return useMemo(() => ({
        accounts,
        loading,
        getAccountsByProvider,
        getActiveAccount,
        hasAccount,
        refreshAccounts,
        unlinkAccount,
        setActiveAccount,
        linkAccount
    }), [accounts, loading, getAccountsByProvider, getActiveAccount, hasAccount, refreshAccounts, unlinkAccount, setActiveAccount, linkAccount]);
}

