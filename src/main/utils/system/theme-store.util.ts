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

import { appLogger } from '@main/logging/logger';
import { getDataFilePath } from '@main/services/system/app-layout-paths.util';
import { CustomTheme, DEFAULT_THEME_PRESETS, ThemePreset } from '@shared/types/system/theme';
import { safeJsonParse } from '@shared/utils/system/sanitize.util';

interface ThemeStoreData {
    currentTheme: string;
    customThemes: CustomTheme[];
    favorites: string[];
    history: string[];
    preset: ThemePreset | null;
}

class ThemeStore {
    private static instance: ThemeStore | null = null;
    private storePath: string;
    private store: ThemeStoreData = {
        currentTheme: 'tengra-white',
        customThemes: [],
        favorites: [],
        history: [''],
        preset: null
    };

    private constructor() {
        this.storePath = getDataFilePath('themes', 'theme-store.json');
        // Initialize with defaults, call init() for async loading
        void this.init();
    }

    async init(): Promise<void> {
        this.store = await this.loadStore();
    }

    static getInstance(): ThemeStore {
        ThemeStore.instance ??= new ThemeStore();
        return ThemeStore.instance;
    }

    private async loadStore(): Promise<ThemeStoreData> {
        try {
            await fs.promises.access(this.storePath);
            const data = await fs.promises.readFile(this.storePath, 'utf8');
            const loaded = safeJsonParse<ThemeStoreData>(data, {
                currentTheme: 'tengra-white',
                customThemes: [],
                favorites: [],
                history: [''],
                preset: null
            });
            return { ...loaded };
        } catch {
            appLogger.warn('ThemeStore', 'Failed to load, using defaults');
        }
        return { currentTheme: 'tengra-white', customThemes: [], favorites: [], history: [''], preset: null };
    }

    private async saveStore(): Promise<void> {
        try {
            const tempPath = this.storePath + '.tmp';
            await fs.promises.writeFile(tempPath, JSON.stringify(this.store, null, 2), 'utf8');
            await fs.promises.rename(tempPath, this.storePath);
        } catch (error) {
            appLogger.error('ThemeStore', 'Failed to save', error as Error);
        }
    }

    getCurrentTheme(): string {
        return this.store.currentTheme;
    }

