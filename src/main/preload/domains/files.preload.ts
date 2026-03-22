import { FileEntry, ServiceResponse } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

type FileListResponse = ServiceResponse<FileEntry[]>;
type FileReadResponse = ServiceResponse<string>;
type FileWriteResponse = { success: boolean; error?: string };
type FileExistsResponse = { success: boolean; data: boolean; error?: string };
type SearchFilesResponse = { success: boolean; results: string[]; error?: string };

export interface FilesBridge {
    // Basic operations (mostly used by the 'files' sub-object in original preload)
    listDirectory: (path: string) => Promise<FileListResponse>;
    readFile: (path: string) => Promise<FileReadResponse>;
    readImage: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (
        path: string,
        content: string,
        context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
    ) => Promise<FileWriteResponse>;
    exists: (path: string) => Promise<FileExistsResponse>;

    // Extended operations (mostly top-level in original preload)
    readPdf: (path: string) => Promise<string>;
    selectDirectory: () => Promise<string | null>;
    selectFile: (options?: {
        title?: string;
        filters?: { name: string; extensions: string[] }[];
    }) => Promise<string | null>;
    createDirectory: (path: string) => Promise<FileWriteResponse>;
    deleteFile: (path: string) => Promise<FileWriteResponse>;
    deleteDirectory: (path: string) => Promise<FileWriteResponse>;
    copyPath: (sourcePath: string, destinationPath: string) => Promise<FileWriteResponse>;
    renamePath: (oldPath: string, newPath: string) => Promise<FileWriteResponse>;
    searchFiles: (rootPath: string, pattern: string) => Promise<SearchFilesResponse>;
    searchFilesStream: (
        rootPath: string,
        pattern: string,
        onResult: (path: string) => void,
        onComplete?: () => void
    ) => () => void;
    saveFile: (content: string, filename: string) => Promise<FileWriteResponse>;
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
        writeFile: (
            path: string,
            content: string,
            context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
        ) => ipc.invoke('files:writeFile', path, content, context),
        exists: (path: string) => ipc.invoke('files:exists', path),
        readPdf: (path: string) => ipc.invoke('files:readPdf', path),
        selectDirectory: () => ipc.invoke('files:selectDirectory'),
        selectFile: (options) => ipc.invoke('files:selectFile', options),
        createDirectory: (path: string) => ipc.invoke('files:createDirectory', path),
        deleteFile: (path: string) => ipc.invoke('files:deleteFile', path),
        deleteDirectory: (path: string) => ipc.invoke('files:deleteDirectory', path),
        copyPath: (sourcePath: string, destinationPath: string) =>
            ipc.invoke('files:copyPath', sourcePath, destinationPath),
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

            void ipc.invoke('files:searchFilesStream', rootPath, pattern, jobId).catch(() => {
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
