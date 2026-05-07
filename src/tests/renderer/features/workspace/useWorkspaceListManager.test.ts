/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceListManager } from '@/features/workspace/hooks/useWorkspaceListManager';
import { webElectronMock } from '@/web-bridge';

const mockGetFolders = vi.fn<() => Promise<never[]>>();
const mockGetWorkspaces = vi.fn<() => Promise<never[]>>();
const mockUnsubscribe = vi.fn();
const mockOnWorkspaceUpdated = vi.fn<
    (callback: (payload: { id?: string }) => void) => () => void
>();

describe('useWorkspaceListManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetFolders.mockResolvedValue([]);
        mockGetWorkspaces.mockResolvedValue([]);
        mockOnWorkspaceUpdated.mockImplementation(() => mockUnsubscribe);

        const base = window.electron ?? webElectronMock;
        window.electron = {
            ...base,
            db: {
                ...base.db,
                getFolders: mockGetFolders,
                getWorkspaces: mockGetWorkspaces,
                onWorkspaceUpdated: mockOnWorkspaceUpdated,
            },
        };
    });

    it('subscribes to workspace updates through the typed db bridge', async () => {
        const { unmount } = renderHook(() => useWorkspaceListManager());

        await waitFor(() => {
            expect(mockOnWorkspaceUpdated).toHaveBeenCalledWith(expect.any(Function));
        });

        const subscriptionCall = mockOnWorkspaceUpdated.mock.calls[0];
        if (!subscriptionCall) {
            throw new Error('Expected workspace update subscription');
        }

        const [listener] = subscriptionCall;

        await act(async () => {
            listener({ id: 'workspace-1' });
        });

        await waitFor(() => {
            expect(mockGetWorkspaces).toHaveBeenCalledTimes(2);
        });

        unmount();

        expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });
});

