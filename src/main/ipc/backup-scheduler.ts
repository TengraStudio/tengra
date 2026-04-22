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
import type { BackupSchedulerService } from '@main/services/data/backup-scheduler.service';
import type { BrowserWindow } from 'electron';

/**
 * Registers IPC handlers for backup schedule management.
 * @param getMainWindow - Getter for the main BrowserWindow.
 * @param schedulerService - The backup scheduler service instance.
 */
export function registerBackupSchedulerIpc(
    getMainWindow: () => BrowserWindow | null,
    _schedulerService: BackupSchedulerService
): void {
    const _validateSender = createMainWindowSenderValidator(getMainWindow, 'backup scheduler');
    void _validateSender;
}
