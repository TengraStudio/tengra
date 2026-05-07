/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DIALOG_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface DialogBridge {
    selectDirectory: () => Promise<{ success: boolean; path?: string; error?: string }>;
    showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<{ success: boolean; filePaths?: string[]; path?: string; error?: string }>;
    saveFile: (options: { filename: string; content: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
}

export function createDialogBridge(ipc: IpcRenderer): DialogBridge {
    return {
        selectDirectory: () => ipc.invoke(DIALOG_CHANNELS.SELECT_DIRECTORY),
        showOpenDialog: (options) => ipc.invoke(DIALOG_CHANNELS.SHOW_OPEN_DIALOG, options),
        saveFile: (options) => ipc.invoke(DIALOG_CHANNELS.SAVE_FILE, options),
    };
}

