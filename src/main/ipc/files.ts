import { resolve } from 'path';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { createValidatedIpcHandler as baseCreateValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { AISystemType } from '@shared/types/file-diff';
import { BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
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
    allowedRoots: Set<string>,
    auditLogService?: AuditLogService
): void {
    appLogger.info('FilesIPC', 'Registering files IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'file operation');
    const isResultSuccessful = (result: unknown): boolean => {
        if (typeof result !== 'object' || result === null) {
            return true;
        }
        if ('success' in result) {
            const success = (result as { success?: unknown }).success;
            return typeof success === 'boolean' ? success : true;
        }
        if ('exists' in result) {
            const exists = (result as { exists?: unknown }).exists;
            return typeof exists === 'boolean' ? exists : true;
        }
        return true;
    };
    const auditFileOperation = async (action: string, targetPath: string | undefined, result: unknown) => {
        await auditLogService?.logFileSystemOperation(action, isResultSuccessful(result), {
            targetPath,
        });
    };
    const runWithFileAudit = async <T>(
        action: string,
        targetPath: string | undefined,
        operation: () => Promise<T>
    ): Promise<T> => {
        const result = await operation();
        await auditFileOperation(action, targetPath, result);
        return result;
    };

    const createValidatedIpcHandler = <T, Args extends unknown[] = unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
        options: Parameters<typeof baseCreateValidatedIpcHandler<T, Args>>[2]
    ) => baseCreateValidatedIpcHandler<T, Args>(channel, async (event, ...args) => {
        validateSender(event);
        return await handler(event, ...args);
    }, options);

    ipcMain.handle('files:exists', createValidatedIpcHandler('files:exists', async (_event, filePath: string) => {
        const result = await runWithFileAudit('files.exists', filePath, async () => {
            return await fileSystemService.fileExists(filePath);
        });
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

        await auditFileOperation('files.selectDirectory', chosenPath, { success: !!chosenPath });

        return { success: true, path: chosenPath };
    }, { defaultValue: { success: false } }));

    ipcMain.handle('files:listDirectory', createValidatedIpcHandler('files:listDirectory', async (_event, dirPath: string) => {
        return await runWithFileAudit('files.listDirectory', dirPath, async () => {
            return await fileSystemService.listDirectory(dirPath);
        });
    }, {
        defaultValue: { success: false, data: [] },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:readFile', createValidatedIpcHandler('files:readFile', async (_event, filePath: string) => {
        return await runWithFileAudit('files.readFile', filePath, async () => {
            return await fileSystemService.readFile(filePath);
        });
    }, {
        defaultValue: { success: false, content: '' },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:readImage', createValidatedIpcHandler('files:readImage', async (_event, filePath: string) => {
        return await runWithFileAudit('files.readImage', filePath, async () => {
            return await fileSystemService.readImage(filePath);
        });
    }, {
        defaultValue: { success: false, data: '' },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:writeFile', createValidatedIpcHandler('files:writeFile', async (_event, filePath: string, content: string, context?: z.infer<typeof WriteContextSchema>) => {
        if (context?.aiSystem) {
            return await runWithFileAudit('files.writeFileWithTracking', filePath, async () => {
                return await fileSystemService.writeFileWithTracking(filePath, content, {
                    aiSystem: context.aiSystem as AISystemType,
                    chatSessionId: context.chatSessionId,
                    changeReason: context.changeReason ?? 'AI file modification',
                });
            });
        }
        return await runWithFileAudit('files.writeFile', filePath, async () => {
            return await fileSystemService.writeFile(filePath, content);
        });
    }, {
        defaultValue: { success: false, error: 'Write failed' },
        argsSchema: z.tuple([PathSchema, ContentSchema, WriteContextSchema])
    }));

    ipcMain.handle('files:createDirectory', createValidatedIpcHandler('files:createDirectory', async (_event, dirPath: string) => {
        return await runWithFileAudit('files.createDirectory', dirPath, async () => {
            return await fileSystemService.createDirectory(dirPath);
        });
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:deleteFile', createValidatedIpcHandler('files:deleteFile', async (_event, filePath: string) => {
        return await runWithFileAudit('files.deleteFile', filePath, async () => {
            return await fileSystemService.deleteFile(filePath);
        });
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:deleteDirectory', createValidatedIpcHandler('files:deleteDirectory', async (_event, dirPath: string) => {
        return await runWithFileAudit('files.deleteDirectory', dirPath, async () => {
            return await fileSystemService.deleteDirectory(dirPath);
        });
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:renamePath', createValidatedIpcHandler('files:renamePath', async (_event, oldPath: string, newPath: string) => {
        return await runWithFileAudit('files.renamePath', `${oldPath} -> ${newPath}`, async () => {
            return await fileSystemService.moveFile(oldPath, newPath);
        });
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema, PathSchema])
    }));

    ipcMain.handle('files:searchFiles', createValidatedIpcHandler('files:searchFiles', async (_event, dirPath: string, pattern: string) => {
        const result = await runWithFileAudit('files.searchFiles', dirPath, async () => {
            return await fileSystemService.searchFiles(dirPath, pattern);
        });
        return { success: result.success, results: result.data ?? [] };
    }, {
        defaultValue: { success: false, results: [] },
        argsSchema: z.tuple([PathSchema, PatternSchema])
    }));

    ipcMain.handle('files:searchFilesStream', createValidatedIpcHandler('files:searchFilesStream', async (event, dirPath: string, pattern: string, jobId: string) => {
        return await runWithFileAudit('files.searchFilesStream', dirPath, async () => {
            return await fileSystemService.searchFilesStream(dirPath, pattern, (foundPath: string) => {
                event.sender.send(`files:searchResult:${jobId}`, foundPath);
            });
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
