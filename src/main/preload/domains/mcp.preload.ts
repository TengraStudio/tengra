/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MCP_CHANNELS, MCP_PERMISSIONS_CHANNELS } from '@shared/constants/ipc-channels';
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
        list: () => ipc.invoke(MCP_CHANNELS.LIST),
        dispatch: (service, action, args) =>
            ipc.invoke(MCP_CHANNELS.DISPATCH, service, action, args),
        toggle: (service, enabled) => ipc.invoke(MCP_CHANNELS.TOGGLE, service, enabled),
        install: config => ipc.invoke(MCP_CHANNELS.INSTALL, config),
        uninstall: name => ipc.invoke(MCP_CHANNELS.UNINSTALL, name),
        getDebugMetrics: () => ipc.invoke(MCP_CHANNELS.DEBUG_METRICS),
        listPermissionRequests: () => ipc.invoke(MCP_PERMISSIONS_CHANNELS.LIST_REQUESTS),
        setActionPermission: (service, action, policy) =>
            ipc.invoke(MCP_PERMISSIONS_CHANNELS.SET, service, action, policy),
        resolvePermissionRequest: (requestId, decision) =>
            ipc.invoke(MCP_PERMISSIONS_CHANNELS.RESOLVE_REQUEST, requestId, decision),
        onResult: callback => ipc.on(MCP_CHANNELS.RESULT, (_event, result) => callback(result)),
        removeResultListener: () => ipc.removeAllListeners(MCP_CHANNELS.RESULT),
    };
}

