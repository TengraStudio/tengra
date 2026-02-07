import React, { useCallback, useEffect, useState } from 'react';

import { AppSettings } from '@/types';

import { AuthStatusState } from '../types';



type ProviderType = 'copilot' | 'codex' | 'claude' | 'antigravity';

const PROVIDER_SETTINGS_UPDATERS: Record<ProviderType, (s: AppSettings, setStatus: React.Dispatch<React.SetStateAction<AuthStatusState>>) => void> = {
    copilot: s => { s.copilot = { connected: false }; },
    codex: (s, set) => { if (s.openai?.apiKey === 'connected') { s.openai = { ...s.openai, apiKey: '' }; } s.codex = { connected: false }; set(p => ({ ...p, codex: false })); },
    claude: (s, set) => { if (s.claude?.apiKey === 'connected') { s.claude = { ...s.claude, apiKey: '' }; } if (s.anthropic?.apiKey === 'connected') { s.anthropic = { ...s.anthropic, apiKey: '' }; } set(p => ({ ...p, claude: false })); },
    antigravity: (s, set) => { s.antigravity = { ...(s.antigravity ?? { connected: false }), connected: false }; set(p => ({ ...p, antigravity: false })); }
};



interface BrowserAuthOptions {
    settings: AppSettings | null; updateSettings: (s: AppSettings, save: boolean) => Promise<void>;
    authBusy: string | null; setAuthBusy: (b: string | null) => void; setAuthNotice: (msg: string) => void;
    onRefreshModels?: () => void; onRefreshAccounts?: () => Promise<void>; onShowManualSession?: (id: string, email?: string) => void;
}

export function useBrowserAuth(options: BrowserAuthOptions) {
    const { settings, updateSettings, authBusy, setAuthBusy, setAuthNotice, onRefreshModels, onRefreshAccounts, onShowManualSession } = options;
    const [authStatus, setAuthStatus] = useState<AuthStatusState>({ codex: false, claude: false, antigravity: false, copilot: false });

    const refreshAuthStatus = useCallback(async () => {
        try {
            const accounts = await window.electron.getLinkedAccounts();
            const check = (ids: string[]) => accounts.some(acc => ids.includes(acc.provider.toLowerCase()));
            const ns = {
                codex: check(['codex', 'openai']),
                claude: check(['claude', 'anthropic']),
                antigravity: check(['antigravity']),
                copilot: check(['copilot', 'copilot_token'])
            };
            setAuthStatus(p => (p.codex !== ns.codex || p.claude !== ns.claude || p.antigravity !== ns.antigravity || p.copilot !== ns.copilot) ? ns : p);
        } catch (e) { console.error('Auth check failed:', e); }
    }, []);

    useEffect(() => { void refreshAuthStatus(); }, [refreshAuthStatus]);

    const handleClaudeAccountShow = useCallback(async () => {
        try {
            const accounts = await window.electron.getAccountsByProvider('claude');
            if (accounts.length > 0) { onShowManualSession?.(accounts[0].id, accounts[0].email); }
        } catch (err) { console.error('Failed Claude accounts:', err); }
    }, [onShowManualSession]);

    const pollConnection = useCallback((provider: string, identifiers: string[]) => {
        let attempts = 0;
        const poll = async () => {
            attempts++;
            try {
                const accounts = await window.electron.getLinkedAccounts();
                const matched = accounts.some(acc => identifiers.includes(acc.provider.toLowerCase()));
                if (matched) {
                    setAuthNotice(`${provider} success!`);
                    await refreshAuthStatus();
                    await onRefreshAccounts?.();
                    onRefreshModels?.();
                    setAuthBusy(null);
                    if (provider === 'claude') { await handleClaudeAccountShow(); }
                    return;
                }
                if (attempts < 30) { setTimeout(() => { void poll(); }, 3000); }
                else { setAuthNotice(`${provider} timeout`); setAuthBusy(null); }
            } catch (err) {
                console.error('pollConnection error:', err);
                if (attempts < 30) { setTimeout(() => { void poll(); }, 3000); }
                else { setAuthBusy(null); }
            }
        };
        setTimeout(() => { void poll(); }, 2000);
    }, [refreshAuthStatus, onRefreshAccounts, onRefreshModels, setAuthBusy, setAuthNotice, handleClaudeAccountShow]);

    const connectBrowserProvider = useCallback(async (provider: 'codex' | 'claude' | 'antigravity') => {
        if (authBusy) { return; }
        setAuthBusy(provider); setAuthNotice('Bağlanıyor...');
        try {
            const res = provider === 'codex' ? await window.electron.codexLogin() : provider === 'claude' ? await window.electron.claudeLogin() : await window.electron.antigravityLogin();
            if (res.url) {
                window.electron.openExternal(res.url); setAuthNotice('Login in browser.');
                pollConnection(provider, provider === 'codex' ? ['codex', 'openai'] : provider === 'claude' ? ['claude', 'anthropic'] : ['antigravity']);
            } else { setAuthNotice(`Failed URL for ${provider}`); setAuthBusy(null); }
        } catch (e) { console.error('Conn failure:', e); setAuthNotice('Bağlantı başarısız.'); setAuthBusy(null); }
    }, [authBusy, setAuthBusy, setAuthNotice, pollConnection]);

    const handleSaveClaudeSession = useCallback(async (key: string, id?: string) => {
        setAuthNotice('Saving session...');
        try {
            const res = await window.electron.saveClaudeSession(key.trim(), id);
            if (res.success) { setAuthNotice('Success!'); await refreshAuthStatus(); await onRefreshAccounts?.(); return { success: true }; }
            setAuthNotice('Failed: ' + (res.error ?? 'Unknown')); return { success: false, error: res.error };
        } catch (e) { const m = (e instanceof Error ? e.message : String(e)); setAuthNotice('Failed: ' + m); return { success: false, error: m }; }
        finally { setAuthBusy(null); }
    }, [refreshAuthStatus, onRefreshAccounts, setAuthNotice, setAuthBusy]);

    const disconnectProvider = useCallback(async (prov: ProviderType) => {
        if (!settings) { return; }
        const updated = { ...settings };
        try {
            await window.electron.unlinkProvider(prov);
        } catch (e) { console.error('Deletion failed:', e); }
        PROVIDER_SETTINGS_UPDATERS[prov](updated, setAuthStatus);
        await updateSettings(updated, true);
        await new Promise(r => setTimeout(r, 500));
        await refreshAuthStatus();
    }, [settings, updateSettings, refreshAuthStatus]);

    return { authStatus, refreshAuthStatus, connectBrowserProvider, handleSaveClaudeSession, disconnectProvider };
}
