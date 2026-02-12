/**
 * File Diff IPC Handlers
 * Handles diff-related communication between main and renderer processes
 */

import { appLogger } from '@main/logging/logger';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum path length */
const MAX_PATH_LENGTH = 1024;
/** Maximum ID length */
const MAX_ID_LENGTH = 128;
/** Maximum diff content length (10MB) */
const MAX_DIFF_CONTENT_LENGTH = 10 * 1024 * 1024;
/** Maximum query limit */
const MAX_QUERY_LIMIT = 1000;
/** Default query limit */
const DEFAULT_QUERY_LIMIT = 50;
/** Maximum age for cleanup (1 year in ms) */
const MAX_CLEANUP_AGE_MS = 365 * 24 * 60 * 60 * 1000;
/** Default cleanup age (30 days in ms) */
const DEFAULT_CLEANUP_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Validates and sanitizes a string ID
 */
function validateStringId(value: unknown, maxLength: number = MAX_ID_LENGTH): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) {
        return null;
    }
    return trimmed;
}

/**
 * Validates and sanitizes a query limit
 */
function validateLimit(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        return DEFAULT_QUERY_LIMIT;
    }
    return Math.max(1, Math.min(value, MAX_QUERY_LIMIT));
}

/**
 * Validates cleanup age parameter
 */
function validateCleanupAge(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        return DEFAULT_CLEANUP_AGE_MS;
    }
    return Math.min(value, MAX_CLEANUP_AGE_MS);
}

/**
 * Registers IPC handlers for file diff operations
 */
export function registerFileDiffIpc(
    _getMainWindow: () => BrowserWindow | null,
    fileChangeTracker: FileChangeTracker
): void {
    appLogger.info('FileDiffIPC', 'Registering file diff IPC handlers');

    ipcMain.handle(
        'diff:getFileHistory',
        createSafeIpcHandler(
            'diff:getFileHistory',
            async (_event: IpcMainInvokeEvent, filePathRaw: unknown) => {
                const filePath = validateStringId(filePathRaw, MAX_PATH_LENGTH);
                if (!filePath) {
                    throw new Error('Invalid file path');
                }
                const history = await fileChangeTracker.databaseService.getFileDiffHistory(filePath);
                return { success: true, data: history };
            },
            { success: false, data: [] }
        )
    );

    ipcMain.handle(
        'diff:getRecentChanges',
        createSafeIpcHandler(
            'diff:getRecentChanges',
            async (_event: IpcMainInvokeEvent, limitRaw: unknown) => {
                const limit = validateLimit(limitRaw);
                const changes = await fileChangeTracker.databaseService.getRecentFileDiffs(limit);
                return { success: true, data: changes };
            },
            { success: false, data: [] }
        )
    );

    ipcMain.handle(
        'diff:getSessionChanges',
        createSafeIpcHandler(
            'diff:getSessionChanges',
            async (_event: IpcMainInvokeEvent, chatSessionIdRaw: unknown) => {
                const chatSessionId = validateStringId(chatSessionIdRaw);
                if (!chatSessionId) {
                    throw new Error('Invalid chat session ID');
                }
                const changes = await fileChangeTracker.databaseService.getFileDiffsBySession(chatSessionId);
                return { success: true, data: changes };
            },
            { success: false, data: [] }
        )
    );

    ipcMain.handle(
        'diff:getChangesBySystem',
        createSafeIpcHandler(
            'diff:getChangesBySystem',
            async (_event: IpcMainInvokeEvent, aiSystemRaw: unknown) => {
                const aiSystem = validateStringId(aiSystemRaw);
                if (!aiSystem) {
                    throw new Error('Invalid AI system identifier');
                }
                const changes = await fileChangeTracker.databaseService.getFileDiffsBySystem(aiSystem);
                return { success: true, data: changes };
            },
            { success: false, data: [] }
        )
    );

    ipcMain.handle(
        'diff:getDiffById',
        createSafeIpcHandler(
            'diff:getDiffById',
            async (_event: IpcMainInvokeEvent, diffIdRaw: unknown) => {
                const diffId = validateStringId(diffIdRaw);
                if (!diffId) {
                    throw new Error('Invalid diff ID');
                }
                const diff = await fileChangeTracker.databaseService.getFileDiff(diffId);
                return { success: true, data: diff };
            },
            { success: false, data: undefined }
        )
    );

    ipcMain.handle(
        'diff:revertChange',
        createSafeIpcHandler(
            'diff:revertChange',
            async (_event: IpcMainInvokeEvent, diffIdRaw: unknown) => {
                const diffId = validateStringId(diffIdRaw);
                if (!diffId) {
                    throw new Error('Invalid diff ID');
                }
                return await fileChangeTracker.revertFileChange(diffId);
            },
            { success: false, error: 'Revert operation failed' }
        )
    );

    ipcMain.handle(
        'diff:getStats',
        createSafeIpcHandler(
            'diff:getStats',
            async (_event: IpcMainInvokeEvent, diffContentRaw: unknown) => {
                if (typeof diffContentRaw !== 'string') {
                    throw new Error('Invalid diff content');
                }
                if (diffContentRaw.length > MAX_DIFF_CONTENT_LENGTH) {
                    throw new Error('Diff content exceeds maximum size');
                }
                const stats = fileChangeTracker.getDiffStats(diffContentRaw);
                return { success: true, data: stats };
            },
            { success: false, data: { additions: 0, deletions: 0, changes: 0 } }
        )
    );

    ipcMain.handle(
        'diff:cleanup',
        createSafeIpcHandler(
            'diff:cleanup',
            async (_event: IpcMainInvokeEvent, maxAgeMsRaw: unknown) => {
                const maxAgeMs = validateCleanupAge(maxAgeMsRaw);
                await fileChangeTracker.databaseService.cleanupOldFileDiffs(maxAgeMs);
                appLogger.info('FileDiffIPC', 'Cleaned up old file diffs');
                return { success: true, data: { completed: true } };
            },
            { success: false, data: { completed: false } }
        )
    );
}
