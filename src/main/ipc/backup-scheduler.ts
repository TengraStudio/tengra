/**
 * Backup Scheduler IPC Handlers
 * Exposes backup scheduling configuration to the renderer process.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { BackupScheduleConfig, BackupSchedulerService } from '@main/services/data/backup-scheduler.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Registers IPC handlers for backup schedule management.
 * @param getMainWindow - Getter for the main BrowserWindow.
 * @param schedulerService - The backup scheduler service instance.
 */
export function registerBackupSchedulerIpc(
    getMainWindow: () => BrowserWindow | null,
    schedulerService: BackupSchedulerService
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'backup scheduler');

    ipcMain.handle('backup:schedule-config', createIpcHandler(
        'backup:schedule-config',
        async (): Promise<BackupScheduleConfig> => {
            return schedulerService.getConfig();
        }
    ));

    ipcMain.handle('backup:schedule-update', createIpcHandler(
        'backup:schedule-update',
        async (
            event: IpcMainInvokeEvent,
            config: Partial<BackupScheduleConfig>
        ): Promise<BackupScheduleConfig> => {
            validateSender(event);
            return schedulerService.setConfig(config);
        }
    ));

    ipcMain.handle('backup:schedule-trigger', createIpcHandler(
        'backup:schedule-trigger',
        async (event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
            validateSender(event);
            return schedulerService.triggerBackup();
        }
    ));
}
