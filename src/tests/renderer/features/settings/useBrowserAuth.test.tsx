import { IpcValue } from '@shared/types/common';
import { act, renderHook } from '@testing-library/react';
import { IpcRendererEvent } from 'electron';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBrowserAuth } from '@/features/settings/hooks/useBrowserAuth';
import { UseLinkedAccountsResult } from '@/features/settings/hooks/useLinkedAccounts';
import { AuthBusyState } from '@/features/settings/types';

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
            cancelAuth: vi.fn().mockResolvedValue(true),
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
});
