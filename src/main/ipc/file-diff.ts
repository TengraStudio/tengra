/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import type { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import type { BrowserWindow } from 'electron';

/**
 * Registers IPC handlers for file diff operations.
 */
export function registerFileDiffIpc(
    _getMainWindow: () => BrowserWindow | null,
    _fileChangeTracker: FileChangeTracker
): void {
    appLogger.debug('FileDiffIPC', 'File diff IPC is currently disabled.');
}

