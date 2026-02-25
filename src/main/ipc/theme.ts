import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { ThemeService } from '@main/services/theme/theme.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { themeStore } from '@main/utils/theme-store.util';
import { CustomTheme, ThemeManifest } from '@shared/types/theme';
import { ipcMain, IpcMainInvokeEvent, shell } from 'electron';

const MAX_ID_LENGTH = 64;
const MAX_NAME_LENGTH = 128;
const MAX_JSON_LENGTH = 1048576; // 1MB

/**
 * Validates a theme ID string, allowing only alphanumeric characters, dashes, and underscores.
 * @param value - Raw theme ID input to validate
 * @returns Trimmed theme ID or null if invalid
 */
function validateThemeId(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_ID_LENGTH) {
        return null;
    }
    // Only allow alphanumeric, dashes, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a theme name string.
 * @param value - Raw theme name input to validate
 * @returns Trimmed theme name or null if invalid
 */
function validateThemeName(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a JSON string input, enforcing a maximum length.
 * @param value - Raw JSON string to validate
 * @returns The JSON string or null if invalid
 */
function validateJsonString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    if (value.length > MAX_JSON_LENGTH) {
        return null;
    }
    return value;
}

type CustomThemeDraft = Omit<CustomTheme, 'id' | 'createdAt' | 'modifiedAt'>;

/**
 * Validates a custom theme input object, checking required fields and allowed values.
 * @param value - Raw theme object to validate
 * @returns Validated custom theme draft or null if invalid
 */
function validateCustomThemeInput(value: unknown): CustomThemeDraft | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value as Record<string, unknown>;
    if (typeof candidate['name'] !== 'string' || candidate['name'].trim().length === 0) {
        return null;
    }
    if (
        candidate['category'] !== 'elite-dark' &&
        candidate['category'] !== 'vibrant-neon' &&
        candidate['category'] !== 'professional-light' &&
        candidate['category'] !== 'artisanal'
    ) {
        return null;
    }
    if (typeof candidate['isDark'] !== 'boolean') {
        return null;
    }
    if (candidate['isCustom'] !== true) {
        return null;
    }
    if (
        candidate['source'] !== 'user-created' &&
        candidate['source'] !== 'imported'
    ) {
        return null;
    }
    if (!candidate['colors'] || typeof candidate['colors'] !== 'object') {
        return null;
    }
    return candidate as CustomThemeDraft;
}

/**
 * Registers IPC handlers for theme management
 */
