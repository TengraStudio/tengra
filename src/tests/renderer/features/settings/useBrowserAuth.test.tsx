import { IpcValue } from '@shared/types/common';
import { act, renderHook } from '@testing-library/react';
import { IpcRendererEvent } from 'electron';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBrowserAuth } from '@/features/settings/hooks/useBrowserAuth';
import { UseLinkedAccountsResult } from '@/features/settings/hooks/useLinkedAccounts';
import { AuthBusyState } from '@/features/settings/types';
import { AppSettings } from '@/types/settings';

type AuthChangedListener = (event: IpcRendererEvent, ...args: IpcValue[]) => void;

function createLinkedAccountsMock(): UseLinkedAccountsResult {
    return {
        accounts: [],
        loading: false,
        getAccountsByProvider: vi.fn().mockReturnValue([]),
        getActiveAccount: vi.fn().mockReturnValue(undefined),
        hasAccount: vi.fn().mockReturnValue(false),
        refreshAccounts: vi.fn().mockResolvedValue(undefined),
        unlinkAccount: vi.fn().mockResolvedValue(undefined),
        setActiveAccount: vi.fn().mockResolvedValue(undefined),
    };
}

const settingsFixture: AppSettings = {
    ollama: { url: 'http://localhost:11434' },
    embeddings: { provider: 'none' },
    general: {
        language: 'en',
        theme: 'dark',
        resolution: '1920x1080',
        fontSize: 14
    },
    proxy: { enabled: true, url: 'http://127.0.0.1:8317', key: '' }
};

