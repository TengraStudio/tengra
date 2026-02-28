import { FileEntry } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface FilesBridge {
    // Basic operations (mostly used by the 'files' sub-object in original preload)
    listDirectory: (path: string) => Promise<FileEntry[]>;
    readFile: (path: string) => Promise<string>;
    readImage: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (
        path: string,
        content: string,
        context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
    ) => Promise<void>;
    exists: (path: string) => Promise<boolean>;

    // Extended operations (mostly top-level in original preload)
    readPdf: (path: string) => Promise<string>;
    selectDirectory: () => Promise<string | null>;
    selectFile: (options?: {
        title?: string;
        filters?: { name: string; extensions: string[] }[];
    }) => Promise<string | null>;
    createDirectory: (path: string) => Promise<void>;
    deleteFile: (path: string) => Promise<void>;
    deleteDirectory: (path: string) => Promise<void>;
    renamePath: (oldPath: string, newPath: string) => Promise<void>;
    searchFiles: (rootPath: string, pattern: string) => Promise<string[]>;
    searchFilesStream: (
        rootPath: string,
        pattern: string,
        onResult: (path: string) => void,
        onComplete?: () => void
    ) => () => void;
    saveFile: (content: string, filename: string) => Promise<void>;
    exportChatToPdf: (chatId: string, title: string) => Promise<{
        success: boolean;
        path?: string;
        error?: string;
    }>;
}

export function createFilesBridge(ipc: IpcRenderer): FilesBridge {
    return {
        listDirectory: (path: string) => ipc.invoke('files:listDirectory', path),
        readFile: (path: string) => ipc.invoke('files:readFile', path),
        readImage: (path: string) => ipc.invoke('files:readImage', path),
        writeFile: (path: string, content: string) => ipc.invoke('files:writeFile', path, content),
        exists: (path: string) => ipc.invoke('files:exists', path),
        readPdf: (path: string) => ipc.invoke('files:readPdf', path),
        selectDirectory: () => ipc.invoke('files:selectDirectory'),
        selectFile: (options) => ipc.invoke('files:selectFile', options),
        createDirectory: (path: string) => ipc.invoke('files:createDirectory', path),
        deleteFile: (path: string) => ipc.invoke('files:deleteFile', path),
        deleteDirectory: (path: string) => ipc.invoke('files:deleteDirectory', path),
        renamePath: (oldPath: string, newPath: string) => ipc.invoke('files:renamePath', oldPath, newPath),
        searchFiles: (rootPath: string, pattern: string) => ipc.invoke('files:searchFiles', rootPath, pattern),
        searchFilesStream: (rootPath, pattern, onResult, onComplete) => {
            const jobId = Math.random().toString(36).substring(7);
            const listener = (_event: IpcRendererEvent, path: string) => onResult(path);
            const completeListener = () => {
                ipc.removeListener(`files:searchResult:${jobId}`, listener);
                ipc.removeListener(`files:searchComplete:${jobId}`, completeListener);
                if (onComplete) { onComplete(); }
            };
            ipc.on(`files:searchResult:${jobId}`, listener);
            ipc.on(`files:searchComplete:${jobId}`, completeListener);

            ipc.invoke('files:searchFilesStream', rootPath, pattern, jobId).catch(err => {
                console.error('Search stream failed:', err);
                completeListener();
            });

            return () => {
                ipc.removeListener(`files:searchResult:${jobId}`, listener);
                ipc.removeListener(`files:searchComplete:${jobId}`, completeListener);
            };
        },
        saveFile: (content: string, filename: string) => ipc.invoke('files:saveFile', content, filename),
        exportChatToPdf: (chatId: string, title: string) => ipc.invoke('files:exportChatToPdf', chatId, title),
    };
}
