import { resolve } from 'path';

import { appLogger } from '@main/logging/logger';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { AISystemType } from '@shared/types/file-diff';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { z } from 'zod';

/** Maximum path length */
const MAX_PATH_LENGTH = 4096;
/** Maximum content size for write operations (50MB) */
const MAX_CONTENT_SIZE = 50 * 1024 * 1024;
/** Maximum search pattern length */
const MAX_PATTERN_LENGTH = 256;
/** Maximum job ID length */
const MAX_JOB_ID_LENGTH = 64;

// --- Schemas ---

const PathSchema = z.string().min(1).max(MAX_PATH_LENGTH).trim();
const ContentSchema = z.string().max(MAX_CONTENT_SIZE);
const PatternSchema = z.string().min(1).max(MAX_PATTERN_LENGTH).trim();
const JobIdSchema = z.string().min(1).max(MAX_JOB_ID_LENGTH).regex(/^[\w-]+$/).trim();

const WriteContextSchema = z.object({
    aiSystem: z.string().optional(),
    chatSessionId: z.string().optional(),
    changeReason: z.string().optional(),
}).optional();

/**
 * Registers IPC handlers for file system operations
 */
export function registerFilesIpc(
    getMainWindow: () => BrowserWindow | null,
    fileSystemService: FileSystemService,
    allowedRoots: Set<string>
): void {
    appLogger.info('FilesIPC', 'Registering files IPC handlers');

    ipcMain.handle('files:exists', createValidatedIpcHandler('files:exists', async (_event, filePath: string) => {
        const result = await fileSystemService.fileExists(filePath);
        return { success: true, data: result.exists };
    }, {
        defaultValue: { success: true, data: false },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:selectDirectory', createValidatedIpcHandler('files:selectDirectory', async () => {
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
    }, { defaultValue: { success: false } }));

    ipcMain.handle('files:listDirectory', createValidatedIpcHandler('files:listDirectory', async (_event, dirPath: string) => {
        return await fileSystemService.listDirectory(dirPath);
    }, {
        defaultValue: { success: false, data: [] },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:readFile', createValidatedIpcHandler('files:readFile', async (_event, filePath: string) => {
        return await fileSystemService.readFile(filePath);
    }, {
        defaultValue: { success: false, content: '' },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:readImage', createValidatedIpcHandler('files:readImage', async (_event, filePath: string) => {
        return await fileSystemService.readImage(filePath);
    }, {
        defaultValue: { success: false, data: '' },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:writeFile', createValidatedIpcHandler('files:writeFile', async (_event, filePath: string, content: string, context?: z.infer<typeof WriteContextSchema>) => {
        if (context?.aiSystem) {
            return await fileSystemService.writeFileWithTracking(filePath, content, {
                aiSystem: context.aiSystem as AISystemType,
                chatSessionId: context.chatSessionId,
                changeReason: context.changeReason ?? 'AI file modification',
            });
        }
        return await fileSystemService.writeFile(filePath, content);
    }, {
        defaultValue: { success: false, error: 'Write failed' },
        argsSchema: z.tuple([PathSchema, ContentSchema, WriteContextSchema])
    }));

    ipcMain.handle('files:createDirectory', createValidatedIpcHandler('files:createDirectory', async (_event, dirPath: string) => {
        return await fileSystemService.createDirectory(dirPath);
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:deleteFile', createValidatedIpcHandler('files:deleteFile', async (_event, filePath: string) => {
        return await fileSystemService.deleteFile(filePath);
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:deleteDirectory', createValidatedIpcHandler('files:deleteDirectory', async (_event, dirPath: string) => {
        return await fileSystemService.deleteDirectory(dirPath);
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:renamePath', createValidatedIpcHandler('files:renamePath', async (_event, oldPath: string, newPath: string) => {
        return await fileSystemService.moveFile(oldPath, newPath);
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema, PathSchema])
    }));

    ipcMain.handle('files:searchFiles', createValidatedIpcHandler('files:searchFiles', async (_event, dirPath: string, pattern: string) => {
        const result = await fileSystemService.searchFiles(dirPath, pattern);
        return { success: result.success, results: result.data ?? [] };
    }, {
        defaultValue: { success: false, results: [] },
        argsSchema: z.tuple([PathSchema, PatternSchema])
    }));

    ipcMain.handle('files:searchFilesStream', createValidatedIpcHandler('files:searchFilesStream', async (event, dirPath: string, pattern: string, jobId: string) => {
        return await fileSystemService.searchFilesStream(dirPath, pattern, (foundPath: string) => {
            event.sender.send(`files:searchResult:${jobId}`, foundPath);
        });
    }, {
        defaultValue: undefined,
        argsSchema: z.tuple([PathSchema, PatternSchema, JobIdSchema])
    }));

    ipcMain.handle('app:getUserDataPath', createValidatedIpcHandler('app:getUserDataPath', async () => {
        const { app } = await import('electron');
        return { success: true, path: resolve(app.getPath('userData')) };
    }, { defaultValue: { success: false, path: '' } }));
}