export function registerThemeIpc(themeService: ThemeService): void {
    appLogger.info('ThemeIPC', 'Registering theme IPC handlers');

    // Runtime theme management
    ipcMain.handle('theme:runtime:getAll', createSafeIpcHandler('theme:runtime:getAll',
        async () => {
            return themeService.getAllThemes();
        }, []
    ));

    ipcMain.handle('theme:runtime:install', createIpcHandler('theme:runtime:install',
        async (_event: IpcMainInvokeEvent, themeManifest: unknown) => {
            if (!themeManifest || typeof themeManifest !== 'object') {
                throw new Error('Invalid theme manifest');
            }
            return themeService.installTheme(themeManifest as ThemeManifest);
        }
    ));

    ipcMain.handle('theme:runtime:uninstall', createIpcHandler('theme:runtime:uninstall',
        async (_event: IpcMainInvokeEvent, themeIdRaw: unknown) => {
            const themeId = validateThemeId(themeIdRaw);
            if (!themeId) {
                throw new Error('Invalid theme ID');
            }
            return themeService.uninstallTheme(themeId);
        }
    ));

    ipcMain.handle('theme:runtime:openDirectory', createSafeIpcHandler('theme:runtime:openDirectory',
        async () => {
            const themesDir = themeService.getThemesDirectory();
            await shell.openPath(themesDir);
            return true;
        }, false
    ));

    // Legacy theme store handlers (kept for backward compatibility)
    ipcMain.handle('theme:getCurrent', createSafeIpcHandler('theme:getCurrent',
        async () => {
            return themeStore.getCurrentTheme();
        }, null
    ));

    ipcMain.handle('theme:set', createSafeIpcHandler('theme:set',
        async (_event: IpcMainInvokeEvent, themeIdRaw: unknown) => {
            const themeId = validateThemeId(themeIdRaw);
            if (!themeId) {
                throw new Error('Invalid theme ID');
            }
            return themeStore.setTheme(themeId);
        }, null
    ));

    ipcMain.handle('theme:getAll', createSafeIpcHandler('theme:getAll',
        async () => {
            return themeStore.getAllThemes();
        }, []
    ));

    ipcMain.handle('theme:getDetails', createSafeIpcHandler('theme:getDetails',
        async (_event: IpcMainInvokeEvent, themeIdRaw: unknown) => {
            const themeId = validateThemeId(themeIdRaw);
            if (!themeId) {
                throw new Error('Invalid theme ID');
            }
            return themeStore.getThemeDetails(themeId);
        }, null
    ));

    ipcMain.handle('theme:getCustom', createSafeIpcHandler('theme:getCustom',
        async () => {
            return themeStore.getCustomThemes();
        }, []
    ));

    ipcMain.handle('theme:addCustom', createIpcHandler('theme:addCustom',
        async (_event: IpcMainInvokeEvent, theme: unknown) => {
            const validatedTheme = validateCustomThemeInput(theme);
            if (!validatedTheme) {
                throw new Error('Invalid theme object');
            }
            return themeStore.addCustomTheme(validatedTheme);
        }
    ));

    ipcMain.handle('theme:updateCustom', createIpcHandler('theme:updateCustom',
        async (_event: IpcMainInvokeEvent, idRaw: unknown, updates: unknown) => {
            const id = validateThemeId(idRaw);
            if (!id) {
                throw new Error('Invalid theme ID');
            }
            if (!updates || typeof updates !== 'object') {
                throw new Error('Invalid updates object');
            }
            return themeStore.updateCustomTheme(id, updates);
        }
    ));

    ipcMain.handle('theme:deleteCustom', createIpcHandler('theme:deleteCustom',
        async (_event: IpcMainInvokeEvent, idRaw: unknown) => {
            const id = validateThemeId(idRaw);
            if (!id) {
                throw new Error('Invalid theme ID');
            }
            return themeStore.deleteCustomTheme(id);
        }
    ));

    ipcMain.handle('theme:toggleFavorite', createSafeIpcHandler('theme:toggleFavorite',
        async (_event: IpcMainInvokeEvent, themeIdRaw: unknown) => {
            const themeId = validateThemeId(themeIdRaw);
            if (!themeId) {
                throw new Error('Invalid theme ID');
            }
            return themeStore.toggleFavorite(themeId);
        }, false
    ));

    ipcMain.handle('theme:getFavorites', createSafeIpcHandler('theme:getFavorites',
        async () => {
            return themeStore.getFavorites();
        }, []
    ));

    ipcMain.handle('theme:isFavorite', createSafeIpcHandler('theme:isFavorite',
        async (_event: IpcMainInvokeEvent, themeIdRaw: unknown) => {
            const themeId = validateThemeId(themeIdRaw);
            if (!themeId) {
                throw new Error('Invalid theme ID');
            }
            return themeStore.isFavorite(themeId);
        }, false
    ));

    ipcMain.handle('theme:getHistory', createSafeIpcHandler('theme:getHistory',
        async () => {
            return themeStore.getHistory();
        }, []
    ));

    ipcMain.handle('theme:clearHistory', createSafeIpcHandler('theme:clearHistory',
        async () => {
            await themeStore.clearHistory();
            return true;
        }, false
    ));

    ipcMain.handle('theme:getPresets', createSafeIpcHandler('theme:getPresets',
        async () => {
            return themeStore.getPresets();
        }, []
    ));

    ipcMain.handle('theme:applyPreset', createSafeIpcHandler('theme:applyPreset',
        async (_event: IpcMainInvokeEvent, presetIdRaw: unknown) => {
            const presetId = validateThemeId(presetIdRaw);
            if (!presetId) {
                throw new Error('Invalid preset ID');
            }
            return themeStore.applyPreset(presetId);
        }, null
    ));

    ipcMain.handle('theme:getCurrentPreset', createSafeIpcHandler('theme:getCurrentPreset',
        async () => {
            return themeStore.getCurrentPreset();
        }, null
    ));

    ipcMain.handle('theme:clearPreset', createSafeIpcHandler('theme:clearPreset',
        async () => {
            await themeStore.clearPreset();
            return true;
        }, false
    ));

    ipcMain.handle('theme:export', createSafeIpcHandler('theme:export',
        async (_event: IpcMainInvokeEvent, themeIdRaw: unknown) => {
            const themeId = validateThemeId(themeIdRaw);
            if (!themeId) {
                throw new Error('Invalid theme ID');
            }

            const json = themeStore.exportTheme(themeId);
            if (!json) {
                return false;
            }

            const tempPath = path.join(os.tmpdir(), `tengra-theme-${themeId}-${Date.now()}.json`);
            await fs.writeFile(tempPath, json);
            await shell.openPath(tempPath);
            return true;
        }, false
    ));

    ipcMain.handle('theme:import', createIpcHandler('theme:import',
        async (_event: IpcMainInvokeEvent, jsonStringRaw: unknown) => {
            const jsonString = validateJsonString(jsonStringRaw);
            if (!jsonString) {
                throw new Error('Invalid JSON string');
            }
            return themeStore.importTheme(jsonString);
        }
    ));

    ipcMain.handle('theme:duplicate', createIpcHandler('theme:duplicate',
        async (_event: IpcMainInvokeEvent, themeIdRaw: unknown, newNameRaw: unknown) => {
            const themeId = validateThemeId(themeIdRaw);
            if (!themeId) {
                throw new Error('Invalid theme ID');
            }
            const newName = validateThemeName(newNameRaw);
            if (!newName) {
                throw new Error('Invalid theme name');
            }
            return themeStore.duplicateTheme(themeId, newName);
        }
    ));
}

