import {
    CollaborationResponseSchema,
    CollaborationSyncUpdateSchema,
    JoinCollaborationRoomSchema} from '@shared/schemas/collaboration.schema';
import { IpcRenderer } from 'electron';
import { z } from 'zod';

export interface UserCollaborationBridge {
    joinRoom: (request: z.infer<typeof JoinCollaborationRoomSchema>) => Promise<z.infer<typeof CollaborationResponseSchema>>;
    sendUpdate: (request: z.infer<typeof CollaborationSyncUpdateSchema>) => Promise<z.infer<typeof CollaborationResponseSchema>>;
    leaveRoom: (roomId: string) => Promise<z.infer<typeof CollaborationResponseSchema>>;

    // Event listeners
    onJoined: (callback: (payload: { roomId: string }) => void) => () => void;
    onLeft: (callback: (payload: { roomId: string }) => void) => () => void;
    onSyncUpdate: (callback: (payload: { roomId: string, data: string }) => void) => () => void;
    onError: (callback: (payload: { roomId: string, error: string }) => void) => () => void;
}

export function createUserCollaborationBridge(ipc: IpcRenderer): UserCollaborationBridge {
    return {
        joinRoom: request => ipc.invoke('collaboration:sync:join', request),
        sendUpdate: request => ipc.invoke('collaboration:sync:send', request),
        leaveRoom: roomId => ipc.invoke('collaboration:sync:leave', roomId),

        onJoined: callback => {
            const listener = (_: unknown, payload: { roomId: string }) => callback(payload);
            ipc.on('collaboration:sync:joined', listener);
            return () => ipc.removeListener('collaboration:sync:joined', listener);
        },
        onLeft: callback => {
            const listener = (_: unknown, payload: { roomId: string }) => callback(payload);
            ipc.on('collaboration:sync:left', listener);
            return () => ipc.removeListener('collaboration:sync:left', listener);
        },
        onSyncUpdate: callback => {
            const listener = (_: unknown, payload: { roomId: string, data: string }) => callback(payload);
            ipc.on('collaboration:sync:update', listener);
            return () => ipc.removeListener('collaboration:sync:update', listener);
        },
        onError: callback => {
            const listener = (_: unknown, payload: { roomId: string, error: string }) => callback(payload);
            ipc.on('collaboration:sync:error', listener);
            return () => ipc.removeListener('collaboration:sync:error', listener);
        }
    };
}
