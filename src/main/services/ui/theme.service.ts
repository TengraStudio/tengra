/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';

import { BaseService } from '@main/services/base.service';
import { getDataFilePath } from '@main/services/system/app-layout-paths.util';
import {
    MAX_THEME_ID_LENGTH,
    MAX_THEME_NAME_LENGTH,
    REQUIRED_COLOR_KEYS,
    THEME_ID_PATTERN,
    ThemeErrorCode,
} from '@main/services/ui/theme-error';
import { withRetry } from '@main/utils/retry.util';
import { RETRY_DEFAULTS } from '@shared/constants/defaults';
import { JsonObject } from '@shared/types/common';
import { BUILTIN_THEME_MANIFESTS } from '@shared/theme/builtin-theme-manifests';
import { CustomTheme, ThemeColors, ThemePreset } from '@shared/types/theme';
import { safeJsonParse } from '@shared/utils/sanitize.util';

interface ThemeStoreData {
    currentTheme: string
    customThemes: CustomTheme[]
    favorites: string[]
    history: string[]
    preset: ThemePreset | null
}

/** Structured usageStats event emitted by ThemeService */
export interface ThemeUsageStatsEvent {
    action: string;
    themeId?: string;
    previousThemeId?: string;
    presetId?: string;
    source?: string;
    success: boolean;
    durationMs?: number;
    timestamp: number;
}

/** Health snapshot for ThemeService */
export interface ThemeServiceHealth {
    initialized: boolean;
    currentTheme: string;
    customThemeCount: number;
    favoriteCount: number;
    historySize: number;
    hasActivePreset: boolean;
    storePath: string;
}

const DEFAULT_THEME_STORE: ThemeStoreData = {
    currentTheme: 'tengra-black',
    customThemes: [],
    favorites: [],
    history: ['tengra-black'],
    preset: null
};

const BUILTIN_THEMES = BUILTIN_THEME_MANIFESTS.map(theme => ({
    id: theme.id,
    name: theme.displayName,
    isDark: theme.type !== 'light',
    colors: { ...theme.colors } as ThemeColors,
    description: theme.description,
    author: theme.author,
    tags: theme.tags,
}));

export class ThemeService extends BaseService {
    private storePath: string;
    private store: ThemeStoreData = { ...DEFAULT_THEME_STORE };
    private initialized = false;
    private readonly usageStatsLog: ThemeUsageStatsEvent[] = [];
    private static readonly MAX_usageStats_LOG = 200;

    constructor() {
        super('ThemeService');
        this.storePath = getDataFilePath('themes', 'theme-store.json');
    }

    /** Emits a structured usageStats event and logs it via appLogger. */
    private emitUsageStats(event: ThemeUsageStatsEvent): void {
        this.usageStatsLog.push(event);
        if (this.usageStatsLog.length > ThemeService.MAX_usageStats_LOG) {
            this.usageStatsLog.shift();
        }
        this.logInfo(`usageStats: ${event.action}`, event as RuntimeValue as JsonObject);
    }

    /** Returns a copy of the recent usageStats event log. */
    getusageStatsLog(): ReadonlyArray<ThemeUsageStatsEvent> {
        return [...this.usageStatsLog];
    }

    /** Returns a health snapshot of the theme service. */
    getHealth(): ThemeServiceHealth {
        return {
            initialized: this.initialized,
            currentTheme: this.store.currentTheme,
            customThemeCount: this.store.customThemes.length,
            favoriteCount: this.store.favorites.length,
            historySize: this.store.history.length,
            hasActivePreset: this.store.preset !== null,
            storePath: this.storePath,
        };
    }

    /** Validates a theme ID string for format and length. */
    validateThemeId(id: string): ThemeErrorCode | null {
        if (typeof id !== 'string' || id.trim().length === 0) {
            return ThemeErrorCode.INVALID_ID;
        }
        if (id.length > MAX_THEME_ID_LENGTH) {
            return ThemeErrorCode.INVALID_ID;
        }
        if (!THEME_ID_PATTERN.test(id)) {
            return ThemeErrorCode.INVALID_ID;
        }
        return null;
    }

    /** Validates a theme name string for length and content. */
    validateThemeName(name: string): ThemeErrorCode | null {
        if (typeof name !== 'string' || name.trim().length === 0) {
            return ThemeErrorCode.INVALID_NAME;
        }
        if (name.length > MAX_THEME_NAME_LENGTH) {
            return ThemeErrorCode.INVALID_NAME;
        }
        return null;
    }

    /** Validates that required color keys are present. */
    validateColors(colors: ThemeColors): ThemeErrorCode | null {
        if (typeof colors !== 'object' || colors === null || Array.isArray(colors)) {
            return ThemeErrorCode.INVALID_COLORS;
        }
        const requiredKeys = REQUIRED_COLOR_KEYS as ReadonlyArray<keyof ThemeColors>;
        for (const key of requiredKeys) {
            if (typeof colors[key] !== 'string') {
                return ThemeErrorCode.INVALID_COLORS;
            }
        }
        return null;
    }

