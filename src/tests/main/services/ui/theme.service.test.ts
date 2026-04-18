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
 * Unit tests for ThemeService (src/main/services/ui/theme.service.ts)
 * Covers: initialization, theme switching, persistence, custom themes,
 *         favorites, history, presets, import/export, cleanup, error cases
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockAccess = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockRename = vi.fn();

vi.mock('fs', () => ({
    promises: {
        access: mockAccess,
        readFile: mockReadFile,
        writeFile: mockWriteFile,
        rename: mockRename,
    },
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// ── Helpers ──────────────────────────────────────────────────────────

/** Reset fs mocks to default success behaviour */
function resetFsMocks(): void {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockReadFile.mockResolvedValue('{}');
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
}

/** Minimal valid colors object shared across tests */
function colors() {
    return {
        background: '0 0% 0%', foreground: '0 0% 100%',
        card: 'c', cardForeground: 'cf', popover: 'p', popoverForeground: 'pf',
        primary: 'pr', primaryForeground: 'prf', secondary: 's', secondaryForeground: 'sf',
        muted: 'm', mutedForeground: 'mf', accent: 'a', accentForeground: 'af',
        destructive: 'd', destructiveForeground: 'df', border: 'b', input: 'i', ring: 'r',
    };
}

/** Minimal valid custom theme input for tests */
function themeInput(name = 'Test Theme') {
    return {
        name, category: 'artisanal' as const, isDark: true,
        colors: colors(), isCustom: true as const, source: 'user-created' as const,
    };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ThemeService (UI)', () => {
    let ThemeService: { new(): InstanceType<typeof import('@main/services/ui/theme.service').ThemeService> };
    let service: InstanceType<typeof import('@main/services/ui/theme.service').ThemeService>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();

        // Dynamic import to get fresh module per test (avoids shared DEFAULT_THEME_STORE)
        const mod = await import('@main/services/ui/theme.service');
        ThemeService = mod.ThemeService;
        service = new ThemeService();
    });

    // ── Initialization ───────────────────────────────────────────────

    describe('initialize', () => {
        it('should initialize with default store when no file exists', async () => {
            await service.initialize();
            expect(service.getCurrentTheme()).toBe('graphite');
        });

        it('should load persisted store from disk', async () => {
            const persisted = JSON.stringify({
                currentTheme: 'obsidian',
                customThemes: [],
                favorites: ['obsidian'],
                history: ['obsidian'],
                preset: null,
            });
            mockAccess.mockResolvedValue(undefined);
            mockReadFile.mockResolvedValue(persisted);

            await service.initialize();
            expect(service.getCurrentTheme()).toBe('obsidian');
            expect(service.getFavorites()).toContain('obsidian');
        });

        it('should be idempotent – second call is a no-op', async () => {
            await service.initialize();
            await service.initialize();
            expect(service.getCurrentTheme()).toBe('graphite');
        });

        it('should fall back to defaults when store file is corrupt', async () => {
            mockAccess.mockResolvedValue(undefined);
            mockReadFile.mockResolvedValue('not json!!!');

            await service.initialize();
            expect(service.getCurrentTheme()).toBe('graphite');
        });

        it('should merge partial persisted data with defaults', async () => {
            mockAccess.mockResolvedValue(undefined);
            mockReadFile.mockResolvedValue(
                JSON.stringify({ currentTheme: 'midnight' }),
            );

            await service.initialize();
            expect(service.getCurrentTheme()).toBe('midnight');
            // Missing fields should come from defaults
            expect(service.getFavorites()).toEqual([]);
            expect(service.getHistory()).toEqual(['graphite']);
        });

        it('should handle readFile throwing an error', async () => {
            mockAccess.mockResolvedValue(undefined);
            mockReadFile.mockRejectedValue(new Error('EACCES'));

            await service.initialize();
            expect(service.getCurrentTheme()).toBe('graphite');
        });
    });

    // ── Legacy init() ────────────────────────────────────────────────

    describe('init (legacy)', () => {
        it('should delegate to initialize', async () => {
            await service.init();
            expect(service.getCurrentTheme()).toBe('graphite');
        });
    });

    // ── Theme Switching ──────────────────────────────────────────────

    describe('setTheme', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should switch to a valid built-in theme', async () => {
            const result = await service.setTheme('obsidian');
            expect(result).toBe(true);
            expect(service.getCurrentTheme()).toBe('obsidian');
        });

        it('should return false for a non-existent theme', async () => {
            const result = await service.setTheme('does-not-exist');
            expect(result).toBe(false);
            expect(service.getCurrentTheme()).toBe('graphite');
        });

        it('should add the new theme to history', async () => {
            await service.setTheme('midnight');
            expect(service.getHistory()).toContain('midnight');
        });

        it('should not duplicate history entries', async () => {
            await service.setTheme('midnight');
            await service.setTheme('midnight');
            const occurrences = service.getHistory().filter((id: string) => id === 'midnight').length;
            expect(occurrences).toBe(1);
        });

        it('should cap history at 20 entries', async () => {
            const themes = [
                'obsidian', 'midnight', 'deep-forest', 'dracula',
                'cyberpunk', 'matrix', 'synthwave', 'snow',
                'sand', 'sky', 'minimal', 'paper',
                'ocean', 'rose', 'coffee',
            ];

            // Initial history has 'graphite' already
            for (const t of themes) {
                await service.setTheme(t);
            }

            // Add custom themes to go over 20
            for (let i = 0; i < 10; i++) {
                const customTheme = await service.addCustomTheme(themeInput(`Overflow ${i}`));
                await service.setTheme(customTheme!.id);
            }

            expect(service.getHistory().length).toBeLessThanOrEqual(20);
        });

        it('should persist the store after switching', async () => {
            await service.setTheme('obsidian');
            expect(mockWriteFile).toHaveBeenCalled();
            expect(mockRename).toHaveBeenCalled();
        });

        it('should accept a custom theme id', async () => {
            const custom = await service.addCustomTheme(themeInput('My Theme'));
            const result = await service.setTheme(custom!.id);
            expect(result).toBe(true);
            expect(service.getCurrentTheme()).toBe(custom!.id);
        });
    });

    // ── getAllThemes ──────────────────────────────────────────────────

    describe('getAllThemes', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should return all built-in themes', () => {
            const themes = service.getAllThemes();
            expect(themes.length).toBeGreaterThan(0);
            const ids = themes.map((t: { id: string }) => t.id);
            expect(ids).toContain('graphite');
            expect(ids).toContain('obsidian');
        });

        it('should include custom themes with isCustom flag', async () => {
            await service.addCustomTheme(themeInput('Custom'));

            const themes = service.getAllThemes();
            const custom = themes.find((t: { isCustom?: boolean }) => t.isCustom === true);
            expect(custom).toBeDefined();
        });
    });

    // ── getThemeDetails ──────────────────────────────────────────────

    describe('getThemeDetails', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should return built-in theme with isBuiltIn = true', () => {
            const details = service.getThemeDetails('graphite');
            expect(details).not.toBeNull();
            expect(details!.isBuiltIn).toBe(true);
        });

        it('should return custom theme with isBuiltIn = false', async () => {
            const custom = await service.addCustomTheme(themeInput('Detail Test'));
            const details = service.getThemeDetails(custom!.id);
            expect(details).not.toBeNull();
            expect(details!.isBuiltIn).toBe(false);
        });

        it('should return null for unknown theme id', () => {
            expect(service.getThemeDetails('nonexistent')).toBeNull();
        });
    });

    // ── Custom Themes CRUD ───────────────────────────────────────────

    describe('addCustomTheme', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should create a custom theme with generated id and timestamps', async () => {
            const theme = await service.addCustomTheme(themeInput('Brand New'));

            expect(theme!.id).toMatch(/^custom-\d+$/);
            expect(theme!.createdAt).toBeTypeOf('number');
            expect(theme!.modifiedAt).toBeTypeOf('number');
            expect(theme!.name).toBe('Brand New');
        });

        it('should persist after adding', async () => {
            await service.addCustomTheme(themeInput('Persist Me'));
            expect(mockWriteFile).toHaveBeenCalled();
        });
    });

    describe('updateCustomTheme', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should update an existing custom theme', async () => {
            const theme = await service.addCustomTheme(themeInput('Before Update'));

            const result = await service.updateCustomTheme(theme!.id, { name: 'After Update' });
            expect(result).toBe(true);

            const updated = service.getCustomThemes().find(
                (t: { id: string }) => t.id === theme!.id,
            );
            expect(updated!.name).toBe('After Update');
        });

        it('should preserve id even if updates try to change it', async () => {
            const theme = await service.addCustomTheme(themeInput('ID Guard'));

            await service.updateCustomTheme(theme!.id, { id: 'hacked', name: 'Renamed' });
            const found = service.getCustomThemes().find(
                (t: { id: string }) => t.id === theme!.id,
            );
            expect(found).toBeDefined();
            expect(found!.id).toBe(theme!.id);
        });

        it('should update modifiedAt timestamp', async () => {
            const theme = await service.addCustomTheme(themeInput('Timestamp Check'));

            // Small delay so timestamps differ
            await new Promise(resolve => setTimeout(resolve, 10));

            await service.updateCustomTheme(theme!.id, { name: 'Updated' });
            const updated = service.getCustomThemes().find(
                (t: { id: string }) => t.id === theme!.id,
            );
            expect(updated!.modifiedAt).toBeGreaterThanOrEqual(theme!.modifiedAt);
        });

        it('should return false for a non-existent custom theme', async () => {
            const result = await service.updateCustomTheme('nonexistent', { name: 'Nope' });
            expect(result).toBe(false);
        });
    });

    describe('deleteCustomTheme', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should remove a custom theme', async () => {
            const theme = await service.addCustomTheme(themeInput('Delete Me'));

            const result = await service.deleteCustomTheme(theme!.id);
            expect(result).toBe(true);
            expect(service.getCustomThemes().length).toBe(0);
        });

        it('should revert to graphite when deleting the active theme', async () => {
            const theme = await service.addCustomTheme(themeInput('Active Custom'));

            await service.setTheme(theme!.id);
            expect(service.getCurrentTheme()).toBe(theme!.id);

            await service.deleteCustomTheme(theme!.id);
            expect(service.getCurrentTheme()).toBe('graphite');
        });

        it('should return false for a non-existent id', async () => {
            const result = await service.deleteCustomTheme('nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('getCustomThemes', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should return a copy (not the internal array)', async () => {
            await service.addCustomTheme(themeInput('Copy Check'));

            const a = service.getCustomThemes();
            const b = service.getCustomThemes();
            expect(a).not.toBe(b);
            expect(a).toEqual(b);
        });
    });

    // ── Favorites ────────────────────────────────────────────────────

    describe('favorites', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should add a theme to favorites via toggleFavorite', async () => {
            const isFav = await service.toggleFavorite('obsidian');
            expect(isFav).toBe(true);
            expect(service.isFavorite('obsidian')).toBe(true);
            expect(service.getFavorites()).toContain('obsidian');
        });

        it('should remove a theme from favorites on second toggle', async () => {
            await service.toggleFavorite('obsidian');
            const isFav = await service.toggleFavorite('obsidian');
            expect(isFav).toBe(false);
            expect(service.isFavorite('obsidian')).toBe(false);
        });

        it('should persist after toggling', async () => {
            await service.toggleFavorite('midnight');
            expect(mockWriteFile).toHaveBeenCalled();
        });

        it('should return a copy of favorites', () => {
            const a = service.getFavorites();
            const b = service.getFavorites();
            expect(a).not.toBe(b);
        });
    });

    // ── History ──────────────────────────────────────────────────────

    describe('history', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should start with graphite in history', () => {
            expect(service.getHistory()).toEqual(['graphite']);
        });

        it('should clear history', async () => {
            await service.setTheme('obsidian');
            await service.clearHistory();
            expect(service.getHistory()).toEqual([]);
        });

        it('should return a copy of history', () => {
            const a = service.getHistory();
            const b = service.getHistory();
            expect(a).not.toBe(b);
        });
    });

    // ── Presets ──────────────────────────────────────────────────────

    describe('presets', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should return all default presets', () => {
            const presets = service.getPresets();
            expect(presets.length).toBeGreaterThan(0);
            const ids = presets.map((p: { id: string }) => p.id);
            expect(ids).toContain('default');
            expect(ids).toContain('compact');
            expect(ids).toContain('developer');
        });

        it('should find a preset by id', () => {
            const preset = service.getPreset('developer');
            expect(preset).toBeDefined();
            expect(preset!.themeId).toBe('obsidian');
        });

        it('should return undefined for unknown preset', () => {
            expect(service.getPreset('nonexistent')).toBeUndefined();
        });

        it('should apply a preset and switch to its theme', async () => {
            const result = await service.applyPreset('developer');
            expect(result).toBe(true);
            expect(service.getCurrentTheme()).toBe('obsidian');
            expect(service.getCurrentPreset()).not.toBeNull();
            expect(service.getCurrentPreset()!.id).toBe('developer');
        });

        it('should return false when applying a non-existent preset', async () => {
            const result = await service.applyPreset('nonexistent');
            expect(result).toBe(false);
        });

        it('should clear the current preset', async () => {
            await service.applyPreset('developer');
            await service.clearPreset();
            expect(service.getCurrentPreset()).toBeNull();
        });

        it('should have null preset initially', () => {
            expect(service.getCurrentPreset()).toBeNull();
        });
    });
});

