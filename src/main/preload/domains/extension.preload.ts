/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IpcRenderer } from 'electron';

export interface ExtensionBridge {
    shouldShowWarning: () => Promise<boolean>;
    dismissWarning: () => Promise<void>;
    getStatus: () => Promise<{ installed: boolean }>;
    setInstalled: (installed: boolean) => Promise<void>;
    getAll: () => Promise<RuntimeValue[]>;
    get: (extensionId: string) => Promise<RuntimeValue | null>;
    install: (extensionPath: string) => Promise<{ success: boolean; extensionId?: string; error?: string }>;
    uninstall: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    activate: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    deactivate: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    devStart: (options: Record<string, RuntimeValue>) => Promise<{ success: boolean; extensionId?: string; error?: string }>;
    devStop: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    devReload: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
    test: (options: Record<string, RuntimeValue>) => Promise<RuntimeValue>;
    publish: (options: Record<string, RuntimeValue>) => Promise<RuntimeValue>;
    getProfile: (extensionId: string) => Promise<RuntimeValue | null>;
    getState: (extensionId: string) => Promise<RuntimeValue | null>;
    validate: (manifest: Record<string, RuntimeValue>) => Promise<{ valid: boolean; errors: string[] }>;
    getConfig: (extensionId: string) => Promise<{ success: boolean; config?: Record<string, RuntimeValue>; error?: string }>;
    updateConfig: (extensionId: string, config: Record<string, RuntimeValue>) => Promise<{ success: boolean; config?: Record<string, RuntimeValue>; error?: string }>;
}

export function createExtensionBridge(ipc: IpcRenderer): ExtensionBridge {
    return {
        shouldShowWarning: () => ipc.invoke('extension:shouldShowWarning'),
        dismissWarning: () => ipc.invoke('extension:dismissWarning'),
        getStatus: () => ipc.invoke('extension:getStatus'),
        setInstalled: installed =>
            ipc.invoke('extension:setInstalled', installed),
        getAll: () => ipc.invoke('extension:get-all'),
        get: extensionId => ipc.invoke('extension:get', extensionId),
        install: extensionPath => ipc.invoke('extension:install', extensionPath),
        uninstall: extensionId => ipc.invoke('extension:uninstall', extensionId),
        activate: extensionId => ipc.invoke('extension:activate', extensionId),
        deactivate: extensionId => ipc.invoke('extension:deactivate', extensionId),
        devStart: options => ipc.invoke('extension:dev-start', options),
        devStop: extensionId => ipc.invoke('extension:dev-stop', extensionId),
        devReload: extensionId => ipc.invoke('extension:dev-reload', extensionId),
        test: options => ipc.invoke('extension:test', options),
        publish: options => ipc.invoke('extension:publish', options),
        getProfile: extensionId => ipc.invoke('extension:get-profile', extensionId),
        getState: extensionId => ipc.invoke('extension:get-state', extensionId),
        validate: manifest => ipc.invoke('extension:validate', manifest),
        getConfig: extensionId => ipc.invoke('extension:get-config', extensionId),
        updateConfig: (extensionId, config) => ipc.invoke('extension:update-config', extensionId, config),
    };
}