    async initialize(): Promise<void> {
        if (this.initialized) { return; }
        this.store = await this.loadStore();
        this.initialized = true;
        this.logInfo('Theme service initialized successfully');
    }

    async cleanup(): Promise<void> {
        if (this.initialized) {
            await this.saveStore();
            this.logInfo('Theme service cleanup completed');
        }
    }

    async init() {
        // Legacy method for backward compatibility
        await this.initialize();
    }

    private async loadStore(): Promise<ThemeStoreData> {
        try {
            const exists = await fs.promises.access(this.storePath).then(() => true).catch(() => false);
            if (exists) {
                const data = await fs.promises.readFile(this.storePath, 'utf8');
                const loaded = safeJsonParse<ThemeStoreData>(data, DEFAULT_THEME_STORE);
                return { ...DEFAULT_THEME_STORE, ...loaded };
            }
        } catch (error) {
            this.logWarn('Failed to load theme store, using defaults', error as Error);
        }
        return { ...DEFAULT_THEME_STORE };
    }

    private async saveStore(): Promise<boolean> {
        try {
            await withRetry(
                async () => {
                    const tempPath = this.storePath + '.tmp';
                    await fs.promises.writeFile(tempPath, JSON.stringify(this.store, null, 2), 'utf8');
                    await fs.promises.rename(tempPath, this.storePath);
                },
                {
                    maxRetries: RETRY_DEFAULTS.FILE_SAVE_RETRIES,
                    baseDelayMs: RETRY_DEFAULTS.FILE_SAVE_DELAY_MS,
                    shouldRetry: () => true,
                    onRetry: (_err, attempt) => {
                        this.logWarn(`Save attempt ${attempt + 1} failed, retrying...`);
                    }
                }
            );
            return true;
        } catch (error) {
            this.logError('Failed to save theme store after retries', error as Error);
            this.emitUsageStats({
                action: 'theme.save.failed',
                success: false,
                timestamp: Date.now(),
            });
            return false;
        }
    }



    getCurrentTheme(): string {
        return this.store.currentTheme;
    }

    async setTheme(themeId: string): Promise<boolean> {
        const start = Date.now();
        const idError = this.validateThemeId(themeId);
        if (idError) {
            this.logWarn(`Invalid theme ID: ${themeId}`);
            this.emitUsageStats({ action: 'theme.switch', themeId, success: false, timestamp: Date.now() });
            return false;
        }

        const theme = this.getThemeDetails(themeId);
        if (!theme) {
            this.logWarn(`Theme not found: ${themeId}`);
            this.emitUsageStats({ action: 'theme.switch', themeId, success: false, timestamp: Date.now() });
            return false;
        }

        const previousTheme = this.store.currentTheme;
        this.store.currentTheme = themeId;

        if (!this.store.history.includes(themeId)) {
            this.store.history.push(themeId);
            if (this.store.history.length > 20) {
                this.store.history.shift();
            }
        }

        if (previousTheme !== themeId && !this.store.history.includes(previousTheme)) {
            this.store.history.push(previousTheme);
        }

        await this.saveStore();
        this.logInfo(`Theme changed to: ${themeId}`);
        this.emitUsageStats({
            action: 'theme.switch',
            themeId,
            previousThemeId: previousTheme,
            success: true,
            durationMs: Date.now() - start,
            timestamp: Date.now(),
        });
        return true;
    }

    getAllThemes(): Array<{ id: string; name: string; isDark: boolean; isCustom?: boolean }> {
        const builtIn = BUILTIN_THEMES.map(t => ({
            id: t.id,
            name: t.name,
            isDark: t.isDark,
            isCustom: false,
        }));
        const custom = this.store.customThemes.map(t => ({
            id: t.id,
            name: t.name,
            isDark: t.isDark,
            isCustom: true
        }));
        return [...builtIn, ...custom];
    }

    getThemeDetails(themeId: string) {
        const builtIn = BUILTIN_THEMES.find(t => t.id === themeId);
        if (builtIn) {
            return { ...builtIn, isBuiltIn: true };
        }
        const custom = this.store.customThemes.find(t => t.id === themeId);
        if (custom) {
            return { ...custom, isBuiltIn: false };
        }
        return null;
    }

    getCustomThemes(): CustomTheme[] {
        return [...this.store.customThemes];
    }

