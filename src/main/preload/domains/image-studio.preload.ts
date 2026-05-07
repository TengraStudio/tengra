/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IMAGE_STUDIO_CHANNELS } from '@shared/constants/ipc-channels';
import type { RuntimeValue } from '@shared/types/common';
import { IpcRenderer } from 'electron';

interface ImageStudioGeneratePayload {
    prompt: string;
    modelId: string;
    count?: number;
    width?: number;
    height?: number;
}

interface ImageStudioEditPayload {
    contextImage?: string;
    sourceImage: string;
    maskImage: string;
    prompt: string;
    mode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer';
    strength?: number;
    modelId: string;
}

interface ImageStudioSavePayload {
    image: string;
    prompt?: string;
    modelId?: string;
    width?: number;
    height?: number;
}

export interface ImageStudioBridge {
    generate: (payload: ImageStudioGeneratePayload) => Promise<RuntimeValue>;
    edit: (payload: ImageStudioEditPayload) => Promise<RuntimeValue>;
    save: (payload: ImageStudioSavePayload) => Promise<RuntimeValue>;
    loadSettings: () => Promise<RuntimeValue>;
    saveSettings: (settings: string) => Promise<RuntimeValue>;
}

export function createImageStudioBridge(ipc: IpcRenderer): ImageStudioBridge {
    return {
        generate: (payload) => ipc.invoke(IMAGE_STUDIO_CHANNELS.GENERATE, payload),
        edit: (payload) => ipc.invoke(IMAGE_STUDIO_CHANNELS.EDIT, payload),
        save: (payload) => ipc.invoke(IMAGE_STUDIO_CHANNELS.SAVE, payload),
        loadSettings: () => ipc.invoke(IMAGE_STUDIO_CHANNELS.LOAD_SETTINGS),
        saveSettings: (settings) => ipc.invoke(IMAGE_STUDIO_CHANNELS.SAVE_SETTINGS, settings),
    };
}