describe('useBrowserAuth', () => {
    const notices: string[] = [];
    let linkedAccounts: UseLinkedAccountsResult;
    let authChangedListener: AuthChangedListener | null;

    beforeEach(() => {
        vi.useFakeTimers();
        notices.length = 0;
        linkedAccounts = createLinkedAccountsMock();
        authChangedListener = null;

        const baseElectron = window.electron ?? ({} as typeof window.electron);
        window.electron = {
            ...baseElectron,
            codexLogin: vi.fn().mockResolvedValue({
                url: 'https://example.com/auth',
                state: 'state-1',
                accountId: 'codex_requested',
            }),
            claudeLogin: vi.fn().mockResolvedValue({
                url: 'https://example.com/auth',
                state: 'state-1',
                accountId: 'claude_requested',
            }),
            antigravityLogin: vi.fn().mockResolvedValue({
                url: 'https://example.com/auth',
                state: 'state-1',
                accountId: 'antigravity_requested',
            }),
            ollamaLogin: vi.fn().mockResolvedValue({
                url: 'https://example.com/auth',
                state: 'state-1',
                accountId: 'ollama_requested',
            }),
            ollamaSignout: vi.fn().mockResolvedValue({ success: true }),
            cancelAuth: vi.fn().mockResolvedValue(true),
            unlinkProvider: vi.fn().mockResolvedValue({ success: true }),
            getLinkedAccounts: vi.fn().mockResolvedValue([]),
            getAccountsByProvider: vi.fn().mockResolvedValue([]),
            saveClaudeSession: vi.fn().mockResolvedValue({ success: true }),
            openExternal: vi.fn(),
            invoke: vi.fn().mockResolvedValue({ status: 'wait' }),
            ipcRenderer: {
                on: vi.fn((
                    _channel: string,
                    listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void
                ) => {
                    authChangedListener = listener;
                    return () => {
                        authChangedListener = null;
                    };
                }),
                off: vi.fn(),
                send: vi.fn(),
                invoke: vi.fn(),
                removeAllListeners: vi.fn(),
            },
        } as typeof window.electron;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('completes when proxy status is ok even if the returned account id differs', async () => {
        vi.mocked(window.electron.invoke).mockResolvedValue({
            status: 'ok',
            accountId: 'codex_actual',
        });

        const { result } = renderHook(() => {
            const [authBusy, setAuthBusy] = useState<AuthBusyState | null>(null);
            const hook = useBrowserAuth({
                settings: null,
                updateSettings: async () => undefined,
                linkedAccounts,
                authBusy,
                setAuthBusy,
                setAuthNotice: message => {
                    notices.push(message);
                },
            });

            return {
                authBusy,
                hook,
            };
        });

        await act(async () => {
            await result.current.hook.connectBrowserProvider('codex');
        });

        expect(result.current.authBusy?.accountId).toBe('codex_requested');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.authBusy).toBeNull();
        expect(notices).toContain('codex success!');
        expect(linkedAccounts.refreshAccounts).toHaveBeenCalled();
    });

    it('completes when auth event links a new provider account id', async () => {
        vi.mocked(window.electron.getLinkedAccounts).mockResolvedValue([
            {
                id: 'codex_existing',
                provider: 'codex',
                isActive: true,
                createdAt: Date.now(),
            },
        ]);

        const { result } = renderHook(() => {
            const [authBusy, setAuthBusy] = useState<AuthBusyState | null>(null);
            const hook = useBrowserAuth({
                settings: null,
                updateSettings: async () => undefined,
                linkedAccounts,
                authBusy,
                setAuthBusy,
                setAuthNotice: message => {
                    notices.push(message);
                },
            });

            return {
                authBusy,
                hook,
            };
        });

        await act(async () => {
            await result.current.hook.connectBrowserProvider('codex');
        });

        expect(result.current.authBusy?.accountId).toBe('codex_requested');

        await act(async () => {
            authChangedListener?.({} as IpcRendererEvent, {
                provider: 'codex',
                accountId: 'codex_new',
            });
            await Promise.resolve();
        });

        expect(result.current.authBusy).toBeNull();
        expect(notices).toContain('codex success!');
    });

    it('completes from auth event using the live pending request ref', async () => {
        const { result } = renderHook(() => {
            const [authBusy, setAuthBusy] = useState<AuthBusyState | null>(null);
            const hook = useBrowserAuth({
                settings: null,
                updateSettings: async () => undefined,
                linkedAccounts,
                authBusy,
                setAuthBusy,
                setAuthNotice: message => {
                    notices.push(message);
                },
            });

            return {
                authBusy,
                hook,
            };
        });

        await act(async () => {
            await result.current.hook.connectBrowserProvider('codex');
            authChangedListener?.({} as IpcRendererEvent, {
                provider: 'codex',
                accountId: 'codex_requested',
            });
            await Promise.resolve();
        });

        expect(result.current.authBusy).toBeNull();
        expect(notices).toContain('codex success!');
    });

    it('completes when the same provider emits an updated event for an existing account', async () => {
        vi.mocked(window.electron.getLinkedAccounts).mockResolvedValue([
            {
                id: 'codex_existing',
                provider: 'codex',
                isActive: true,
                createdAt: Date.now(),
            },
        ]);

        const { result } = renderHook(() => {
            const [authBusy, setAuthBusy] = useState<AuthBusyState | null>(null);
            const hook = useBrowserAuth({
                settings: null,
                updateSettings: async () => undefined,
                linkedAccounts,
                authBusy,
                setAuthBusy,
                setAuthNotice: message => {
                    notices.push(message);
                },
            });

            return {
                authBusy,
                hook,
            };
        });

        await act(async () => {
            await result.current.hook.connectBrowserProvider('codex');
        });

        await act(async () => {
            authChangedListener?.({} as IpcRendererEvent, {
                type: 'updated',
                provider: 'codex',
                accountId: 'codex_existing',
            });
            await Promise.resolve();
        });

        expect(result.current.authBusy).toBeNull();
        expect(notices).toContain('codex success!');
    });

    it('completes when a recent provider account appears even if account ids drift', async () => {
        const recentCreatedAt = Date.now() + 1000;
        vi.mocked(window.electron.invoke).mockResolvedValue({ status: 'wait' });
        vi.mocked(window.electron.getLinkedAccounts).mockResolvedValue([
            {
                id: 'codex_persisted',
                provider: 'codex',
                isActive: true,
                createdAt: recentCreatedAt,
            },
        ]);

        const { result } = renderHook(() => {
            const [authBusy, setAuthBusy] = useState<AuthBusyState | null>(null);
            const hook = useBrowserAuth({
                settings: null,
                updateSettings: async () => undefined,
                linkedAccounts,
                authBusy,
                setAuthBusy,
                setAuthNotice: message => {
                    notices.push(message);
                },
            });

            return {
                authBusy,
                hook,
            };
        });

        await act(async () => {
            await result.current.hook.connectBrowserProvider('codex');
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
            await Promise.resolve();
        });

        expect(result.current.authBusy).toBeNull();
        expect(notices).toContain('codex success!');
    });

    it('resets auth state when auth initialization hangs', async () => {
        vi.mocked(window.electron.codexLogin).mockImplementation(() => new Promise(() => undefined));

        const { result } = renderHook(() => {
            const [authBusy, setAuthBusy] = useState<AuthBusyState | null>(null);
            const hook = useBrowserAuth({
                settings: null,
                updateSettings: async () => undefined,
                linkedAccounts,
                authBusy,
                setAuthBusy,
                setAuthNotice: message => {
                    notices.push(message);
                },
            });

            return {
                authBusy,
                hook,
            };
        });

        await act(async () => {
            void result.current.hook.connectBrowserProvider('codex');
            await Promise.resolve();
        });

        expect(notices).toContain('Preparing connection...');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(15000);
        });

        expect(result.current.authBusy).toBeNull();
        expect(notices).toContain('Connection failed.');
    });

    it('signs out ollama before unlinking provider during disconnect', async () => {
        linkedAccounts.accounts = [
            {
                id: 'ollama_account_1',
                provider: 'ollama',
                isActive: true,
                createdAt: Date.now(),
            },
        ];
        const callOrder: string[] = [];
        const ollamaSignout = window.electron.ollamaSignout;
        if (!ollamaSignout) {
            throw new Error('Missing ollamaSignout bridge in test setup');
        }
        vi.mocked(ollamaSignout).mockImplementation(async () => {
            callOrder.push('signout');
            return { success: true };
        });
        vi.mocked(window.electron.unlinkProvider).mockImplementation(async () => {
            callOrder.push('unlink');
            return { success: true };
        });
        const updateSettings = vi.fn().mockResolvedValue(undefined);

        const { result } = renderHook(() => {
            const [authBusy, setAuthBusy] = useState<AuthBusyState | null>(null);
            const hook = useBrowserAuth({
                settings: settingsFixture,
                updateSettings,
                linkedAccounts,
                authBusy,
                setAuthBusy,
                setAuthNotice: message => {
                    notices.push(message);
                },
            });

            return {
                authBusy,
                hook,
            };
        });

        await act(async () => {
            await result.current.hook.disconnectProvider('ollama');
        });

        expect(window.electron.ollamaSignout).toHaveBeenCalledWith('ollama_account_1');
        expect(window.electron.unlinkProvider).toHaveBeenCalledWith('ollama');
        expect(callOrder).toEqual(['signout', 'unlink']);
        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(linkedAccounts.refreshAccounts).toHaveBeenCalledTimes(1);
    });

    it('times out browser auth attempts after 30 seconds', async () => {
        vi.mocked(window.electron.ipcRenderer.invoke).mockResolvedValue({
            status: 'wait',
            accountId: 'ollama_default',
        });

        const { result } = renderHook(() => {
            const [authBusy, setAuthBusy] = useState<AuthBusyState | null>(null);
            const hook = useBrowserAuth({
                settings: null,
                updateSettings: async () => undefined,
                linkedAccounts,
                authBusy,
                setAuthBusy,
                setAuthNotice: message => {
                    notices.push(message);
                },
            });

            return {
                authBusy,
                hook,
            };
        });

        await act(async () => {
            await result.current.hook.connectBrowserProvider('ollama');
        });
        expect(result.current.authBusy?.provider).toBe('ollama');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(31000);
            await Promise.resolve();
        });

        expect(window.electron.cancelAuth).toHaveBeenCalled();
        expect(result.current.authBusy).toBeNull();
    });
});
