/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LOCALE_CHANNELS } from '@shared/constants/ipc-channels';
import { LocalePack } from '@shared/types/locale';
import { IpcRenderer } from 'electron';

export interface LocaleBridge {
    getAll: () => Promise<LocalePack[]>;
    onRuntimeUpdated: (callback: () => void) => () => void;
}

export function createLocaleBridge(ipc: IpcRenderer): LocaleBridge {
    return {
        getAll: () => ipc.invoke(LOCALE_CHANNELS.RUNTIME_GET_ALL),
        onRuntimeUpdated: callback => {
            const listener = () => callback();
            ipc.on(LOCALE_CHANNELS.RUNTIME_UPDATED, listener);
            return () => ipc.removeListener(LOCALE_CHANNELS.RUNTIME_UPDATED, listener);
        },
    };
}

