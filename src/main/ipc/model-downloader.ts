import { appLogger } from '@main/logging/logger';
import {
    ModelDownloaderService,
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

    appLogger.info('ModelDownloaderIPC', 'Registered model-downloader IPC handlers');
}
