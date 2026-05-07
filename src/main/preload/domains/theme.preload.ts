/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { THEME_CHANNELS } from '@shared/constants/ipc-channels';
import { ThemeManifest } from '@shared/types/theme';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface ThemeBridge {
    getAll: () => Promise<ThemeManifest[]>;
    getCurrent: () => Promise<string>;
    set: (themeId: string) => Promise<boolean>;
    runtime: {
        getAll: () => Promise<ThemeManifest[]>;
        install: (manifest: ThemeManifest) => Promise<boolean>;
        uninstall: (themeId: string) => Promise<boolean>;
        openDirectory: () => Promise<boolean>;
    };
    onRuntimeUpdated: (callback: () => void) => () => void;
}

export function createThemeBridge(ipc: IpcRenderer): ThemeBridge {
    return {
        getAll: () => ipc.invoke(THEME_CHANNELS.GET_ALL),
        getCurrent: () => ipc.invoke(THEME_CHANNELS.GET_CURRENT),
        set: (themeId: string) => ipc.invoke(THEME_CHANNELS.SET, themeId),
        runtime: {
            getAll: () => ipc.invoke(THEME_CHANNELS.RUNTIME_GET_ALL),
            install: (manifest: ThemeManifest) => ipc.invoke(THEME_CHANNELS.RUNTIME_INSTALL, manifest),
            uninstall: (themeId: string) => ipc.invoke(THEME_CHANNELS.RUNTIME_UNINSTALL, themeId),
            openDirectory: () => ipc.invoke(THEME_CHANNELS.RUNTIME_OPEN_DIRECTORY),
        },
        onRuntimeUpdated: (callback: () => void) => {
            const listener = () => callback();
            ipc.on(THEME_CHANNELS.RUNTIME_UPDATED, listener);
            return () => ipc.removeListener(THEME_CHANNELS.RUNTIME_UPDATED, listener);
        },
    };
}

