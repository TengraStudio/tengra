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

export interface ImageStudioBridge {
    generate: (payload: any) => Promise<any>;
    edit: (payload: any) => Promise<any>;
    save: (payload: any) => Promise<any>;
}

export function createImageStudioBridge(ipc: IpcRenderer): ImageStudioBridge {
    return {
        generate: (payload) => ipc.invoke('image-studio:generate', payload),
        edit: (payload) => ipc.invoke('image-studio:edit', payload),
        save: (payload) => ipc.invoke('image-studio:save', payload),
    };
}
