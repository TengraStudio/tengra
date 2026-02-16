import { resolve } from 'path';

import { appLogger } from '@main/logging/logger';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { AISystemType } from '@shared/types/file-diff';
import { app, BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum path length */
const MAX_PATH_LENGTH = 4096;
/** Maximum content size for write operations (50MB) */
const MAX_CONTENT_SIZE = 50 * 1024 * 1024;
/** Maximum search pattern length */
const MAX_PATTERN_LENGTH = 256;
/** Maximum job ID length */
const MAX_JOB_ID_LENGTH = 64;

interface WriteFileContext {
    aiSystem?: string;
    chatSessionId?: string;
    changeReason?: string;
}

/**
 * Validates a path string
 */
function validatePath(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PATH_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates content for write operations
 */
function validateContent(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    if (value.length > MAX_CONTENT_SIZE) {
        return null;
    }
    return value;
}

/**
 * Validates a search pattern
 */
function validatePattern(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PATTERN_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a job ID
 */
function validateJobId(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_JOB_ID_LENGTH) {
        return null;
    }
    // Only allow alphanumeric, dash, underscore
    if (!/^[\w-]+$/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

/**
 * Parses write file context
 */
function parseWriteContext(value: unknown): WriteFileContext | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const raw = value as Record<string, unknown>;
    const context: WriteFileContext = {};

    if (typeof raw.aiSystem === 'string' && raw.aiSystem.trim()) {
        context.aiSystem = raw.aiSystem.trim();
    }
    if (typeof raw.chatSessionId === 'string' && raw.chatSessionId.trim()) {
        context.chatSessionId = raw.chatSessionId.trim();
    }
    if (typeof raw.changeReason === 'string' && raw.changeReason.trim()) {
        context.changeReason = raw.changeReason.trim();
    }

    return Object.keys(context).length > 0 ? context : undefined;
}

/**
 * Registers IPC handlers for file system operations
 */
export function registerFilesIpc(
    getMainWindow: () => BrowserWindow | null,
    fileSystemService: FileSystemService,
    allowedRoots: Set<string>
): void {
    appLogger.info('FilesIPC', 'Registering files IPC handlers');

    ipcMain.handle(
        'files:exists',
        createSafeIpcHandler(
            'files:exists',
            async (_event: IpcMainInvokeEvent, filePathRaw: unknown) => {
                const filePath = validatePath(filePathRaw);
                if (!filePath) {
                    throw new Error('Invalid file path');
                }
                const result = await fileSystemService.fileExists(filePath);
                return { success: true, data: result.exists };
            },
            { success: true, data: false }
        )
    );

    ipcMain.handle(
        'files:selectDirectory',
        createSafeIpcHandler(
            'files:selectDirectory',
            async () => {
                const win = getMainWindow();
                if (!win) {
                    return { success: false, error: 'Window not found' };
                }

                const result = await dialog.showOpenDialog(win, {
                    properties: ['openDirectory'],
                });

                if (result.canceled) {
                    return { success: false };
                }

                const chosenPath = result.filePaths[0];
                if (chosenPath) {
                    allowedRoots.add(resolve(chosenPath));
                    fileSystemService.updateAllowedRoots(Array.from(allowedRoots));
                }

                return { success: true, path: chosenPath };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'files:listDirectory',
        createSafeIpcHandler(
            'files:listDirectory',
            async (_event: IpcMainInvokeEvent, dirPathRaw: unknown) => {
                const dirPath = validatePath(dirPathRaw);
                if (!dirPath) {
                    throw new Error('Invalid directory path');
                }
                return await fileSystemService.listDirectory(dirPath);
            },
            { success: false, data: [] }
        )
    );

    ipcMain.handle(
        'files:readFile',
        createSafeIpcHandler(
            'files:readFile',
            async (_event: IpcMainInvokeEvent, filePathRaw: unknown) => {
                const filePath = validatePath(filePathRaw);
                if (!filePath) {
                    throw new Error('Invalid file path');
                }
                return await fileSystemService.readFile(filePath);
            },
            { success: false, content: '' }
        )
    );

    ipcMain.handle(
        'files:readImage',
        createSafeIpcHandler(
            'files:readImage',
            async (_event: IpcMainInvokeEvent, filePathRaw: unknown) => {
                const filePath = validatePath(filePathRaw);
                if (!filePath) {
                    throw new Error('Invalid file path');
                }
                return await fileSystemService.readImage(filePath);
            },
            { success: false, data: '' }
        )
    );

    ipcMain.handle(
        'files:writeFile',
        createIpcHandler(
            'files:writeFile',
            async (
                _event: IpcMainInvokeEvent,
                filePathRaw: unknown,
                contentRaw: unknown,
                contextRaw?: unknown
            ) => {
                const filePath = validatePath(filePathRaw);
                if (!filePath) {
                    throw new Error('Invalid file path');
                }

                const content = validateContent(contentRaw);
                if (content === null) {
                    throw new Error('Invalid content or content exceeds maximum size');
                }

                const context = parseWriteContext(contextRaw);

                if (context?.aiSystem) {
                    return await fileSystemService.writeFileWithTracking(filePath, content, {
                        aiSystem: context.aiSystem as AISystemType,
                        chatSessionId: context.chatSessionId,
                        changeReason: context.changeReason ?? 'AI file modification',
                    });
                } else {
                    return await fileSystemService.writeFile(filePath, content);
                }
            }
        )
    );

    ipcMain.handle(
        'files:createDirectory',
        createIpcHandler(
            'files:createDirectory',
            async (_event: IpcMainInvokeEvent, dirPathRaw: unknown) => {
                const dirPath = validatePath(dirPathRaw);
                if (!dirPath) {
                    throw new Error('Invalid directory path');
                }
                return await fileSystemService.createDirectory(dirPath);
            }
        )
    );

    ipcMain.handle(
        'files:deleteFile',
        createIpcHandler(
            'files:deleteFile',
            async (_event: IpcMainInvokeEvent, filePathRaw: unknown) => {
                const filePath = validatePath(filePathRaw);
                if (!filePath) {
                    throw new Error('Invalid file path');
                }
                return await fileSystemService.deleteFile(filePath);
            }
        )
    );

    ipcMain.handle(
        'files:deleteDirectory',
        createIpcHandler(
            'files:deleteDirectory',
            async (_event: IpcMainInvokeEvent, dirPathRaw: unknown) => {
                const dirPath = validatePath(dirPathRaw);
                if (!dirPath) {
                    throw new Error('Invalid directory path');
                }
                return await fileSystemService.deleteDirectory(dirPath);
            }
        )
    );

    ipcMain.handle(
        'files:renamePath',
        createIpcHandler(
            'files:renamePath',
            async (_event: IpcMainInvokeEvent, oldPathRaw: unknown, newPathRaw: unknown) => {
                const oldPath = validatePath(oldPathRaw);
                const newPath = validatePath(newPathRaw);
                if (!oldPath || !newPath) {
                    throw new Error('Invalid path');
                }
                return await fileSystemService.moveFile(oldPath, newPath);
            }
        )
    );

    ipcMain.handle(
        'files:searchFiles',
        createSafeIpcHandler(
            'files:searchFiles',
            async (_event: IpcMainInvokeEvent, rootPathRaw: unknown, patternRaw: unknown) => {
                const rootPath = validatePath(rootPathRaw);
                const pattern = validatePattern(patternRaw);
                if (!rootPath || !pattern) {
                    throw new Error('Invalid search parameters');
                }
                return await fileSystemService.searchFiles(rootPath, pattern);
            },
            { success: false, data: [] }
        )
    );

    ipcMain.handle(
        'files:searchFilesStream',
        createSafeIpcHandler(
            'files:searchFilesStream',
            async (_event: IpcMainInvokeEvent, rootPathRaw: unknown, patternRaw: unknown, jobIdRaw: unknown) => {
                const win = getMainWindow();
                if (!win) {
                    return { success: false, error: 'Window not found' };
                }

                const rootPath = validatePath(rootPathRaw);
                const pattern = validatePattern(patternRaw);
                const jobId = validateJobId(jobIdRaw);

                if (!rootPath || !pattern || !jobId) {
                    throw new Error('Invalid search parameters');
                }

                void fileSystemService
                    .searchFilesStream(rootPath, pattern, filePath => {
                        if (!win.isDestroyed()) {
                            win.webContents.send(`files:search-result:${jobId}`, filePath);
                        }
                    })
                    .then(() => {
                        if (!win.isDestroyed()) {
                            win.webContents.send(`files:search-complete:${jobId}`);
                        }
                    })
                    .catch((err: Error) => {
                        appLogger.error('FilesIPC', `File search failed: ${err.message}`);
                    });

                return { success: true, jobId };
            },
            { success: false, jobId: '' }
        )
    );

    ipcMain.handle(
        'app:getUserDataPath',
        createSafeIpcHandler(
            'app:getUserDataPath',
            async () => {
                return app.getPath('userData');
            },
            ''
        )
    );
}