    async addCustomTheme(theme: Omit<CustomTheme, 'id' | 'createdAt' | 'modifiedAt'>): Promise<CustomTheme | null> {
        const start = Date.now();
        const nameError = this.validateThemeName(theme.name);
        if (nameError) {
            this.logWarn(`Invalid theme name: ${theme.name}`);
            this.emitUsageStats({ action: 'theme.custom.create', success: false, timestamp: Date.now() });
            return null;
        }
        const colorsError = this.validateColors(theme.colors);
        if (colorsError) {
            this.logWarn('Invalid theme colors');
            this.emitUsageStats({ action: 'theme.custom.create', success: false, timestamp: Date.now() });
            return null;
        }

        const customTheme: CustomTheme = {
            ...theme,
            id: `custom-${Date.now()}`,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
        this.store.customThemes.push(customTheme);
        await this.saveStore();
        this.logInfo(`Custom theme added: ${customTheme.id}`);
        this.emitUsageStats({
            action: 'theme.custom.create',
            themeId: customTheme.id,
            source: theme.source,
            success: true,
            durationMs: Date.now() - start,
            timestamp: Date.now(),
        });
        return customTheme;
    }

    async updateCustomTheme(id: string, updates: Partial<CustomTheme>): Promise<boolean> {
        const index = this.store.customThemes.findIndex(t => t.id === id);
        if (index === -1) {
            this.logWarn(`Custom theme not found for update: ${id}`);
            return false;
        }

        this.store.customThemes[index] = {
            ...this.store.customThemes[index],
            ...updates,
            id,
            modifiedAt: Date.now()
        };
        await this.saveStore();
        this.logInfo(`Custom theme updated: ${id}`);
        return true;
    }

    async deleteCustomTheme(id: string): Promise<boolean> {
        const index = this.store.customThemes.findIndex(t => t.id === id);
        if (index === -1) {
            this.logWarn(`Custom theme not found for deletion: ${id}`);
            this.emitUsageStats({ action: 'theme.custom.delete', themeId: id, success: false, timestamp: Date.now() });
            return false;
        }

        this.store.customThemes.splice(index, 1);

        if (this.store.currentTheme === id) {
            await this.setTheme('tengra-black');
        }

        await this.saveStore();
        this.logInfo(`Custom theme deleted: ${id}`);
        this.emitUsageStats({ action: 'theme.custom.delete', themeId: id, success: true, timestamp: Date.now() });
        return true;
    }

    async toggleFavorite(themeId: string): Promise<boolean> {
        const idError = this.validateThemeId(themeId);
        if (idError) {
            this.logWarn(`Invalid theme ID for favorite toggle: ${themeId}`);
            return false;
        }

        const index = this.store.favorites.indexOf(themeId);
        if (index === -1) {
            this.store.favorites.push(themeId);
            this.logInfo(`Theme favorited: ${themeId}`);
        } else {
            this.store.favorites.splice(index, 1);
            this.logInfo(`Theme unfavorited: ${themeId}`);
        }
        await this.saveStore();
        return this.store.favorites.includes(themeId);
    }

    getFavorites(): string[] {
        return [...this.store.favorites];
    }

    isFavorite(themeId: string): boolean {
        return this.store.favorites.includes(themeId);
    }

    getHistory(): string[] {
        return [...this.store.history];
    }

    async clearHistory(): Promise<void> {
        this.store.history = [];
        await this.saveStore();
    }
   
    exportTheme(themeId: string): string | null {
        const theme = this.getThemeDetails(themeId);
        if (!theme) {
            this.emitUsageStats({ action: 'theme.export', themeId, success: false, timestamp: Date.now() });
            return null;
        }

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            theme
        };
        this.emitUsageStats({ action: 'theme.export', themeId, success: true, timestamp: Date.now() });
        return JSON.stringify(exportData, null, 2);
    }

    async importTheme(jsonString: string): Promise<CustomTheme | null> {
        const start = Date.now();
        try {
            const data = safeJsonParse<JsonObject>(jsonString, {});
            if (data.version !== '1.0' || !data.theme) {
                throw new Error('Invalid theme format');
            }

            const themeObject = data.theme as JsonObject;
            this.validateImportedTheme(themeObject);

            const imported = await this.addCustomTheme({
                ...(themeObject as RuntimeValue as CustomTheme),
                isCustom: true,
                source: 'imported'
            });
            if (!imported) {
                throw new Error(ThemeErrorCode.IMPORT_FAILED);
            }
            this.emitUsageStats({
                action: 'theme.import',
                themeId: imported.id,
                source: 'imported',
                success: true,
                durationMs: Date.now() - start,
                timestamp: Date.now(),
            });
            return imported;
        } catch (error) {
            this.logError('Failed to import theme', error);
            this.emitUsageStats({ action: 'theme.import', success: false, durationMs: Date.now() - start, timestamp: Date.now() });
            return null;
        }
    }

    private validateImportedTheme(themeObject: JsonObject): void {
        if (typeof themeObject !== 'object' || Array.isArray(themeObject)) {
            throw new Error(ThemeErrorCode.INVALID_FORMAT);
        }

        if (!themeObject.id || !themeObject.name || !themeObject.colors) {
            throw new Error(ThemeErrorCode.INVALID_FORMAT);
        }

        const themeId = themeObject.id as string;
        const idError = this.validateThemeId(themeId);
        if (idError) {
            throw new Error(ThemeErrorCode.INVALID_ID);
        } 
    }

    async duplicateTheme(themeId: string, newName: string): Promise<CustomTheme | null> {
        const original = this.getThemeDetails(themeId);
        if (!original || !('id' in original)) {
            return null;
        }

        const originalTyped = original as CustomTheme;
        return await this.addCustomTheme({
            ...originalTyped,
            name: newName,
            isCustom: true,
            source: 'user-created'
        });
    }
}


