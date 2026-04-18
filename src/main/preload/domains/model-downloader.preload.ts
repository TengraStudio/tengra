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
        start: request => ipc.invoke('model-downloader:start', request),
        pause: downloadId => ipc.invoke('model-downloader:pause', downloadId),
        resume: downloadId => ipc.invoke('model-downloader:resume', downloadId),
        cancel: downloadId => ipc.invoke('model-downloader:cancel', downloadId),
        history: (limit = 100) => ipc.invoke('model-downloader:history', limit),
        retry: historyId => ipc.invoke('model-downloader:retry', historyId),
    };
}