    async setTheme(themeId: string): Promise<boolean> {
        const theme = this.store.customThemes.find(t => t.id === themeId);
        if (!theme) {
            appLogger.warn('ThemeStore', `Theme not found: ${themeId}`);
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
        appLogger.info('ThemeStore', `Theme changed to: ${themeId}`);
        return true;
    }

    getAllThemes(): Array<{ id: string; name: string; isDark: boolean; isCustom?: boolean }> {
        const custom = this.store.customThemes.map(t => ({
            id: t.id,
            name: t.name,
            isDark: t.isDark,
            isCustom: true
        }));
        return [...custom];
    }

    getThemeDetails(themeId: string) {
        const custom = this.store.customThemes.find(t => t.id === themeId);
        if (custom) {
            return { ...custom, isBuiltIn: false };
        }
        return null;
    }

    getCustomThemes(): CustomTheme[] {
        return [...this.store.customThemes];
    }

    async addCustomTheme(theme: Omit<CustomTheme, 'id' | 'createdAt' | 'modifiedAt'>): Promise<CustomTheme> {
        const customTheme: CustomTheme = {
            ...theme,
            id: `custom-${Date.now()}`,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
        this.store.customThemes.push(customTheme);
        await this.saveStore();
        appLogger.info('ThemeStore', `Custom theme added: ${customTheme.id}`);
        return customTheme;
    }

    async updateCustomTheme(id: string, updates: Partial<CustomTheme>): Promise<boolean> {
        const index = this.store.customThemes.findIndex(t => t.id === id);
        if (index === -1) {
            appLogger.warn('ThemeStore', `Custom theme not found: ${id}`);
            return false;
        }

        this.store.customThemes[index] = {
            ...this.store.customThemes[index],
            ...updates,
            id,
            modifiedAt: Date.now()
        };
        await this.saveStore();
        appLogger.info('ThemeStore', `Custom theme updated: ${id}`);
        return true;
    }

    async deleteCustomTheme(id: string): Promise<boolean> {
        const index = this.store.customThemes.findIndex(t => t.id === id);
        if (index === -1) {
            appLogger.warn('ThemeStore', `Custom theme not found: ${id}`);
            return false;
        }

        this.store.customThemes.splice(index, 1);

        if (this.store.currentTheme === id) {
            await this.setTheme('graphite');
        }

        await this.saveStore();
        appLogger.info('ThemeStore', `Custom theme deleted: ${id}`);
        return true;
    }

    async toggleFavorite(themeId: string): Promise<boolean> {
        const index = this.store.favorites.indexOf(themeId);
        if (index === -1) {
            this.store.favorites.push(themeId);
            appLogger.info('ThemeStore', `Theme favorited: ${themeId}`);
        } else {
            this.store.favorites.splice(index, 1);
            appLogger.info('ThemeStore', `Theme unfavorited: ${themeId}`);
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

    getPresets(): ThemePreset[] {
        return [...DEFAULT_THEME_PRESETS];
    }

    getPreset(id: string): ThemePreset | undefined {
        return DEFAULT_THEME_PRESETS.find(p => p.id === id);
    }

    async applyPreset(presetId: string): Promise<boolean> {
        const preset = this.getPreset(presetId);
        if (!preset) {
            appLogger.warn('ThemeStore', `Preset not found: ${presetId}`);
            return false;
        }

        this.store.preset = preset;
        await this.setTheme(preset.themeId);
        appLogger.info('ThemeStore', `Preset applied: ${presetId}`);
        return true;
    }

    getCurrentPreset(): ThemePreset | null {
        return this.store.preset;
    }

    async clearPreset(): Promise<void> {
        this.store.preset = null;
        await this.saveStore();
    }

    exportTheme(themeId: string): string | null {
        const theme = this.getThemeDetails(themeId);
        if (!theme) {
            return null;
        }

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            theme
        };
        return JSON.stringify(exportData, null, 2);
    }

    async importTheme(jsonString: string): Promise<CustomTheme | null> {
        try {
            const data = safeJsonParse<{ version?: string; theme?: CustomTheme }>(jsonString, {});
            if (data.version !== '1.0' || !data.theme) {
                throw new Error('Invalid theme format');
            }

            const theme = data.theme;
            const themeName = theme.name;
            if (!themeName) {
                throw new Error('Missing required theme properties');
            }

            if (this.store.customThemes.some(t => t.id === theme.id)) {
                throw new Error('Theme ID already exists');
            }

            return this.addCustomTheme({
                ...theme,
                isCustom: true,
                source: 'imported'
            });
        } catch (error) {
            appLogger.error('ThemeStore', 'Failed to import theme', error as Error);
            return null;
        }
    }

    async duplicateTheme(themeId: string, newName: string): Promise<CustomTheme | null> {
        const original = this.getThemeDetails(themeId);
        if (!original || 'isBuiltIn' in original) {
            return null;
        }

        const originalTyped = original as CustomTheme;
        return this.addCustomTheme({
            ...originalTyped,
            name: newName,
            isCustom: true,
            source: 'user-created'
        });
    }
}


// Export a robust singleton getter or just the class?
// Usage in ipc/theme.ts expects 'themeStore'
// We can use a Proxy to lazy load it.

const themeStoreProxy = new Proxy({} as ThemeStore, {
    get: (_target, prop: string | symbol) => {
        const instance = ThemeStore.getInstance();
        return Reflect.get(instance as object, prop);
    }
});

export const themeStore = themeStoreProxy; 
