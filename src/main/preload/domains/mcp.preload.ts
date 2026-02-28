import { MCPServerConfig } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface McpBridge {
    list: () => Promise<unknown[]>;
    dispatch: (service: string, action: string, args: unknown) => Promise<unknown>;
    toggle: (service: string, enabled: boolean) => Promise<void>;
    install: (config: MCPServerConfig) => Promise<void>;
    uninstall: (name: string) => Promise<void>;
    getDebugMetrics: () => Promise<Record<string, unknown>>;
    listPermissionRequests: () => Promise<unknown[]>;
    setActionPermission: (service: string, action: string, policy: unknown) => Promise<void>;
    resolvePermissionRequest: (requestId: string, decision: unknown) => Promise<void>;
    onResult: (callback: (result: unknown) => void) => void;
    removeResultListener: () => void;
}

export function createMcpBridge(ipc: IpcRenderer): McpBridge {
    return {
        list: () => ipc.invoke('mcp:list'),
        dispatch: (service, action, args) =>
            ipc.invoke('mcp:dispatch', { service, action, args }),
        toggle: (service, enabled) => ipc.invoke('mcp:toggle', { service, enabled }),
        install: config => ipc.invoke('mcp:install', config),
        uninstall: name => ipc.invoke('mcp:uninstall', name),
        getDebugMetrics: () => ipc.invoke('mcp:debug-metrics'),
        listPermissionRequests: () => ipc.invoke('mcp:permissions:list-requests'),
        setActionPermission: (service, action, policy) =>
            ipc.invoke('mcp:permissions:set', service, action, policy),
        resolvePermissionRequest: (requestId, decision) =>
            ipc.invoke('mcp:permissions:resolve-request', requestId, decision),
        onResult: callback => ipc.on('mcp:result', (_event, result) => callback(result)),
        removeResultListener: () => ipc.removeAllListeners('mcp:result'),
    };
}
