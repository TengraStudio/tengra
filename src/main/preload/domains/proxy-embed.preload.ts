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
        start: options => ipc.invoke('proxy-embed:start', options),
        stop: () => ipc.invoke('proxy-embed:stop'),
        getStatus: () => ipc.invoke('proxy-embed:status'),
    };
}
