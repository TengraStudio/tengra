/**
 * Tengra - Your Personal AI Assistant
 */

import { LIVE_COLLABORATION_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface LiveCollaborationBridge {
    sendUpdate: (request: { roomId: string; data: string }) => Promise<void>;
    onSyncUpdate: (callback: (payload: { roomId: string; data: string }) => void) => () => void;
    joinRoom: (request: { roomId: string; userId: string }) => Promise<void>;
}

export function createLiveCollaborationBridge(ipc: IpcRenderer): LiveCollaborationBridge {
    return {
        sendUpdate: request => ipc.invoke(LIVE_COLLABORATION_CHANNELS.SEND_UPDATE, request),
        joinRoom: request => ipc.invoke(LIVE_COLLABORATION_CHANNELS.JOIN_ROOM, request),
        onSyncUpdate: callback => {
            const listener = (_event: IpcRendererEvent, payload: { roomId: string; data: string }) => {
                callback(payload);
            };
            ipc.on(LIVE_COLLABORATION_CHANNELS.SYNC_UPDATE, listener);
            return () => ipc.removeListener(LIVE_COLLABORATION_CHANNELS.SYNC_UPDATE, listener);
        },
    };
}

