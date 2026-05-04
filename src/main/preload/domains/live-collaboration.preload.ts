/**
 * Tengra - Your Personal AI Assistant
 */

import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface LiveCollaborationBridge {
    sendUpdate: (request: { roomId: string; data: string }) => Promise<void>;
    onSyncUpdate: (callback: (payload: { roomId: string; data: string }) => void) => () => void;
    joinRoom: (request: { roomId: string; userId: string }) => Promise<void>;
}

export function createLiveCollaborationBridge(ipc: IpcRenderer): LiveCollaborationBridge {
    return {
        sendUpdate: request => ipc.invoke('live-collaboration:send-update', request),
        joinRoom: request => ipc.invoke('live-collaboration:join-room', request),
        onSyncUpdate: callback => {
            const listener = (_event: IpcRendererEvent, payload: { roomId: string; data: string }) => {
                callback(payload);
            };
            ipc.on('live-collaboration:sync-update', listener);
            return () => ipc.removeListener('live-collaboration:sync-update', listener);
        },
    };
}
