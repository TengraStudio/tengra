/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
