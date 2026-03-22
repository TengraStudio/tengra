import { resolve } from 'path';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { createValidatedIpcHandler as baseCreateValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
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
    aiSystem: z.enum(['chat', 'workspace', 'council']).optional(),
    chatSessionId: z.string().optional(),
    changeReason: z.string().optional(),
}).optional();

const FILE_IPC_ERROR_CODE = {
    VALIDATION: 'FILES_VALIDATION_ERROR',
    OPERATION_FAILED: 'FILES_OPERATION_FAILED',
} as const;
const FILE_MESSAGE_KEY = {
    OPERATION_FAILED: 'errors.files.operationFailed',
    VALIDATION_FAILED: 'errors.files.validationFailed',
    WRITE_FAILED: 'errors.files.writeFailed',
    SEARCH_FAILED: 'errors.files.searchFailed',
    WINDOW_NOT_FOUND: 'mainProcess.files.windowNotFound'
} as const;
const FILE_ERROR_MESSAGE = {
    WINDOW_NOT_FOUND: 'Window not found',
    WRITE_FAILED: 'Write failed'
} as const;
const FILE_PERFORMANCE_BUDGET_MS = {
    EXISTS: 30,
    WRITE: 120,
    SEARCH: 200
} as const;
const MAX_FILE_TELEMETRY_EVENTS = 200;
const AUDITED_FILE_ACTIONS = new Set([
    'files.selectDirectory',
    'files.selectFile',
    'files.writeFileWithTracking',
    'files.writeFile',
    'files.createDirectory',
    'files.deleteFile',
    'files.deleteDirectory',
    'files.copyPath',
    'files.renamePath',
]);

type ErrorCodePayload = { errorCode?: string; messageKey?: string; uiState?: string };
type ExistsResponse = { success: boolean; data: boolean; errorCode?: string; messageKey?: string; uiState?: string };
type WriteFileResponse = { success: boolean; error?: string; errorCode?: string; messageKey?: string; uiState?: string };
type SearchFilesResponse = { success: boolean; results: string[]; errorCode?: string; messageKey?: string; uiState?: string };

/**
 * Registers IPC handlers for file system operations
 */
