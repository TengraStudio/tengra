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
const mockOnJoined = vi.fn<
    (callback: (payload: { roomId: string }) => void) => () => void
>();
const mockOnLeft = vi.fn<
    (callback: (payload: { roomId: string }) => void) => () => void
>();
const mockOnError = vi.fn<
    (callback: (payload: { roomId: string; error: string }) => void) => () => void
>();

type JoinedListener = (payload: { roomId: string }) => void;

describe('IpcProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockJoinRoom.mockResolvedValue({ success: true });
        mockLeaveRoom.mockResolvedValue({ success: true });
        mockSendUpdate.mockResolvedValue({ success: true });
        mockOnSyncUpdate.mockImplementation(() => () => undefined);
        mockOnJoined.mockImplementation(() => () => undefined);
        mockOnLeft.mockImplementation(() => () => undefined);
        mockOnError.mockImplementation(() => () => undefined);

        const base = window.electron ?? webElectronMock;
        window.electron = {
            ...base,
            liveCollaboration: {
                ...base.liveCollaboration,
                joinRoom: mockJoinRoom,
                leaveRoom: mockLeaveRoom,
                sendUpdate: mockSendUpdate,
                onJoined: mockOnJoined,
                onLeft: mockOnLeft,
                onSyncUpdate: mockOnSyncUpdate,
                onError: mockOnError,
            },
            userCollaboration: {
                ...base.userCollaboration,
                joinRoom: mockJoinRoom,
                leaveRoom: mockLeaveRoom,
                sendUpdate: mockSendUpdate,
                onJoined: mockOnJoined,
                onLeft: mockOnLeft,
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

    it('does not send document updates before the room join is confirmed', async () => {
        const joinedListenerRef: { current: JoinedListener | null } = { current: null };
        mockOnJoined.mockImplementation(callback => {
            joinedListenerRef.current = callback;
            return () => undefined;
        });

        const doc = new Y.Doc();
        const provider = new IpcProvider(
            WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE,
            'workspace-1',
            doc
        );

        await waitFor(() => {
            expect(mockJoinRoom).toHaveBeenCalled();
        });

        doc.getText('content').insert(0, 'hello');
        await new Promise(resolve => window.setTimeout(resolve, 0));
        expect(mockSendUpdate).not.toHaveBeenCalled();

        if (!joinedListenerRef.current) {
            throw new Error('Expected joined listener to be registered');
        }
        const emitJoined: JoinedListener = joinedListenerRef.current;
        emitJoined({ roomId: 'workspace:workspace-1' });

        doc.getText('content').insert(5, ' world');
        await waitFor(() => {
            expect(mockSendUpdate).toHaveBeenCalledTimes(1);
        });

        provider.destroy();
    });
});
