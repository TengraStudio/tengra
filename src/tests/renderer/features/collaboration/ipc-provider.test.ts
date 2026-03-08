import {
    WORKSPACE_COMPAT_ALIAS_VALUES,
    WORKSPACE_COMPAT_TARGET_VALUES
} from '@shared/constants';
import type {
    CollaborationResponse,
    CollaborationSyncUpdate,
    JoinCollaborationRoom,
} from '@shared/schemas/collaboration.schema';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { IpcProvider } from '@/features/collaboration/lib/ipc-provider';
import { webElectronMock } from '@/web-bridge';

const mockJoinRoom = vi.fn<
    (params: JoinCollaborationRoom) => Promise<CollaborationResponse>
>();
const mockLeaveRoom = vi.fn<
    (roomId: string) => Promise<CollaborationResponse>
>();
const mockSendUpdate = vi.fn<
    (params: CollaborationSyncUpdate) => Promise<CollaborationResponse>
>();
const mockOnSyncUpdate = vi.fn<
    (callback: (payload: { roomId: string; data: string }) => void) => () => void
>();
const mockOnError = vi.fn<
    (callback: (payload: { roomId: string; error: string }) => void) => () => void
>();

describe('IpcProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockJoinRoom.mockResolvedValue({ success: true });
        mockLeaveRoom.mockResolvedValue({ success: true });
        mockSendUpdate.mockResolvedValue({ success: true });
        mockOnSyncUpdate.mockImplementation(() => () => undefined);
        mockOnError.mockImplementation(() => () => undefined);

        const base = window.electron ?? webElectronMock;
        window.electron = {
            ...base,
            userCollaboration: {
                ...base.userCollaboration,
                joinRoom: mockJoinRoom,
                leaveRoom: mockLeaveRoom,
                sendUpdate: mockSendUpdate,
                onSyncUpdate: mockOnSyncUpdate,
                onError: mockOnError,
            },
        };
    });

    it('normalizes legacy workspace room aliases to canonical rooms', async () => {
        const provider = new IpcProvider(WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR, 'workspace-1', new Y.Doc());

        await waitFor(() => {
            expect(mockJoinRoom).toHaveBeenCalledWith({
                type: WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE,
                id: 'workspace-1',
            });
        });

        provider.destroy();

        expect(mockLeaveRoom).toHaveBeenCalledWith('workspace:workspace-1');
    });
});
