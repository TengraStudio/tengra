/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MODEL_DOWNLOADER_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface ModelDownloaderBridge {
    start: (request: RuntimeValue) => Promise<{ downloadId: string; success: boolean }>;
    pause: (downloadId: string) => Promise<{ success: boolean }>;
    resume: (downloadId: string) => Promise<{ success: boolean }>;
    cancel: (downloadId: string) => Promise<{ success: boolean }>;
    history: (limit?: number) => Promise<{
        success: boolean;
        items: Array<{
            id: string;
            downloadId: string;
            provider: string;
            modelRef: string;
            status: string;
            message?: string;
            outputPath?: string;
            received?: number;
            total?: number;
            startedAt: number;
            updatedAt: number;
            endedAt?: number;
        }>;
    }>;
    retry: (historyId: string) => Promise<{ success: boolean; downloadId?: string; error?: string }>;
}

export function createModelDownloaderBridge(ipc: IpcRenderer): ModelDownloaderBridge {
    return {
        start: request => ipc.invoke(MODEL_DOWNLOADER_CHANNELS.START, request),
        pause: downloadId => ipc.invoke(MODEL_DOWNLOADER_CHANNELS.PAUSE, downloadId),
        resume: downloadId => ipc.invoke(MODEL_DOWNLOADER_CHANNELS.RESUME, downloadId),
        cancel: downloadId => ipc.invoke(MODEL_DOWNLOADER_CHANNELS.CANCEL, downloadId),
        history: (limit = 100) => ipc.invoke(MODEL_DOWNLOADER_CHANNELS.HISTORY, limit),
        retry: historyId => ipc.invoke(MODEL_DOWNLOADER_CHANNELS.RETRY, historyId),
    };
}

