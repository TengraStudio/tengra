import { WORKSPACE_COMPAT_CHANNEL_VALUES } from '@shared/constants';
import type { IpcValue } from '@shared/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { IpcRendererEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceListManager } from '@/features/workspace/hooks/useWorkspaceListManager';
import { webElectronMock } from '@/web-bridge';

type WorkspaceUpdateListener = (
    event: IpcRendererEvent,
    ...args: IpcValue[]
) => void;

const mockGetFolders = vi.fn<() => Promise<never[]>>();
const mockGetWorkspaces = vi.fn<() => Promise<never[]>>();
const mockUnsubscribe = vi.fn();
const mockOn = vi.fn<
    (channel: string, listener: WorkspaceUpdateListener) => () => void
>();

describe('useWorkspaceListManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetFolders.mockResolvedValue([]);
        mockGetWorkspaces.mockResolvedValue([]);
        mockOn.mockImplementation(() => mockUnsubscribe);

        const base = window.electron ?? webElectronMock;
        window.electron = {
            ...base,
            db: {
                ...base.db,
                getFolders: mockGetFolders,
                getWorkspaces: mockGetWorkspaces,
            },
            ipcRenderer: {
                ...base.ipcRenderer,
                on: mockOn,
            },
        };
    });

    it('subscribes to workspace updates with the canonical channel', async () => {
        const { unmount } = renderHook(() => useWorkspaceListManager());

        await waitFor(() => {
            expect(mockOn).toHaveBeenCalledWith('workspace:updated', expect.any(Function));
        });

        const subscriptionCall = mockOn.mock.calls[0];
        if (!subscriptionCall) {
            throw new Error('Expected workspace update subscription');
        }

        const [, listener] = subscriptionCall;

        await act(async () => {
            listener({} as IpcRendererEvent, { id: 'workspace-1' });
        });

        await waitFor(() => {
            expect(mockGetWorkspaces).toHaveBeenCalledTimes(2);
        });

        expect(mockOn).not.toHaveBeenCalledWith(WORKSPACE_COMPAT_CHANNEL_VALUES.SINGULAR_UPDATED, expect.any(Function));

        unmount();

        expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });
});
