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
import { ThemeService } from '@main/services/theme/theme.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { themeStore } from '@main/utils/theme-store.util';
import { ThemeManifest } from '@shared/types/theme';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent, shell } from 'electron';

const MAX_ID_LENGTH = 64;

/**
 * Validates a theme ID string, allowing only alphanumeric characters, dashes, and underscores.
 * @param value - Raw theme ID input to validate
 * @returns Trimmed theme ID or null if invalid
 */
function validateThemeId(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_ID_LENGTH) {
        return null;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

/**
 * Registers IPC handlers for theme management
 */
export function registerThemeIpc(
    themeService: ThemeService,
    getMainWindow: () => BrowserWindow | null
): void {
    appLogger.info('ThemeIPC', 'Registering theme IPC handlers');

    ipcMain.handle('theme:runtime:getAll', createSafeIpcHandler(
        'theme:runtime:getAll',
        async () => {
            return themeService.getAllThemes();
        },
        []
    ));

    ipcMain.handle('theme:runtime:install', createIpcHandler(
        'theme:runtime:install',
        async (_event: IpcMainInvokeEvent, themeManifest: RuntimeValue) => {
            if (!themeManifest || typeof themeManifest !== 'object') {
                throw new Error('error.theme.invalid_manifest');
            }

            const result = await themeService.installTheme(themeManifest as ThemeManifest);
            const mainWindow = getMainWindow();
            if (mainWindow) {
                mainWindow.webContents.send('theme:runtime:updated');
            }

            return result;
        }
    ));

    ipcMain.handle('theme:runtime:uninstall', createIpcHandler(
        'theme:runtime:uninstall',
        async (_event: IpcMainInvokeEvent, themeIdRaw: RuntimeValue) => {
            const themeId = validateThemeId(themeIdRaw);
            if (!themeId) {
                throw new Error('error.theme.invalid_id');
            }

            const result = await themeService.uninstallTheme(themeId);
            const mainWindow = getMainWindow();
            if (mainWindow) {
                mainWindow.webContents.send('theme:runtime:updated');
            }

            return result;
        }
    ));

    ipcMain.handle('theme:runtime:openDirectory', createSafeIpcHandler(
        'theme:runtime:openDirectory',
        async () => {
            const themesDir = themeService.getThemesDirectory();
            await shell.openPath(themesDir);
            return true;
        },
        false
    ));

    ipcMain.handle('theme:getCurrent', createSafeIpcHandler(
        'theme:getCurrent',
        async () => themeStore.getCurrentTheme(),
        ''
    ));

    ipcMain.handle('theme:set', createSafeIpcHandler(
        'theme:set',
        async (_event: IpcMainInvokeEvent, themeIdRaw: RuntimeValue) => {
            const themeId = validateThemeId(themeIdRaw);
            if (!themeId) {
                return null;
            }

            return themeStore.setTheme(themeId);
        },
        null
    ));

    ipcMain.handle('theme:getAll', createSafeIpcHandler(
        'theme:getAll',
        async () => themeStore.getAllThemes(),
        []
    ));
}
