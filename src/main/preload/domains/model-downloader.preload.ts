import { IpcRenderer } from 'electron';

export interface ModelDownloaderBridge {
    start: (request: unknown) => Promise<{ downloadId: string; success: boolean }>;
    pause: (downloadId: string) => Promise<{ success: boolean }>;
    resume: (downloadId: string) => Promise<{ success: boolean }>;
    cancel: (downloadId: string) => Promise<{ success: boolean }>;
}

export function createModelDownloaderBridge(ipc: IpcRenderer): ModelDownloaderBridge {
    return {
        start: request => ipc.invoke('model-downloader:start', request),
        pause: downloadId => ipc.invoke('model-downloader:pause', downloadId),
        resume: downloadId => ipc.invoke('model-downloader:resume', downloadId),
        cancel: downloadId => ipc.invoke('model-downloader:cancel', downloadId),
    };
}
