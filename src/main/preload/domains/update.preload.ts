/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { UPDATE_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcValue } from '@shared/types/common';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface UpdateBridge {
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    onStatus: (callback: (status: IpcValue) => void) => () => void;
}

export function createUpdateBridge(ipc: IpcRenderer): UpdateBridge {
    return {
        checkForUpdates: () => ipc.invoke(UPDATE_CHANNELS.CHECK),
        downloadUpdate: () => ipc.invoke(UPDATE_CHANNELS.DOWNLOAD),
        installUpdate: () => ipc.invoke(UPDATE_CHANNELS.INSTALL),
        onStatus: (callback: (status: IpcValue) => void) => {
            const listener = (_event: IpcRendererEvent, status: IpcValue) => callback(status);
            ipc.on(UPDATE_CHANNELS.STATUS, listener);
            return () => ipc.removeListener(UPDATE_CHANNELS.STATUS, listener);
        },
    };
}

