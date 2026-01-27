import { useCallback, useEffect, useState } from 'react';

import { AppSettings } from '@/types';

import { AuthFile, AuthStatusState } from '../types';

interface BrowserAuthOptions {
    settings: AppSettings | null
    updateSettings: (s: AppSettings, save: boolean) => Promise<void>
    authBusy: string | null
    setAuthBusy: (b: string | null) => void
    setAuthNotice: (msg: string) => void
    onRefreshModels?: () => void
    onRefreshAccounts?: () => Promise<void>
    onShowManualSession?: (accountId: string, email?: string) => void
}

export function useBrowserAuth(options: BrowserAuthOptions) {
    const {
        settings,
        updateSettings,
        authBusy,
        setAuthBusy,
        setAuthNotice,
        onRefreshModels,
        onRefreshAccounts,
        onShowManualSession
    } = options;

    const [authStatus, setAuthStatus] = useState<AuthStatusState>({ codex: false, claude: false, antigravity: false, copilot: false });

    const refreshAuthStatus = useCallback(async () => {
        try {
            const status = await window.electron.checkAuthStatus();
            const files = (status?.files ?? []) as AuthFile[];

            const hasProvider = (providerNames: string[]) => {
                return files.some((f: AuthFile) => {
                    const fileProvider = (f.provider ?? f.type ?? '').toLowerCase();
                    const fileName = (f.name ?? '').toLowerCase();
                    return providerNames.some(name =>
                        fileProvider === name || fileName.startsWith(`${name}-`)
                    );
                });
            };

            const newStatus = {
                codex: hasProvider(['codex', 'openai']),
                claude: hasProvider(['claude', 'anthropic']),
                antigravity: hasProvider(['antigravity']),
                copilot: hasProvider(['copilot', 'copilot_token'])
            };

            setAuthStatus(prev => {
                const changed = prev.codex !== newStatus.codex ||
                    prev.claude !== newStatus.claude ||
                    prev.antigravity !== newStatus.antigravity ||
                    prev.copilot !== newStatus.copilot;
                return changed ? newStatus : prev;
            });
        } catch (error) {
            console.error('Auth check failed:', error);
        }
    }, []);

    useEffect(() => {
        void refreshAuthStatus();
    }, [refreshAuthStatus]);

    const handleClaudeAccountShow = useCallback(async () => {
        try {
            const accounts = await window.electron.getAccountsByProvider('claude');
            const newest = accounts[0];
            if (newest) {
                onShowManualSession?.(newest.id, newest.email);
            }
        } catch (err) {
            console.error('Failed to fetch Claude accounts:', err);
        }
    }, [onShowManualSession]);

    const pollConnection = useCallback((provider: string, identifiers: string[]) => {
        let attempts = 0;
        const maxAttempts = 30;
        const pollIntervalMs = 3000;

        const poll = async () => {
            attempts++;
            try {
                const status = await window.electron.checkAuthStatus();
                const files = (status?.files ?? []) as AuthFile[];

                const isConnected = files.some((f: AuthFile) => {
                    const fileProvider = (f.provider ?? f.type ?? '').toLowerCase();
                    const fileName = (f.name ?? '').toLowerCase();
                    return identifiers.some(name => fileProvider === name || fileName.startsWith(`${name}-`));
                });

                if (isConnected) {
                    setAuthNotice(`${provider} connection successful!`);
                    await window.electron.syncAuthFiles();
                    await refreshAuthStatus();
                    await onRefreshAccounts?.();
                    onRefreshModels?.();
                    setAuthBusy(null);

                    if (provider === 'claude') {
                        await handleClaudeAccountShow();
                    }
                    return;
                }

                if (attempts < maxAttempts) {
                    setTimeout(() => { void poll(); }, pollIntervalMs);
                } else {
                    setAuthNotice(`${provider} connection timed out.`);
                    setAuthBusy(null);
                }
            } catch {
                if (attempts < maxAttempts) {
                    setTimeout(() => { void poll(); }, pollIntervalMs);
                } else {
                    setAuthBusy(null);
                }
            }
        };

        setTimeout(() => { void poll(); }, 2000);
    }, [refreshAuthStatus, onRefreshAccounts, onRefreshModels, setAuthBusy, setAuthNotice, handleClaudeAccountShow]);

    const connectBrowserProvider = useCallback(async (provider: 'codex' | 'claude' | 'antigravity') => {
        if (authBusy) { return; }

        setAuthBusy(provider);
        setAuthNotice('Bağlanıyor...');

        try {
            let result: { url: string; state: string };
            if (provider === 'codex') {
                result = await window.electron.codexLogin();
            } else if (provider === 'claude') {
                result = await window.electron.claudeLogin();
            } else {
                result = await window.electron.antigravityLogin();
            }

            if (result?.url) {
                window.electron.openExternal(result.url);
                setAuthNotice('Link opened in browser. Please login.');

                const identifiers = provider === 'codex'
                    ? ['codex', 'openai']
                    : provider === 'claude'
                        ? ['claude', 'anthropic']
                        : ['antigravity'];

                pollConnection(provider, identifiers);
            } else {
                setAuthNotice(`Failed to get ${provider} login URL.`);
                setAuthBusy(null);
            }
        } catch (error) {
            console.error('[useBrowserAuth] Connection failure detail:', error instanceof Error ? error.message : String(error));
            setAuthNotice('Bağlantı başarısız.');
            setAuthBusy(null);
        }
    }, [authBusy, setAuthBusy, setAuthNotice, pollConnection]);

    const handleSaveClaudeSession = useCallback(async (sessionKey: string, accountId?: string) => {
        setAuthNotice('Saving manual session...');
        try {
            const saveRes = await window.electron.saveClaudeSession(sessionKey.trim(), accountId);
            if (saveRes?.success) {
                setAuthNotice('Session saved successfully!');
                await refreshAuthStatus();
                await onRefreshAccounts?.();
                return { success: true };
            }
            setAuthNotice('Failed to save session: ' + (saveRes?.error ?? 'Unknown error'));
            return { success: false, error: saveRes?.error };
        } catch (e) {
            const msg = (e instanceof Error ? e.message : String(e));
            setAuthNotice('Failed to save session: ' + msg);
            return { success: false, error: msg };
        } finally {
            setAuthBusy(null);
        }
    }, [refreshAuthStatus, onRefreshAccounts, setAuthNotice, setAuthBusy]);

    const disconnectProvider = useCallback(async (provider: 'copilot' | 'codex' | 'claude' | 'antigravity') => {
        if (!settings) { return; }
        const updated: AppSettings = { ...settings };

        try {
            // Use new auth system to properly unlink accounts
            await window.electron.unlinkProvider(provider);
            
            // Legacy: Also clean up old auth files for backward compatibility
            const status = await window.electron.checkAuthStatus();
            const files = (status?.files ?? []) as AuthFile[];
            const identifiers: string[] = [];
            switch (provider) {
                case 'claude': identifiers.push('claude', 'anthropic'); break;
                case 'antigravity': identifiers.push('antigravity'); break;
                case 'codex': identifiers.push('codex'); break;
                case 'copilot': identifiers.push('copilot'); break;
            }

            const targets = files.filter((f) => {
                const fileProvider = (f.provider ?? f.type ?? '').toLowerCase();
                const fileName = (f.name ?? '').toLowerCase();
                return identifiers.some(id => fileProvider === id || fileName.startsWith(`${id}-`));
            });

            for (const t of targets) {
                await window.electron.deleteProxyAuthFile(t.name ?? '');
            }
        } catch (e) {
            console.error('[SettingsAuth] Backend auth deletion failed:', e);
        }

        if (provider === 'copilot') { updated.copilot = { connected: false }; }
        if (provider === 'codex') {
            if (updated.openai?.apiKey === 'connected') {
                updated.openai = { ...updated.openai, apiKey: '' };
            }
            updated.codex = { connected: false };
            setAuthStatus(prev => ({ ...prev, codex: false }));
        }
        if (provider === 'claude') {
            if (updated.claude?.apiKey === 'connected') { updated.claude = { ...updated.claude, apiKey: '' }; }
            if (updated.anthropic?.apiKey === 'connected') { updated.anthropic = { ...updated.anthropic, apiKey: '' }; }
            setAuthStatus(prev => ({ ...prev, claude: false }));
        }
        if (provider === 'antigravity') {
            updated.antigravity = { ...(updated.antigravity ?? { connected: false }), connected: false };
            setAuthStatus(prev => ({ ...prev, antigravity: false }));
        }

        await updateSettings(updated, true);
        await new Promise(resolve => { setTimeout(resolve, 500); });
        await refreshAuthStatus();
    }, [settings, updateSettings, refreshAuthStatus]);

    return {
        authStatus,
        refreshAuthStatus,
        connectBrowserProvider,
        handleSaveClaudeSession,
        disconnectProvider
    };
}
