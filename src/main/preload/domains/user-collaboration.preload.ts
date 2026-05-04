/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    CollaborationResponseSchema,
    CollaborationSyncUpdateSchema,
    JoinCollaborationRoomSchema} from '@shared/schemas/collaboration.schema';
import { IpcRenderer, IpcRendererEvent } from 'electron';
import { z } from 'zod';

export interface LiveCollaborationBridge {
    joinRoom: (request: z.infer<typeof JoinCollaborationRoomSchema>) => Promise<z.infer<typeof CollaborationResponseSchema>>;
    sendUpdate: (request: z.infer<typeof CollaborationSyncUpdateSchema>) => Promise<z.infer<typeof CollaborationResponseSchema>>;
    leaveRoom: (roomId: string) => Promise<z.infer<typeof CollaborationResponseSchema>>;

    // Event listeners
    onJoined: (callback: (payload: { roomId: string }) => void) => () => void;
    onLeft: (callback: (payload: { roomId: string }) => void) => () => void;
    onSyncUpdate: (callback: (payload: { roomId: string, data: string | Uint8Array }) => void) => () => void;
    onError: (callback: (payload: { roomId: string, error: string }) => void) => () => void;
}

export function createLiveCollaborationBridge(ipc: IpcRenderer): LiveCollaborationBridge {
    return {
        joinRoom: request => ipc.invoke('collaboration:sync:join', request),
        sendUpdate: request => ipc.invoke('collaboration:sync:send', request),
        leaveRoom: roomId => ipc.invoke('collaboration:sync:leave', roomId),

        onJoined: callback => {
            const listener = (_: RuntimeValue, payload: { roomId: string }) => callback(payload);
            ipc.on('collaboration:sync:joined', listener);
            return () => ipc.removeListener('collaboration:sync:joined', listener);
        },
        onLeft: callback => {
            const listener = (_: RuntimeValue, payload: { roomId: string }) => callback(payload);
            ipc.on('collaboration:sync:left', listener);
            return () => ipc.removeListener('collaboration:sync:left', listener);
        },
        onSyncUpdate: callback => {
            const listener = (_: IpcRendererEvent, payload: { roomId: string, data: string | Uint8Array }) => callback(payload);
            ipc.on('collaboration:sync:update', listener);
            return () => ipc.removeListener('collaboration:sync:update', listener);
        },
        onError: callback => {
            const listener = (_: RuntimeValue, payload: { roomId: string, error: string }) => callback(payload);
            ipc.on('collaboration:sync:error', listener);
            return () => ipc.removeListener('collaboration:sync:error', listener);
        }
    };
}

export const createUserCollaborationBridge = createLiveCollaborationBridge;
