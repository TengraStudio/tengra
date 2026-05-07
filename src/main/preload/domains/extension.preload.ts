/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EXTENSION_CHANNELS } from '@shared/constants/ipc-channels';
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
    onLogUpdate: (callback: (log: any) => void) => () => void;
}

export function createExtensionBridge(ipc: IpcRenderer): ExtensionBridge {
    return {
        shouldShowWarning: () => ipc.invoke(EXTENSION_CHANNELS.SHOULD_SHOW_WARNING),
        dismissWarning: () => ipc.invoke(EXTENSION_CHANNELS.DISMISS_WARNING),
        getStatus: () => ipc.invoke(EXTENSION_CHANNELS.GET_STATUS),
        setInstalled: installed =>
            ipc.invoke(EXTENSION_CHANNELS.SET_INSTALLED, installed),
        getAll: () => ipc.invoke(EXTENSION_CHANNELS.GET_ALL),
        get: extensionId => ipc.invoke(EXTENSION_CHANNELS.GET, extensionId),
        install: extensionPath => ipc.invoke(EXTENSION_CHANNELS.INSTALL, extensionPath),
        uninstall: extensionId => ipc.invoke(EXTENSION_CHANNELS.UNINSTALL, extensionId),
        activate: extensionId => ipc.invoke(EXTENSION_CHANNELS.ACTIVATE, extensionId),
        deactivate: extensionId => ipc.invoke(EXTENSION_CHANNELS.DEACTIVATE, extensionId),
        devStart: options => ipc.invoke(EXTENSION_CHANNELS.DEV_START, options),
        devStop: extensionId => ipc.invoke(EXTENSION_CHANNELS.DEV_STOP, extensionId),
        devReload: extensionId => ipc.invoke(EXTENSION_CHANNELS.DEV_RELOAD, extensionId),
        test: options => ipc.invoke(EXTENSION_CHANNELS.TEST, options),
        publish: options => ipc.invoke(EXTENSION_CHANNELS.PUBLISH, options),
        getProfile: extensionId => ipc.invoke(EXTENSION_CHANNELS.GET_PROFILE, extensionId),
        getState: extensionId => ipc.invoke(EXTENSION_CHANNELS.GET_STATE, extensionId),
        validate: manifest => ipc.invoke(EXTENSION_CHANNELS.VALIDATE, manifest),
        getConfig: extensionId => ipc.invoke(EXTENSION_CHANNELS.GET_CONFIG, extensionId),
        updateConfig: (extensionId, config) => ipc.invoke(EXTENSION_CHANNELS.UPDATE_CONFIG, extensionId, config),
        onLogUpdate: callback => {
            const listener = (_event: any, log: any) => callback(log);
            ipc.on(EXTENSION_CHANNELS.LOG_UPDATE, listener);
            return () => ipc.removeListener(EXTENSION_CHANNELS.LOG_UPDATE, listener);
        },
    };
}

