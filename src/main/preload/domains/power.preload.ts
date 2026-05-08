/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { POWER_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface PowerBridge {
    onStateChanged: (callback: (state: { lowPowerMode: boolean }) => void) => () => void;
}

export function createPowerBridge(ipc: IpcRenderer): PowerBridge {
    return {
        onStateChanged: callback => {
            const listener = (_event: unknown, state: { lowPowerMode: boolean }) => callback(state);
            ipc.on(POWER_CHANNELS.STATE_CHANGED, listener);
            return () => ipc.removeListener(POWER_CHANNELS.STATE_CHANGED, listener);
        },
    };
}

