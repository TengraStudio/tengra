/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { GALLERY_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface GalleryBridge {
    list: () => Promise<{
        name: string;
        path: string;
        url: string;
        mtime: number;
        type: 'image' | 'video';
        metadata?: {
            prompt?: string;
            negative_prompt?: string;
            seed?: number;
            steps?: number;
            cfg_scale?: number;
            width?: number;
            height?: number;
            model?: string;
            created_at?: number;
        };
    }[]>;
    delete: (path: string) => Promise<boolean>;
    open: (path: string) => Promise<boolean>;
    reveal: (path: string) => Promise<boolean>;
    batchDownload: (input: {
        filePaths: string[];
        targetDirectory: string;
    }) => Promise<{
        success: boolean;
        copied: number;
        skipped: number;
        errors: string[];
    }>;
}

export function createGalleryBridge(ipc: IpcRenderer): GalleryBridge {
    return {
        list: () => ipc.invoke(GALLERY_CHANNELS.LIST),
        delete: path => ipc.invoke(GALLERY_CHANNELS.DELETE, path),
        open: path => ipc.invoke(GALLERY_CHANNELS.OPEN, path),
        reveal: path => ipc.invoke(GALLERY_CHANNELS.REVEAL, path),
        batchDownload: input => ipc.invoke(GALLERY_CHANNELS.BATCH_DOWNLOAD, input),
    };
}

