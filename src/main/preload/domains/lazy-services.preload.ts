/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LAZY_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface LazyServicesBridge {
    getStatus: () => Promise<{
        registered: string[];
        loaded: string[];
        loading: string[];
        totals: {
            registered: number;
            loaded: number;
            loading: number;
        };
    }>;
}

export function createLazyServicesBridge(ipc: IpcRenderer): LazyServicesBridge {
    return {
        getStatus: () => ipc.invoke(LAZY_CHANNELS.GET_STATUS),
    };
}

