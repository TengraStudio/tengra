/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LinkedAccountInfo } from '@renderer/electron.d';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { appLogger } from '@/utils/renderer-logger';

const PROVIDER_ALIASES: Record<string, string[]> = {
    codex: ['codex', 'openai'],
    claude: ['claude', 'anthropic'],
    antigravity: ['antigravity', 'google', 'gemini'],
    ollama: ['ollama'],
    copilot: ['copilot', 'copilot_token'],
    github: ['github']
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
            const linkedAccounts = await window.electron.getLinkedAccounts();
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
            void refreshAccounts();
        }

        // Listen for account change events from main process (e.g. multi-account linking)
        const removeListener = window.electron.ipcRenderer.on('auth:account-changed', () => {
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
            await window.electron.unlinkAccount(accountId);
            await refreshAccounts();
        } catch (error) {
            appLogger.error('LinkedAccounts', 'Failed to unlink account', error as Error);
        }
    }, [refreshAccounts]);

    const setActiveAccount = useCallback(async (provider: string, accountId: string) => {
        try {
            await window.electron.setActiveLinkedAccount(provider, accountId);
            await refreshAccounts();
        } catch (error) {
            appLogger.error('LinkedAccounts', 'Failed to set active account', error as Error);
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
        setActiveAccount
    }), [accounts, loading, getAccountsByProvider, getActiveAccount, hasAccount, refreshAccounts, unlinkAccount, setActiveAccount]);
}
