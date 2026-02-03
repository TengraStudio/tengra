/**
 * File Diff IPC Handlers
 * Handles diff-related communication between main and renderer processes
 */

import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { BrowserWindow, ipcMain } from 'electron';

export function registerFileDiffIpc(
    _getMainWindow: () => BrowserWindow | null,
    fileChangeTracker: FileChangeTracker
) {
    // Get file history
    ipcMain.handle('diff:getFileHistory', async (_event, filePath: string, _limit?: number) => {
        try {
            const history = await fileChangeTracker.databaseService.getFileDiffHistory(filePath);
            return { success: true, data: history };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Get recent changes
    ipcMain.handle('diff:getRecentChanges', async (_event, limit?: number) => {
        try {
            const changes = await fileChangeTracker.databaseService.getRecentFileDiffs(limit ?? 50);
            return { success: true, data: changes };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Get session changes
    ipcMain.handle('diff:getSessionChanges', async (_event, chatSessionId: string) => {
        try {
            const changes = await fileChangeTracker.databaseService.getFileDiffsBySession(chatSessionId);
            return { success: true, data: changes };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Get changes by AI system
    ipcMain.handle('diff:getChangesBySystem', async (_event, aiSystem: string, _limit?: number) => {
        try {
            const changes = await fileChangeTracker.databaseService.getFileDiffsBySystem(aiSystem);
            return { success: true, data: changes };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Get diff by ID
    ipcMain.handle('diff:getDiffById', async (_event, diffId: string) => {
        try {
            const diff = await fileChangeTracker.databaseService.getFileDiff(diffId);
            return { success: true, data: diff };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Revert file change
    ipcMain.handle('diff:revertChange', async (_event, diffId: string) => {
        return await fileChangeTracker.revertFileChange(diffId);
    });

    // Get diff stats
    ipcMain.handle('diff:getStats', async (_event, diffContent: string) => {
        try {
            const stats = fileChangeTracker.getDiffStats(diffContent);
            return { success: true, data: stats };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Clean up old diffs
    ipcMain.handle('diff:cleanup', async (_event, maxAgeMs?: number) => {
        try {
            const deletedCount = await fileChangeTracker.databaseService.cleanupOldFileDiffs(
                maxAgeMs ?? 30 * 24 * 60 * 60 * 1000
            );
            return { success: true, data: { deletedCount } };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });
}