export function registerFilesIpc(
    getMainWindow: () => BrowserWindow | null,
    fileSystemService: FileSystemService,
    allowedRoots: Set<string>,
    auditLogService?: AuditLogService
): void {
    appLogger.debug('FilesIPC', 'Registering files IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'file operation');
    const fileTelemetry = {
        totalCalls: 0,
        totalFailures: 0,
        validationFailures: 0,
        budgetExceededCount: 0,
        lastErrorCode: '' as string | null,
        channels: {} as Record<string, {
            calls: number;
            failures: number;
            validationFailures: number;
            lastDurationMs: number;
            budgetExceededCount: number;
        }>,
        events: [] as Array<{ channel: string; event: string; timestamp: number; durationMs?: number; code?: string }>
    };
    const getChannelMetric = (channel: string) => {
        if (!fileTelemetry.channels[channel]) {
            fileTelemetry.channels[channel] = {
                calls: 0,
                failures: 0,
                validationFailures: 0,
                lastDurationMs: 0,
                budgetExceededCount: 0
            };
        }
        return fileTelemetry.channels[channel];
    };
    const trackFileEvent = (channel: string, event: string, details: { durationMs?: number; code?: string } = {}) => {
        fileTelemetry.events = [...fileTelemetry.events, {
            channel,
            event,
            timestamp: Date.now(),
            durationMs: details.durationMs,
            code: details.code
        }].slice(-MAX_FILE_TELEMETRY_EVENTS);
    };
    const getBudgetForChannel = (channel: string): number => {
        if (channel === 'files:exists') {
            return FILE_PERFORMANCE_BUDGET_MS.EXISTS;
        }
        if (channel === 'files:writeFile') {
            return FILE_PERFORMANCE_BUDGET_MS.WRITE;
        }
        if (channel === 'files:searchFiles') {
            return FILE_PERFORMANCE_BUDGET_MS.SEARCH;
        }
        return FILE_PERFORMANCE_BUDGET_MS.SEARCH;
    };
    const trackSuccessMetrics = (channel: string, durationMs: number) => {
        const channelMetric = getChannelMetric(channel);
        fileTelemetry.totalCalls += 1;
        channelMetric.calls += 1;
        channelMetric.lastDurationMs = durationMs;
        const budgetMs = getBudgetForChannel(channel);
        if (durationMs > budgetMs) {
            fileTelemetry.budgetExceededCount += 1;
            channelMetric.budgetExceededCount += 1;
        }
        trackFileEvent(channel, 'success', { durationMs });
    };
    const trackFailureMetrics = (channel: string, code: string, eventName: 'failure' | 'validation-failure') => {
        const channelMetric = getChannelMetric(channel);
        fileTelemetry.totalCalls += 1;
        fileTelemetry.totalFailures += 1;
        channelMetric.calls += 1;
        channelMetric.failures += 1;
        fileTelemetry.lastErrorCode = code;
        if (eventName === 'validation-failure') {
            fileTelemetry.validationFailures += 1;
            channelMetric.validationFailures += 1;
        }
        trackFileEvent(channel, eventName, { code });
    };
    const getFilesHealthSummary = () => {
        const errorRate = fileTelemetry.totalCalls === 0 ? 0 : fileTelemetry.totalFailures / fileTelemetry.totalCalls;
        const status = errorRate > 0.05 || fileTelemetry.budgetExceededCount > 0 ? 'degraded' : 'healthy';
        return {
            status,
            uiState: status === 'healthy' ? 'ready' : 'failure',
            budgets: {
                existsMs: FILE_PERFORMANCE_BUDGET_MS.EXISTS,
                writeMs: FILE_PERFORMANCE_BUDGET_MS.WRITE,
                searchMs: FILE_PERFORMANCE_BUDGET_MS.SEARCH
            },
            metrics: {
                ...fileTelemetry,
                errorRate
            }
        };
    };

    const isResultSuccessful = (result: RuntimeValue): boolean => {
        if (typeof result !== 'object' || result === null) {
            return true;
        }
        if ('success' in result) {
            const success = (result as { success?: RuntimeValue }).success;
            return typeof success === 'boolean' ? success : true;
        }
        if ('exists' in result) {
            const exists = (result as { exists?: RuntimeValue }).exists;
            return typeof exists === 'boolean' ? exists : true;
        }
        return true;
    };
    const auditFileOperation = async (action: string, targetPath: string | undefined, result: RuntimeValue) => {
        if (!auditLogService || !AUDITED_FILE_ACTIONS.has(action)) {
            return;
        }
        await auditLogService?.logFileSystemOperation(action, isResultSuccessful(result), {
            targetPath,
        });
    };
    const runWithFileAudit = async <T extends RuntimeValue>(
        action: string,
        targetPath: string | undefined,
        operation: () => Promise<T>
    ): Promise<T> => {
        const result = await operation();
        await auditFileOperation(action, targetPath, result);
        return result;
    };
    const withDefaultErrorCode = <TDefault extends RuntimeValue>(defaultValue: TDefault, error: Error): TDefault => {
        if (typeof defaultValue !== 'object' || defaultValue === null) {
            return defaultValue;
        }
        if (!Object.prototype.hasOwnProperty.call(defaultValue, 'errorCode')) {
            return defaultValue;
        }

        const isValidationFailure = error instanceof z.ZodError;
        const errorCode = isValidationFailure
            ? FILE_IPC_ERROR_CODE.VALIDATION
            : FILE_IPC_ERROR_CODE.OPERATION_FAILED;
        const messageKey = isValidationFailure
            ? FILE_MESSAGE_KEY.VALIDATION_FAILED
            : FILE_MESSAGE_KEY.OPERATION_FAILED;

        const payload = defaultValue as ErrorCodePayload;
        return {
            ...payload,
            errorCode,
            messageKey,
            uiState: 'failure'
        } as TDefault;
    };

    const createValidatedIpcHandler = <T extends RuntimeValue, Args extends RuntimeValue[] = RuntimeValue[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
        options: Parameters<typeof baseCreateValidatedIpcHandler<T, Args>>[2]
    ) => baseCreateValidatedIpcHandler<T, Args>(channel, async (event, ...args) => {
        validateSender(event);
        const startedAt = Date.now();
        const result = await handler(event, ...args);
        const durationMs = Date.now() - startedAt;
        trackSuccessMetrics(channel, durationMs);
        return result;
    }, {
        ...options,
        onError: (error, _handlerName) => {
            const isValidationFailure = error instanceof z.ZodError;
            trackFailureMetrics(
                channel,
                isValidationFailure ? FILE_IPC_ERROR_CODE.VALIDATION : FILE_IPC_ERROR_CODE.OPERATION_FAILED,
                isValidationFailure ? 'validation-failure' : 'failure'
            );
            if (options?.onError) {
                return options.onError(error, _handlerName);
            }
            const hasDefaultValue = options !== undefined && Object.prototype.hasOwnProperty.call(options, 'defaultValue');
            if (hasDefaultValue) {
                return withDefaultErrorCode(options.defaultValue as T, error);
            }
            throw error;
        },
        onValidationFailed: () => {
            trackFileEvent(channel, 'validation-callback', {
                code: FILE_IPC_ERROR_CODE.VALIDATION
            });
            appLogger.warn('FilesIPC', `[${channel}] validation failed`);
        }
    });

    ipcMain.handle('files:exists', createValidatedIpcHandler<ExistsResponse, [string]>('files:exists', async (_event, filePath: string) => {
        const result = await runWithFileAudit('files.exists', filePath, async () => {
            return await fileSystemService.fileExists(filePath);
        });
        return {
            success: true,
            data: result.exists,
            uiState: result.exists ? 'ready' : 'empty'
        };
    }, {
        defaultValue: {
            success: true,
            data: false,
            errorCode: FILE_IPC_ERROR_CODE.OPERATION_FAILED,
            messageKey: FILE_MESSAGE_KEY.OPERATION_FAILED,
            uiState: 'failure'
        },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('files:selectDirectory', createValidatedIpcHandler('files:selectDirectory', async () => {
        const win = getMainWindow();
        if (!win) {
            return {
                success: false,
                error: FILE_ERROR_MESSAGE.WINDOW_NOT_FOUND,
                messageKey: FILE_MESSAGE_KEY.WINDOW_NOT_FOUND
            };
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

    ipcMain.handle('files:selectFile', createValidatedIpcHandler('files:selectFile', async (_event, options?: { title?: string, filters?: { name: string, extensions: string[] }[] }) => {
        const win = getMainWindow();
        if (!win) {
            return {
                success: false,
                error: FILE_ERROR_MESSAGE.WINDOW_NOT_FOUND,
                messageKey: FILE_MESSAGE_KEY.WINDOW_NOT_FOUND
            };
        }

        const result = await dialog.showOpenDialog(win, {
            title: options?.title,
            filters: options?.filters,
            properties: ['openFile', 'showHiddenFiles'],
        });

        if (result.canceled) {
            return { success: false };
        }

        const chosenPath = result.filePaths[0];
        if (chosenPath) {
            allowedRoots.add(resolve(chosenPath));
            fileSystemService.updateAllowedRoots(Array.from(allowedRoots));
        }

        await auditFileOperation('files.selectFile', chosenPath, { success: !!chosenPath });

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

    ipcMain.handle('files:writeFile', createValidatedIpcHandler<WriteFileResponse, [string, string, z.infer<typeof WriteContextSchema>]>(
        'files:writeFile',
        async (_event, filePath: string, content: string, context?: z.infer<typeof WriteContextSchema>) => {
        const aiSystem = context?.aiSystem;
        if (aiSystem) {
            const trackedResult = await runWithFileAudit('files.writeFileWithTracking', filePath, async () => {
                return await fileSystemService.writeFileWithTracking(filePath, content, {
                    aiSystem,
                    chatSessionId: context.chatSessionId,
                    changeReason: context.changeReason ?? 'AI file modification',
                });
            });
            if (trackedResult.success) {
                return { success: true, uiState: 'ready' };
            }
            return {
                success: false,
                error: trackedResult.error ?? FILE_ERROR_MESSAGE.WRITE_FAILED,
                messageKey: FILE_MESSAGE_KEY.WRITE_FAILED,
                uiState: 'failure'
            };
        }
        const writeResult = await runWithFileAudit('files.writeFile', filePath, async () => {
            return await fileSystemService.writeFile(filePath, content);
        });
        if (writeResult.success) {
            return { success: true, uiState: 'ready' };
        }
        return {
            success: false,
            error: writeResult.error ?? FILE_ERROR_MESSAGE.WRITE_FAILED,
            messageKey: FILE_MESSAGE_KEY.WRITE_FAILED,
            uiState: 'failure'
        };
    }, {
        defaultValue: {
            success: false,
            error: FILE_ERROR_MESSAGE.WRITE_FAILED,
            errorCode: FILE_IPC_ERROR_CODE.OPERATION_FAILED,
            messageKey: FILE_MESSAGE_KEY.WRITE_FAILED,
            uiState: 'failure'
        },
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

    ipcMain.handle('files:copyPath', createValidatedIpcHandler('files:copyPath', async (_event, sourcePath: string, destinationPath: string) => {
        return await runWithFileAudit('files.copyPath', `${sourcePath} -> ${destinationPath}`, async () => {
            return await fileSystemService.copyPath(sourcePath, destinationPath);
        });
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema, PathSchema])
    }));

    ipcMain.handle('files:renamePath', createValidatedIpcHandler('files:renamePath', async (_event, oldPath: string, newPath: string) => {
        return await runWithFileAudit('files.renamePath', `${oldPath} -> ${newPath}`, async () => {
            return await fileSystemService.moveFile(oldPath, newPath);
        });
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([PathSchema, PathSchema])
    }));

    ipcMain.handle('files:searchFiles', createValidatedIpcHandler<SearchFilesResponse, [string, string]>('files:searchFiles', async (_event, dirPath: string, pattern: string) => {
        const result = await runWithFileAudit('files.searchFiles', dirPath, async () => {
            return await fileSystemService.searchFiles(dirPath, pattern);
        });
        const results = result.data ?? [];
        return {
            success: result.success,
            results,
            uiState: results.length === 0 ? 'empty' : 'ready'
        };
    }, {
        defaultValue: {
            success: false,
            results: [],
            errorCode: FILE_IPC_ERROR_CODE.OPERATION_FAILED,
            messageKey: FILE_MESSAGE_KEY.SEARCH_FAILED,
            uiState: 'failure'
        },
        argsSchema: z.tuple([PathSchema, PatternSchema])
    }));

    ipcMain.handle('files:health', createValidatedIpcHandler(
        'files:health',
        async () => {
            return {
                success: true,
                data: getFilesHealthSummary()
            };
        },
        {
            defaultValue: {
                success: false,
                data: {
                    status: 'degraded',
                    uiState: 'failure',
                    budgets: {
                        existsMs: FILE_PERFORMANCE_BUDGET_MS.EXISTS,
                        writeMs: FILE_PERFORMANCE_BUDGET_MS.WRITE,
                        searchMs: FILE_PERFORMANCE_BUDGET_MS.SEARCH
                    },
                    metrics: {
                        ...fileTelemetry,
                        errorRate: 1
                    }
                }
            },
            argsSchema: z.tuple([])
        }
    ));

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
