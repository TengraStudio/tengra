import { IpcRenderer } from 'electron';

export interface GalleryBridge {
    list: () => Promise<{ name: string; path: string; url: string; mtime: number }[]>;
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
        list: () => ipc.invoke('gallery:list'),
        delete: path => ipc.invoke('gallery:delete', path),
        open: path => ipc.invoke('gallery:open', path),
        reveal: path => ipc.invoke('gallery:reveal', path),
        batchDownload: input => ipc.invoke('gallery:batch-download', input),
    };
}
