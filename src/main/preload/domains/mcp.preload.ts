/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MCPServerConfig } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface McpBridge {
    list: () => Promise<RuntimeValue[]>;
    dispatch: (service: string, action: string, args: RuntimeValue) => Promise<RuntimeValue>;
    toggle: (service: string, enabled: boolean) => Promise<void>;
    install: (config: MCPServerConfig) => Promise<void>;
    uninstall: (name: string) => Promise<void>;
    getDebugMetrics: () => Promise<Record<string, RuntimeValue>>;
    listPermissionRequests: () => Promise<RuntimeValue[]>;
    setActionPermission: (service: string, action: string, policy: RuntimeValue) => Promise<void>;
    resolvePermissionRequest: (requestId: string, decision: RuntimeValue) => Promise<void>;
    onResult: (callback: (result: RuntimeValue) => void) => void;
    removeResultListener: () => void;
}

export function createMcpBridge(ipc: IpcRenderer): McpBridge {
    return {
        list: () => ipc.invoke('mcp:list'),
        dispatch: (service, action, args) =>
            ipc.invoke('mcp:dispatch', service, action, args),
        toggle: (service, enabled) => ipc.invoke('mcp:toggle', service, enabled),
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
