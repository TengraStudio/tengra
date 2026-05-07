/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { PROXY_EMBED_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface ProxyEmbedBridge {
    start: (options?: {
        port?: number;
    }) => Promise<{ success: boolean; port?: number; error?: string }>;
    stop: () => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<{
        isRunning: boolean;
        port?: number;
        uptime?: number;
        totalRequests?: number;
        activeConnections?: number;
    }>;
}

export function createProxyEmbedBridge(ipc: IpcRenderer): ProxyEmbedBridge {
    return {
        start: options => ipc.invoke(PROXY_EMBED_CHANNELS.START, options),
        stop: () => ipc.invoke(PROXY_EMBED_CHANNELS.STOP),
        getStatus: () => ipc.invoke(PROXY_EMBED_CHANNELS.STATUS),
    };
}

