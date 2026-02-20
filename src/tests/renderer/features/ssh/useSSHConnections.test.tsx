import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSSHConnections } from '@/features/ssh/hooks/useSSHConnections';
import { sshManagerErrorCodes } from '@/features/ssh/utils/ssh-manager-validation';
import { webElectronMock } from '@/web-bridge';

function installSSHMocks() {
    const connectedCallbacks: Array<(id: string) => void> = [];
    const disconnectedCallbacks: Array<(id: string) => void> = [];

    const getProfiles = vi.fn().mockResolvedValue([
        {
            id: 'conn-1',
            name: 'Production',
            host: '10.0.0.5',
            port: 22,
            username: 'agnes',
        },
    ]);
    const getConnections = vi.fn().mockResolvedValue([]);
    const isConnected = vi.fn().mockResolvedValue(false);
    const shellStart = vi.fn().mockResolvedValue({ success: true });

    const base = window.electron ?? webElectronMock;
    window.electron = {
        ...base,
        ssh: {
            ...base.ssh,
            getProfiles,
            getConnections,
            isConnected,
            shellStart,
            onConnected: vi.fn((callback: (id: string) => void) => {
                connectedCallbacks.push(callback);
            }),
            onDisconnected: vi.fn((callback: (id: string) => void) => {
                disconnectedCallbacks.push(callback);
            }),
            removeAllListeners: vi.fn(),
        },
    };

    return {
        getProfiles,
        getConnections,
        isConnected,
        shellStart,
        connectedCallbacks,
        disconnectedCallbacks,
    };
}

describe('useSSHConnections', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('retries connection loading after a transient failure', async () => {
        const mocks = installSSHMocks();
        mocks.getProfiles
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValue([
                {
                    id: 'conn-1',
                    name: 'Production',
                    host: '10.0.0.5',
                    port: 22,
                    username: 'agnes',
                },
            ]);

        const { result } = renderHook(() => useSSHConnections(true));

        await waitFor(() => {
            expect(result.current.isLoadingConnections).toBe(false);
        });

        expect(mocks.getProfiles).toHaveBeenCalledTimes(2);
        expect(result.current.uiState).toBe('ready');
        expect(result.current.connections.length).toBe(1);
    });

    it('marks validation error when incoming profile shape is invalid', async () => {
        const mocks = installSSHMocks();
        mocks.getProfiles.mockResolvedValue([
            {
                host: '10.0.0.5',
                port: 22,
            },
        ]);

        const { result } = renderHook(() => useSSHConnections(true));

        await waitFor(() => {
            expect(result.current.isLoadingConnections).toBe(false);
        });

        expect(result.current.uiState).toBe('empty');
        expect(result.current.lastErrorCode).toBe(sshManagerErrorCodes.validation);
    });

    it('updates selected connection on connected/disconnected events', async () => {
        const mocks = installSSHMocks();
        const { result } = renderHook(() => useSSHConnections(true));

        await waitFor(() => {
            expect(result.current.isLoadingConnections).toBe(false);
        });

        expect(mocks.connectedCallbacks.length).toBeGreaterThan(0);
        expect(mocks.disconnectedCallbacks.length).toBeGreaterThan(0);

        act(() => {
            mocks.connectedCallbacks[0]('conn-1');
        });
        expect(result.current.selectedConnectionId).toBe('conn-1');
        expect(mocks.shellStart).toHaveBeenCalledWith('conn-1');

        act(() => {
            mocks.disconnectedCallbacks[0]('conn-1');
        });
        expect(result.current.selectedConnectionId).toBeNull();
    });
});
