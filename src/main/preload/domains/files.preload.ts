/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FILES_CHANNELS } from '@shared/constants/ipc-channels';
import { FileEntry, ServiceResponse } from '@shared/types';
import { FileDiff } from '@shared/types/file-diff';
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
    readPdf: (path: string) => Promise<{ success: boolean; text?: string; error?: string }>;
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
    revertFileChange: (diffId: string) => Promise<{ success: boolean; error?: string }>;
    getFileDiff: (diffId: string) => Promise<{ success: boolean; data?: FileDiff; error?: string }>;
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
    const invalidPathResponse = (path: string | undefined): FileListResponse => ({
        success: false,
        data: [],
        error: `Invalid path for listDirectory: ${typeof path}`,
    });

    return {
        listDirectory: (path: string) => {
            if (typeof path !== 'string' || path.trim().length === 0) {
                return Promise.resolve(invalidPathResponse(path));
            }
            return ipc.invoke(FILES_CHANNELS.LIST_DIRECTORY, path);
        },
        readFile: (path: string) => ipc.invoke(FILES_CHANNELS.READ_FILE, path),
        readImage: (path: string) => ipc.invoke(FILES_CHANNELS.READ_IMAGE, path),
        writeFile: (
            path: string,
            content: string,
            context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
        ) => ipc.invoke(FILES_CHANNELS.WRITE_FILE, path, content, context),
        exists: (path: string) => ipc.invoke(FILES_CHANNELS.EXISTS, path),
        readPdf: (path: string) => ipc.invoke(FILES_CHANNELS.READ_PDF, path),
        selectDirectory: () => ipc.invoke(FILES_CHANNELS.SELECT_DIRECTORY),
        selectFile: (options) => ipc.invoke(FILES_CHANNELS.SELECT_FILE, options),
        createDirectory: (path: string) => ipc.invoke(FILES_CHANNELS.CREATE_DIRECTORY, path),
        deleteFile: (path: string) => ipc.invoke(FILES_CHANNELS.DELETE_FILE, path),
        deleteDirectory: (path: string) => ipc.invoke(FILES_CHANNELS.DELETE_DIRECTORY, path),
        copyPath: (sourcePath: string, destinationPath: string) =>
            ipc.invoke(FILES_CHANNELS.COPY_PATH, sourcePath, destinationPath),
        renamePath: (oldPath: string, newPath: string) => ipc.invoke(FILES_CHANNELS.RENAME_PATH, oldPath, newPath),
        searchFiles: (rootPath: string, pattern: string) => ipc.invoke(FILES_CHANNELS.SEARCH_FILES, rootPath, pattern),
        revertFileChange: (diffId: string) => ipc.invoke(FILES_CHANNELS.REVERT_FILE_CHANGE, diffId),
        getFileDiff: (diffId: string) => ipc.invoke(FILES_CHANNELS.GET_FILE_DIFF, diffId),
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

            void ipc.invoke(FILES_CHANNELS.SEARCH_FILES_STREAM, rootPath, pattern, jobId).catch(() => {
                completeListener();
            });

            return () => {
                ipc.removeListener(`files:searchResult:${jobId}`, listener);
                ipc.removeListener(`files:searchComplete:${jobId}`, completeListener);
            };
        },
        saveFile: (content: string, filename: string) => ipc.invoke(FILES_CHANNELS.SAVE_FILE, content, filename),
        exportChatToPdf: (chatId: string, title: string) => ipc.invoke(FILES_CHANNELS.EXPORT_CHAT_TO_PDF, chatId, title),
    };
}

