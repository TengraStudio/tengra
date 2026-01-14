/**
 * Backup IPC Handlers
 * Exposes backup and restore functionality to the renderer process
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { BackupService, BackupResult, RestoreResult, BackupMetadata } from '../services/backup.service'
import { createIpcHandler } from '../utils/ipc-wrapper.util'

export interface BackupListItem {
    name: string
    path: string
    metadata?: BackupMetadata
}

export function registerBackupIpc(backupService: BackupService) {
    // Create a backup
    ipcMain.handle('backup:create', createIpcHandler('backup:create', async (
        _event: IpcMainInvokeEvent,
        options?: {
            includeChats?: boolean
            includeAuth?: boolean
            includeSettings?: boolean
            includePrompts?: boolean
        }
    ): Promise<BackupResult> => {
        return backupService.createBackup(options)
    }))

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
        return backupService.restoreBackup(backupPath, options)
    }))

    // List all backups
    ipcMain.handle('backup:list', createIpcHandler('backup:list', async (): Promise<BackupListItem[]> => {
        return backupService.listBackups()
    }))

    // Delete a backup
    ipcMain.handle('backup:delete', createIpcHandler('backup:delete', async (
        _event: IpcMainInvokeEvent,
        backupPath: string
    ): Promise<boolean> => {
        return backupService.deleteBackup(backupPath)
    }))

    // Get backup directory
    ipcMain.handle('backup:getDir', createIpcHandler('backup:getDir', async (): Promise<string> => {
        return backupService.getBackupDir()
    }))

    // Get auto-backup status
    ipcMain.handle('backup:getAutoBackupStatus', createIpcHandler('backup:getAutoBackupStatus', async (): Promise<{
        enabled: boolean
        intervalHours: number
        maxBackups: number
        lastBackup: string | null
    }> => {
        return backupService.getAutoBackupStatus()
    }))

    // Configure auto-backup
    ipcMain.handle('backup:configureAutoBackup', createIpcHandler('backup:configureAutoBackup', async (
        _event: IpcMainInvokeEvent,
        config: {
            enabled: boolean
            intervalHours?: number
            maxBackups?: number
        }
    ): Promise<void> => {
        return backupService.configureAutoBackup(config)
    }))

    // Trigger auto-backup cleanup
    ipcMain.handle('backup:cleanup', createIpcHandler('backup:cleanup', async (): Promise<number> => {
        return backupService.cleanupOldBackups()
    }))
}
