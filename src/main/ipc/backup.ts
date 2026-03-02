/**
 * Backup IPC Handlers
 * Exposes backup and restore functionality to the renderer process
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { BackupMetadata, BackupResult, BackupService, RestoreResult } from '@main/services/data/backup.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

export interface BackupListItem {
    name: string
    path: string
    metadata?: BackupMetadata
}

/**
 * Registers IPC handlers for backup functionality
 * @param backupService Service for managing backups
 */
export function registerBackupIpc(getMainWindow: () => BrowserWindow | null, backupService: BackupService) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'backup operation');

    // Create a backup
    ipcMain.handle('backup:create', createIpcHandler('backup:create', async (
        event: IpcMainInvokeEvent,
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
        validateSender(event);
        return backupService.createBackup(options);
    }, { wrapResponse: true }));

    // Restore from a backup
    ipcMain.handle('backup:restore', createIpcHandler('backup:restore', async (
        event: IpcMainInvokeEvent,
        backupPath: string,
        options?: {
            restoreChats?: boolean
            restoreSettings?: boolean
            restorePrompts?: boolean
            mergeChats?: boolean
        }
    ): Promise<RestoreResult> => {
        validateSender(event);
        if (!backupPath || typeof backupPath !== 'string' || backupPath.trim().length === 0) {
            throw new Error('backupPath must be a non-empty string');
        }
        return backupService.restoreBackup(backupPath, options);
    }, { wrapResponse: true }));

    // List all backups
    ipcMain.handle('backup:list', createIpcHandler('backup:list', async (): Promise<BackupListItem[]> => {
        return backupService.listBackups();
    }, { wrapResponse: true }));

    // Delete a backup
    ipcMain.handle('backup:delete', createIpcHandler('backup:delete', async (
        event: IpcMainInvokeEvent,
        backupPath: string
    ): Promise<boolean> => {
        validateSender(event);
        if (!backupPath || typeof backupPath !== 'string' || backupPath.trim().length === 0) {
            throw new Error('backupPath must be a non-empty string');
        }
        return backupService.deleteBackup(backupPath);
    }, { wrapResponse: true }));

    // Get backup directory
    ipcMain.handle('backup:getDir', createIpcHandler('backup:getDir', async (): Promise<string> => {
        return backupService.getBackupDir();
    }, { wrapResponse: true }));

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
    }, { wrapResponse: true }));

    // Configure auto-backup
    ipcMain.handle('backup:configureAutoBackup', createIpcHandler('backup:configureAutoBackup', async (
        event: IpcMainInvokeEvent,
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
        validateSender(event);
        return backupService.configureAutoBackup(config);
    }, { wrapResponse: true }));

    // Trigger auto-backup cleanup
    ipcMain.handle('backup:cleanup', createIpcHandler('backup:cleanup', async (): Promise<number> => {
        return backupService.cleanupOldBackups();
    }, { wrapResponse: true }));

    ipcMain.handle('backup:verify', createIpcHandler('backup:verify', async (
        _event: IpcMainInvokeEvent,
        backupPath: string
    ): Promise<{ valid: boolean; checksum?: string; error?: string }> => {
        return backupService.verifyBackup(backupPath);
    }, { wrapResponse: true }));

    ipcMain.handle('backup:syncToCloudDir', createIpcHandler('backup:syncToCloudDir', async (
        event: IpcMainInvokeEvent,
        backupPath: string,
        targetDir: string
    ): Promise<{ success: boolean; targetPath?: string; error?: string }> => {
        validateSender(event);
        return backupService.syncBackupToDirectory(backupPath, targetDir);
    }, { wrapResponse: true }));

    ipcMain.handle('backup:createDisasterRecoveryBundle', createIpcHandler('backup:createDisasterRecoveryBundle', async (
        event: IpcMainInvokeEvent,
        targetDir?: string
    ) => {
        validateSender(event);
        return backupService.createDisasterRecoveryBundle(targetDir);
    }, { wrapResponse: true }));

    ipcMain.handle('backup:restoreDisasterRecoveryBundle', createIpcHandler('backup:restoreDisasterRecoveryBundle', async (
        event: IpcMainInvokeEvent,
        bundlePath: string
    ): Promise<RestoreResult> => {
        validateSender(event);
        if (!bundlePath || typeof bundlePath !== 'string' || bundlePath.trim().length === 0) {
            throw new Error('bundlePath must be a non-empty string');
        }
        return backupService.restoreDisasterRecoveryBundle(bundlePath);
    }, { wrapResponse: true }));
}
