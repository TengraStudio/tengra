/**
 * Backup IPC Handlers
 * Exposes backup and restore functionality to the renderer process
 */

import { BackupMetadata, BackupResult, BackupService, RestoreResult } from '@main/services/data/backup.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

export interface BackupListItem {
    name: string
    path: string
    metadata?: BackupMetadata
}

/**
 * Registers IPC handlers for backup functionality
 * @param backupService Service for managing backups
 */
export function registerBackupIpc(backupService: BackupService) {
    // Create a backup
    ipcMain.handle('backup:create', createIpcHandler('backup:create', async (
        _event: IpcMainInvokeEvent,
        options?: {
            includeChats?: boolean
            includeAuth?: boolean
            includeSettings?: boolean
            includePrompts?: boolean
            incremental?: boolean
            compress?: boolean
            encrypt?: boolean
            verify?: boolean
            cloudSyncDir?: string
        }
    ): Promise<BackupResult> => {
        return backupService.createBackup(options);
    }));

    // Restore from a backup
    ipcMain.handle('backup:restore', createIpcHandler('backup:restore', async (
        _event: IpcMainInvokeEvent,
        backupPath: string,
        options?: {
            restoreChats?: boolean
            restoreSettings?: boolean
            restorePrompts?: boolean
            mergeChats?: boolean
        }
    ): Promise<RestoreResult> => {
        if (!backupPath || typeof backupPath !== 'string' || backupPath.trim().length === 0) {
            throw new Error('backupPath must be a non-empty string');
        }
        return backupService.restoreBackup(backupPath, options);
    }));

    // List all backups
    ipcMain.handle('backup:list', createIpcHandler('backup:list', async (): Promise<BackupListItem[]> => {
        return backupService.listBackups();
    }));

    // Delete a backup
    ipcMain.handle('backup:delete', createIpcHandler('backup:delete', async (
        _event: IpcMainInvokeEvent,
        backupPath: string
    ): Promise<boolean> => {
        if (!backupPath || typeof backupPath !== 'string' || backupPath.trim().length === 0) {
            throw new Error('backupPath must be a non-empty string');
        }
        return backupService.deleteBackup(backupPath);
    }));

    // Get backup directory
    ipcMain.handle('backup:getDir', createIpcHandler('backup:getDir', async (): Promise<string> => {
        return backupService.getBackupDir();
    }));

    // Get auto-backup status
    ipcMain.handle('backup:getAutoBackupStatus', createIpcHandler('backup:getAutoBackupStatus', async (): Promise<{
        enabled: boolean
        intervalHours: number
        maxBackups: number
        lastBackup: string | null
        compression: boolean
        encryption: boolean
        verification: boolean
        cloudSyncDir?: string
    }> => {
        return backupService.getAutoBackupStatus();
    }));

    // Configure auto-backup
    ipcMain.handle('backup:configureAutoBackup', createIpcHandler('backup:configureAutoBackup', async (
        _event: IpcMainInvokeEvent,
        config: {
            enabled: boolean
            intervalHours?: number
            maxBackups?: number
            compression?: boolean
            encryption?: boolean
            verification?: boolean
            cloudSyncDir?: string
        }
    ): Promise<void> => {
        return backupService.configureAutoBackup(config);
    }));

    // Trigger auto-backup cleanup
    ipcMain.handle('backup:cleanup', createIpcHandler('backup:cleanup', async (): Promise<number> => {
        return backupService.cleanupOldBackups();
    }));

    ipcMain.handle('backup:verify', createIpcHandler('backup:verify', async (
        _event: IpcMainInvokeEvent,
        backupPath: string
    ): Promise<{ valid: boolean; checksum?: string; error?: string }> => {
        return backupService.verifyBackup(backupPath);
    }));

    ipcMain.handle('backup:syncToCloudDir', createIpcHandler('backup:syncToCloudDir', async (
        _event: IpcMainInvokeEvent,
        backupPath: string,
        targetDir: string
    ): Promise<{ success: boolean; targetPath?: string; error?: string }> => {
        return backupService.syncBackupToDirectory(backupPath, targetDir);
    }));

    ipcMain.handle('backup:createDisasterRecoveryBundle', createIpcHandler('backup:createDisasterRecoveryBundle', async (
        _event: IpcMainInvokeEvent,
        targetDir?: string
    ) => {
        return backupService.createDisasterRecoveryBundle(targetDir);
    }));

    ipcMain.handle('backup:restoreDisasterRecoveryBundle', createIpcHandler('backup:restoreDisasterRecoveryBundle', async (
        _event: IpcMainInvokeEvent,
        bundlePath: string
    ): Promise<RestoreResult> => {
        if (!bundlePath || typeof bundlePath !== 'string' || bundlePath.trim().length === 0) {
            throw new Error('bundlePath must be a non-empty string');
        }
        return backupService.restoreDisasterRecoveryBundle(bundlePath);
    }));
}
