import { LinkedAccountInfo } from '@renderer/electron.d'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
    const [accounts, setAccounts] = useState<LinkedAccountInfo[]>([])
    const [loading, setLoading] = useState(true)
    const initialFetchDone = useRef(false)

    const refreshAccounts = useCallback(async () => {
        try {
            setLoading(true)
            const linkedAccounts = await window.electron.getLinkedAccounts()
            setAccounts(linkedAccounts)
        } catch (error) {
            console.error('Failed to fetch linked accounts:', error)
            setAccounts([])
        } finally {
            setLoading(false)
        }
    }, [])

    // Only fetch once on mount
    useEffect(() => {
        if (!initialFetchDone.current) {
            initialFetchDone.current = true
            void refreshAccounts()
        }
    }, [refreshAccounts])

    // Memoize these functions to prevent re-renders
    const getAccountsByProvider = useCallback((provider: string): LinkedAccountInfo[] => {
        return accounts.filter(a => a.provider === provider)
    }, [accounts])

    const getActiveAccount = useCallback((provider: string): LinkedAccountInfo | undefined => {
        return accounts.find(a => a.provider === provider && a.isActive)
    }, [accounts])

    const hasAccount = useCallback((provider: string): boolean => {
        return accounts.some(a => a.provider === provider)
    }, [accounts])

    const unlinkAccount = useCallback(async (accountId: string) => {
        try {
            await window.electron.unlinkAccount(accountId)
            await refreshAccounts()
        } catch (error) {
            console.error('Failed to unlink account:', error)
        }
    }, [refreshAccounts])

    const setActiveAccount = useCallback(async (provider: string, accountId: string) => {
        try {
            await window.electron.setActiveLinkedAccount(provider, accountId)
            await refreshAccounts()
        } catch (error) {
            console.error('Failed to set active account:', error)
        }
    }, [refreshAccounts])

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
    }), [accounts, loading, getAccountsByProvider, getActiveAccount, hasAccount, refreshAccounts, unlinkAccount, setActiveAccount])
}
