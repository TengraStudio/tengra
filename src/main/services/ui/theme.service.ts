import * as fs from 'fs';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { BUILTIN_THEMES, getThemeById } from '@main/utils/theme-constants';
import { JsonObject } from '@shared/types/common';
import { CustomTheme, DEFAULT_THEME_PRESETS, ThemePreset } from '@shared/types/theme';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

interface ThemeStoreData {
    currentTheme: string
    customThemes: CustomTheme[]
    favorites: string[]
    history: string[]
    preset: ThemePreset | null
}

/** Structured telemetry event emitted by ThemeService */
export interface ThemeTelemetryEvent {
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
    currentTheme: 'graphite',
    customThemes: [],
    favorites: [],
    history: ['graphite'],
    preset: null
};

export class ThemeService extends BaseService {
    private storePath: string;
    private store: ThemeStoreData = { ...DEFAULT_THEME_STORE };
    private initialized = false;
    private readonly telemetryLog: ThemeTelemetryEvent[] = [];
    private static readonly MAX_TELEMETRY_LOG = 200;

    constructor() {
        super('ThemeService');
        this.storePath = path.join(app.getPath('userData'), 'theme-store.json');
    }

    /** Emits a structured telemetry event and logs it via appLogger. */
    private emitTelemetry(event: ThemeTelemetryEvent): void {
        this.telemetryLog.push(event);
        if (this.telemetryLog.length > ThemeService.MAX_TELEMETRY_LOG) {
            this.telemetryLog.shift();
        }
        this.logInfo(`Telemetry: ${event.action}`, event as unknown as JsonObject);
    }

    /** Returns a copy of the recent telemetry event log. */
    getTelemetryLog(): ReadonlyArray<ThemeTelemetryEvent> {
        return [...this.telemetryLog];
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

    private async saveStore(): Promise<void> {
        try {
            const tempPath = this.storePath + '.tmp';
            await fs.promises.writeFile(tempPath, JSON.stringify(this.store, null, 2), 'utf8');
            await fs.promises.rename(tempPath, this.storePath);
        } catch (error) {
            this.logError('Failed to save theme store', error as Error);
        }
    }



    getCurrentTheme(): string {
        return this.store.currentTheme;
    }

    async setTheme(themeId: string): Promise<boolean> {
        const start = Date.now();
        const theme = getThemeById(themeId) ?? this.store.customThemes.find(t => t.id === themeId);
        if (!theme) {
            this.logWarn(`Theme not found: ${themeId}`);
            this.emitTelemetry({ action: 'theme.switch', themeId, success: false, timestamp: Date.now() });
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
        this.emitTelemetry({
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
        const builtin = BUILTIN_THEMES.map(t => ({
            id: t.id,
            name: t.name,
            isDark: t.isDark
        }));
        const custom = this.store.customThemes.map(t => ({
            id: t.id,
            name: t.name,
            isDark: t.isDark,
            isCustom: true
        }));
        return [...builtin, ...custom];
    }

    getThemeDetails(themeId: string) {
        const builtin = getThemeById(themeId);
        if (builtin) {
            return { ...builtin, isBuiltIn: true };
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

    async addCustomTheme(theme: Omit<CustomTheme, 'id' | 'createdAt' | 'modifiedAt'>): Promise<CustomTheme> {
        const start = Date.now();
        const customTheme: CustomTheme = {
            ...theme,
            id: `custom-${Date.now()}`,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
        this.store.customThemes.push(customTheme);
        await this.saveStore();
        this.logInfo(`Custom theme added: ${customTheme.id}`);
        this.emitTelemetry({
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
            this.emitTelemetry({ action: 'theme.custom.delete', themeId: id, success: false, timestamp: Date.now() });
            return false;
        }

        this.store.customThemes.splice(index, 1);

        if (this.store.currentTheme === id) {
            await this.setTheme('graphite');
        }

        await this.saveStore();
        this.logInfo(`Custom theme deleted: ${id}`);
        this.emitTelemetry({ action: 'theme.custom.delete', themeId: id, success: true, timestamp: Date.now() });
        return true;
    }

    async toggleFavorite(themeId: string): Promise<boolean> {
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

    getPresets(): ThemePreset[] {
        return [...DEFAULT_THEME_PRESETS];
    }

    getPreset(id: string): ThemePreset | undefined {
        return DEFAULT_THEME_PRESETS.find(p => p.id === id);
    }

    async applyPreset(presetId: string): Promise<boolean> {
        const preset = this.getPreset(presetId);
        if (!preset) {
            this.logWarn(`Preset not found: ${presetId}`);
            this.emitTelemetry({ action: 'theme.preset.apply', presetId, success: false, timestamp: Date.now() });
            return false;
        }

        this.store.preset = preset;
        await this.setTheme(preset.themeId);
        this.logInfo(`Preset applied: ${presetId}`);
        this.emitTelemetry({
            action: 'theme.preset.apply',
            presetId,
            themeId: preset.themeId,
            success: true,
            timestamp: Date.now(),
        });
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
            this.emitTelemetry({ action: 'theme.export', themeId, success: false, timestamp: Date.now() });
            return null;
        }

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            theme
        };
        this.emitTelemetry({ action: 'theme.export', themeId, success: true, timestamp: Date.now() });
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
                ...(themeObject as unknown as CustomTheme),
                isCustom: true,
                source: 'imported'
            });
            this.emitTelemetry({
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
            this.emitTelemetry({ action: 'theme.import', success: false, durationMs: Date.now() - start, timestamp: Date.now() });
            return null;
        }
    }

    private validateImportedTheme(themeObject: JsonObject): void {
        if (typeof themeObject !== 'object' || Array.isArray(themeObject)) {
            throw new Error('Invalid theme format');
        }

        if (!themeObject.id || !themeObject.name || !themeObject.colors) {
            throw new Error('Missing required theme properties');
        }

        const themeId = themeObject.id as string;
        if (getThemeById(themeId) || this.store.customThemes.some(t => t.id === themeId)) {
            throw new Error('Theme ID already exists');
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

