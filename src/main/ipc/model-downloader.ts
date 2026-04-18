/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import {
    ModelDownloaderService,
    ModelDownloadHistoryEntry,
    type ModelDownloadProgress,
    ModelDownloadRequest} from '@main/services/llm/model-downloader.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

export function registerModelDownloaderIpc(modelDownloaderService: ModelDownloaderService): void {
    modelDownloaderService.subscribeProgress((progress: ModelDownloadProgress) => {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (!win.isDestroyed()) {
                win.webContents.send('model-downloader:progress', progress);
            }
        }
    });
    void modelDownloaderService.restorePersistedQueue();

    ipcMain.handle(
        'model-downloader:start',
        createSafeIpcHandler(
            'model-downloader:start',
            async (_event: IpcMainInvokeEvent, requestRaw: RuntimeValue) => {
                const request = requestRaw as ModelDownloadRequest;
                const result = modelDownloaderService.startDownload(request);
                return result;
            },
            { success: false, provider: 'ollama', modelRef: '', error: 'Invalid request' }
        )
    );

    ipcMain.handle(
        'model-downloader:pause',
        createSafeIpcHandler(
            'model-downloader:pause',
            async (_event: IpcMainInvokeEvent, downloadIdRaw: RuntimeValue) => {
                const downloadId = typeof downloadIdRaw === 'string' ? downloadIdRaw : '';
                return { success: modelDownloaderService.pauseDownload(downloadId) };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'model-downloader:cancel',
        createSafeIpcHandler(
            'model-downloader:cancel',
            async (_event: IpcMainInvokeEvent, downloadIdRaw: RuntimeValue) => {
                const downloadId = typeof downloadIdRaw === 'string' ? downloadIdRaw : '';
                return { success: modelDownloaderService.cancelDownload(downloadId) };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'model-downloader:resume',
        createSafeIpcHandler(
            'model-downloader:resume',
            async (_event: IpcMainInvokeEvent, downloadIdRaw: RuntimeValue) => {
                const downloadId = typeof downloadIdRaw === 'string' ? downloadIdRaw : '';
                return modelDownloaderService.resumeDownload(downloadId);
            },
            { success: false, provider: 'ollama', modelRef: '', error: 'Invalid request' }
        )
    );

    ipcMain.handle(
        'model-downloader:history',
        createSafeIpcHandler(
            'model-downloader:history',
            async (_event: IpcMainInvokeEvent, limitRaw: RuntimeValue) => {
                const limit = typeof limitRaw === 'number' ? limitRaw : 100;
                const items: ModelDownloadHistoryEntry[] = modelDownloaderService.getHistory(limit);
                return { success: true, items };
            },
            { success: false, items: [] }
        )
    );

    ipcMain.handle(
        'model-downloader:retry',
        createSafeIpcHandler(
            'model-downloader:retry',
            async (_event: IpcMainInvokeEvent, historyIdRaw: RuntimeValue) => {
                const historyId = typeof historyIdRaw === 'string' ? historyIdRaw : '';
                return modelDownloaderService.retryFromHistory(historyId);
            },
            { success: false, provider: 'ollama', modelRef: '', error: 'Invalid history id' }
        )
    );

    appLogger.info('ModelDownloaderIPC', 'Registered model-downloader IPC handlers');
}
