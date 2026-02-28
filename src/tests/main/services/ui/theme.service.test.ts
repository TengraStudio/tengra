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

// ── Tests ────────────────────────────────────────────────────────────

// eslint-disable-next-line max-lines-per-function
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
                const customTheme = await service.addCustomTheme({
                    name: `Overflow ${i}`,
                    category: 'elite-dark' as const,
                    isDark: true,
                    colors: {
                        background: '0 0% 0%',
                        foreground: '0 0% 100%',
                        card: '', cardForeground: '', popover: '', popoverForeground: '',
                        primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                        muted: '', mutedForeground: '', accent: '', accentForeground: '',
                        destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                    },
                    isCustom: true as const,
                    source: 'user-created' as const,
                });
                await service.setTheme(customTheme.id);
            }

            expect(service.getHistory().length).toBeLessThanOrEqual(20);
        });

        it('should persist the store after switching', async () => {
            await service.setTheme('obsidian');
            expect(mockWriteFile).toHaveBeenCalled();
            expect(mockRename).toHaveBeenCalled();
        });

        it('should accept a custom theme id', async () => {
            const custom = await service.addCustomTheme({
                name: 'My Theme',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });
            const result = await service.setTheme(custom.id);
            expect(result).toBe(true);
            expect(service.getCurrentTheme()).toBe(custom.id);
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
            await service.addCustomTheme({
                name: 'Custom',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

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
            const custom = await service.addCustomTheme({
                name: 'Detail Test',
                category: 'artisanal' as const,
                isDark: false,
                colors: {
                    background: '0 0% 100%',
                    foreground: '0 0% 0%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });
            const details = service.getThemeDetails(custom.id);
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
            const theme = await service.addCustomTheme({
                name: 'Brand New',
                category: 'elite-dark' as const,
                isDark: true,
                colors: {
                    background: '0 0% 5%',
                    foreground: '0 0% 95%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

            expect(theme.id).toMatch(/^custom-\d+$/);
            expect(theme.createdAt).toBeTypeOf('number');
            expect(theme.modifiedAt).toBeTypeOf('number');
            expect(theme.name).toBe('Brand New');
        });

        it('should persist after adding', async () => {
            await service.addCustomTheme({
                name: 'Persist Me',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });
            expect(mockWriteFile).toHaveBeenCalled();
        });
    });

    describe('updateCustomTheme', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should update an existing custom theme', async () => {
            const theme = await service.addCustomTheme({
                name: 'Before Update',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

            const result = await service.updateCustomTheme(theme.id, { name: 'After Update' });
            expect(result).toBe(true);

            const updated = service.getCustomThemes().find(
                (t: { id: string }) => t.id === theme.id,
            );
            expect(updated!.name).toBe('After Update');
        });

        it('should preserve id even if updates try to change it', async () => {
            const theme = await service.addCustomTheme({
                name: 'ID Guard',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

            await service.updateCustomTheme(theme.id, { id: 'hacked', name: 'Renamed' });
            const found = service.getCustomThemes().find(
                (t: { id: string }) => t.id === theme.id,
            );
            expect(found).toBeDefined();
            expect(found!.id).toBe(theme.id);
        });

        it('should update modifiedAt timestamp', async () => {
            const theme = await service.addCustomTheme({
                name: 'Timestamp Check',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

            // Small delay so timestamps differ
            await new Promise(resolve => setTimeout(resolve, 10));

            await service.updateCustomTheme(theme.id, { name: 'Updated' });
            const updated = service.getCustomThemes().find(
                (t: { id: string }) => t.id === theme.id,
            );
            expect(updated!.modifiedAt).toBeGreaterThanOrEqual(theme.modifiedAt);
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
            const theme = await service.addCustomTheme({
                name: 'Delete Me',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

            const result = await service.deleteCustomTheme(theme.id);
            expect(result).toBe(true);
            expect(service.getCustomThemes().length).toBe(0);
        });

        it('should revert to graphite when deleting the active theme', async () => {
            const theme = await service.addCustomTheme({
                name: 'Active Custom',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

            await service.setTheme(theme.id);
            expect(service.getCurrentTheme()).toBe(theme.id);

            await service.deleteCustomTheme(theme.id);
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
            await service.addCustomTheme({
                name: 'Copy Check',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

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

    // ── Export / Import ──────────────────────────────────────────────

    describe('exportTheme', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should export a built-in theme as JSON string', () => {
            const json = service.exportTheme('graphite');
            expect(json).not.toBeNull();
            const parsed = JSON.parse(json as string);
            expect(parsed.version).toBe('1.0');
            expect(parsed.theme).toBeDefined();
            expect(parsed.exportedAt).toBeDefined();
        });

        it('should return null for an unknown theme', () => {
            expect(service.exportTheme('nonexistent')).toBeNull();
        });
    });

    describe('importTheme', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should import a valid exported theme', async () => {
            const exportData = JSON.stringify({
                version: '1.0',
                theme: {
                    id: 'imported-theme-123',
                    name: 'Imported',
                    isDark: true,
                    category: 'artisanal',
                    colors: {
                        background: '0 0% 0%',
                        foreground: '0 0% 100%',
                        card: '', cardForeground: '', popover: '', popoverForeground: '',
                        primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                        muted: '', mutedForeground: '', accent: '', accentForeground: '',
                        destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                    },
                },
            });

            const result = await service.importTheme(exportData);
            expect(result).not.toBeNull();
            expect(result!.name).toBe('Imported');
            expect(result!.source).toBe('imported');
        });

        it('should return null for invalid version', async () => {
            const data = JSON.stringify({ version: '2.0', theme: {} });
            const result = await service.importTheme(data);
            expect(result).toBeNull();
        });

        it('should return null for missing theme field', async () => {
            const data = JSON.stringify({ version: '1.0' });
            const result = await service.importTheme(data);
            expect(result).toBeNull();
        });

        it('should return null for invalid JSON', async () => {
            const result = await service.importTheme('not-json{{{');
            expect(result).toBeNull();
        });

        it('should return null when theme is missing required properties', async () => {
            const data = JSON.stringify({
                version: '1.0',
                theme: { id: 'missing-name' },
            });
            const result = await service.importTheme(data);
            expect(result).toBeNull();
        });

        it('should return null when theme id already exists as built-in', async () => {
            const data = JSON.stringify({
                version: '1.0',
                theme: {
                    id: 'graphite',
                    name: 'Graphite Clone',
                    colors: {
                        background: '0 0% 0%',
                        foreground: '0 0% 100%',
                        card: '', cardForeground: '', popover: '', popoverForeground: '',
                        primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                        muted: '', mutedForeground: '', accent: '', accentForeground: '',
                        destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                    },
                },
            });
            const result = await service.importTheme(data);
            expect(result).toBeNull();
        });

        it('should return null when theme id already exists as custom', async () => {
            const custom = await service.addCustomTheme({
                name: 'Existing',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

            const data = JSON.stringify({
                version: '1.0',
                theme: {
                    id: custom.id,
                    name: 'Duplicate',
                    colors: {
                        background: '0 0% 0%',
                        foreground: '0 0% 100%',
                        card: '', cardForeground: '', popover: '', popoverForeground: '',
                        primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                        muted: '', mutedForeground: '', accent: '', accentForeground: '',
                        destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                    },
                },
            });
            const result = await service.importTheme(data);
            expect(result).toBeNull();
        });
    });

    // ── duplicateTheme ───────────────────────────────────────────────

    describe('duplicateTheme', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should duplicate a built-in theme with a new name', async () => {
            const dup = await service.duplicateTheme('graphite', 'Graphite Copy');
            expect(dup).not.toBeNull();
            expect(dup!.name).toBe('Graphite Copy');
            expect(dup!.id).toMatch(/^custom-\d+$/);
        });

        it('should return null when duplicating a non-existent theme', async () => {
            const dup = await service.duplicateTheme('nonexistent', 'Nope');
            expect(dup).toBeNull();
        });
    });

    // ── Persistence (saveStore) ──────────────────────────────────────

    describe('persistence', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should write to a temp file then rename (atomic save)', async () => {
            await service.setTheme('obsidian');
            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('.tmp'),
                expect.stringContaining('obsidian'),
                'utf8',
            );
            expect(mockRename).toHaveBeenCalled();
        });

        it('should not throw when writeFile fails', async () => {
            mockWriteFile.mockRejectedValue(new Error('ENOSPC'));
            await expect(service.setTheme('obsidian')).resolves.toBe(true);
        });

        it('should not throw when rename fails', async () => {
            mockRename.mockRejectedValue(new Error('EACCES'));
            await expect(service.setTheme('obsidian')).resolves.toBe(true);
        });
    });

    // ── Cleanup ──────────────────────────────────────────────────────

    describe('cleanup', () => {
        it('should save store on cleanup when initialized', async () => {
            await service.initialize();
            await service.cleanup();
            // writeFile is called during cleanup via saveStore
            expect(mockWriteFile).toHaveBeenCalled();
        });

        it('should not save when not initialized', async () => {
            await service.cleanup();
            expect(mockWriteFile).not.toHaveBeenCalled();
        });

        it('should be safe to call cleanup multiple times', async () => {
            await service.initialize();
            await service.cleanup();
            await service.cleanup();
            // Should not throw
        });
    });

    // ── Error Resilience ─────────────────────────────────────────────

    describe('error resilience', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('should handle saveStore failure gracefully during setTheme', async () => {
            mockWriteFile.mockRejectedValue(new Error('disk error'));
            const result = await service.setTheme('obsidian');
            // setTheme should still return true (in-memory update succeeds)
            expect(result).toBe(true);
            expect(service.getCurrentTheme()).toBe('obsidian');
        });

        it('should handle saveStore failure during addCustomTheme', async () => {
            mockWriteFile.mockRejectedValue(new Error('disk error'));

            const theme = await service.addCustomTheme({
                name: 'Error Test',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });
            // In-memory state is still updated
            expect(theme).toBeDefined();
        });

        it('should handle saveStore failure during toggleFavorite', async () => {
            mockWriteFile.mockRejectedValue(new Error('disk error'));
            const result = await service.toggleFavorite('obsidian');
            expect(typeof result).toBe('boolean');
        });

        it('should handle saveStore failure during clearHistory', async () => {
            mockWriteFile.mockRejectedValue(new Error('disk error'));
            await expect(service.clearHistory()).resolves.not.toThrow();
        });
    });
});

// ── Telemetry Events & Health Tracking ──────────────────────────────

describe('ThemeService Telemetry & Health', () => {
    let ThemeService: { new(): InstanceType<typeof import('@main/services/ui/theme.service').ThemeService> };
    let service: InstanceType<typeof import('@main/services/ui/theme.service').ThemeService>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        resetFsMocks();

        const mod = await import('@main/services/ui/theme.service');
        ThemeService = mod.ThemeService;
        service = new ThemeService();
        await service.initialize();
    });

    // ── getHealth ────────────────────────────────────────────────────

    describe('getHealth', () => {
        it('should return correct health snapshot after initialization', () => {
            const health = service.getHealth();
            expect(health.initialized).toBe(true);
            expect(health.currentTheme).toBe('graphite');
            expect(health.customThemeCount).toBe(0);
            expect(health.favoriteCount).toBe(0);
            expect(health.historySize).toBe(1);
            expect(health.hasActivePreset).toBe(false);
            expect(typeof health.storePath).toBe('string');
        });

        it('should reflect custom theme count after adding themes', async () => {
            await service.addCustomTheme({
                name: 'Health Test',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%', foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });
            expect(service.getHealth().customThemeCount).toBe(1);
        });

        it('should reflect active preset', async () => {
            await service.applyPreset('developer');
            expect(service.getHealth().hasActivePreset).toBe(true);
        });

        it('should reflect favorite count', async () => {
            await service.toggleFavorite('obsidian');
            expect(service.getHealth().favoriteCount).toBe(1);
        });
    });

    // ── getHealth before initialization ──────────────────────────────

    describe('getHealth before initialization', () => {
        it('should return initialized: false before initialize()', async () => {
            vi.resetModules();
            vi.clearAllMocks();
            resetFsMocks();
            const mod = await import('@main/services/ui/theme.service');
            const uninitializedService = new mod.ThemeService();
            expect(uninitializedService.getHealth().initialized).toBe(false);
        });
    });

    // ── Telemetry on theme switch ────────────────────────────────────

    describe('telemetry on setTheme', () => {
        it('should emit theme.switch event on successful switch', async () => {
            await service.setTheme('obsidian');
            const events = service.getTelemetryLog();
            const switchEvent = events.find(e => e.action === 'theme.switch' && e.success);
            expect(switchEvent).toBeDefined();
            expect(switchEvent!.themeId).toBe('obsidian');
            expect(switchEvent!.previousThemeId).toBe('graphite');
            expect(typeof switchEvent!.durationMs).toBe('number');
            expect(typeof switchEvent!.timestamp).toBe('number');
        });

        it('should emit theme.switch failure event for invalid theme', async () => {
            await service.setTheme('nonexistent');
            const events = service.getTelemetryLog();
            const failEvent = events.find(e => e.action === 'theme.switch' && !e.success);
            expect(failEvent).toBeDefined();
            expect(failEvent!.themeId).toBe('nonexistent');
        });
    });

    // ── Telemetry on custom theme creation ───────────────────────────

    describe('telemetry on addCustomTheme', () => {
        it('should emit theme.custom.create event', async () => {
            const theme = await service.addCustomTheme({
                name: 'Telemetry Test',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%', foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

            const events = service.getTelemetryLog();
            const createEvent = events.find(e => e.action === 'theme.custom.create');
            expect(createEvent).toBeDefined();
            expect(createEvent!.themeId).toBe(theme.id);
            expect(createEvent!.source).toBe('user-created');
            expect(createEvent!.success).toBe(true);
            expect(typeof createEvent!.durationMs).toBe('number');
        });
    });

    // ── Telemetry on custom theme deletion ───────────────────────────

    describe('telemetry on deleteCustomTheme', () => {
        it('should emit success event on delete', async () => {
            const theme = await service.addCustomTheme({
                name: 'Delete Me',
                category: 'artisanal' as const,
                isDark: true,
                colors: {
                    background: '0 0% 0%', foreground: '0 0% 100%',
                    card: '', cardForeground: '', popover: '', popoverForeground: '',
                    primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                    muted: '', mutedForeground: '', accent: '', accentForeground: '',
                    destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                },
                isCustom: true as const,
                source: 'user-created' as const,
            });

            await service.deleteCustomTheme(theme.id);
            const events = service.getTelemetryLog();
            const deleteEvent = events.find(e => e.action === 'theme.custom.delete' && e.success);
            expect(deleteEvent).toBeDefined();
            expect(deleteEvent!.themeId).toBe(theme.id);
        });

        it('should emit failure event for non-existent id', async () => {
            await service.deleteCustomTheme('nonexistent');
            const events = service.getTelemetryLog();
            const failEvent = events.find(e => e.action === 'theme.custom.delete' && !e.success);
            expect(failEvent).toBeDefined();
            expect(failEvent!.themeId).toBe('nonexistent');
        });
    });

    // ── Telemetry on export ──────────────────────────────────────────

    describe('telemetry on exportTheme', () => {
        it('should emit success event on valid export', () => {
            service.exportTheme('graphite');
            const events = service.getTelemetryLog();
            const exportEvent = events.find(e => e.action === 'theme.export' && e.success);
            expect(exportEvent).toBeDefined();
            expect(exportEvent!.themeId).toBe('graphite');
        });

        it('should emit failure event for unknown theme', () => {
            service.exportTheme('nonexistent');
            const events = service.getTelemetryLog();
            const failEvent = events.find(e => e.action === 'theme.export' && !e.success);
            expect(failEvent).toBeDefined();
            expect(failEvent!.themeId).toBe('nonexistent');
        });
    });

    // ── Telemetry on import ──────────────────────────────────────────

    describe('telemetry on importTheme', () => {
        it('should emit success event on valid import', async () => {
            const exportData = JSON.stringify({
                version: '1.0',
                theme: {
                    id: 'import-telemetry-test',
                    name: 'Imported Telemetry',
                    isDark: true,
                    category: 'artisanal',
                    colors: {
                        background: '0 0% 0%', foreground: '0 0% 100%',
                        card: '', cardForeground: '', popover: '', popoverForeground: '',
                        primary: '', primaryForeground: '', secondary: '', secondaryForeground: '',
                        muted: '', mutedForeground: '', accent: '', accentForeground: '',
                        destructive: '', destructiveForeground: '', border: '', input: '', ring: '',
                    },
                },
            });

            const result = await service.importTheme(exportData);
            expect(result).not.toBeNull();

            const events = service.getTelemetryLog();
            const importEvent = events.find(e => e.action === 'theme.import' && e.success);
            expect(importEvent).toBeDefined();
            expect(importEvent!.source).toBe('imported');
            expect(typeof importEvent!.durationMs).toBe('number');
        });

        it('should emit failure event on invalid import', async () => {
            await service.importTheme('not-json{{{');
            const events = service.getTelemetryLog();
            const failEvent = events.find(e => e.action === 'theme.import' && !e.success);
            expect(failEvent).toBeDefined();
            expect(typeof failEvent!.durationMs).toBe('number');
        });

        it('should emit failure event for wrong version', async () => {
            const data = JSON.stringify({ version: '2.0', theme: {} });
            await service.importTheme(data);
            const events = service.getTelemetryLog();
            const failEvent = events.find(e => e.action === 'theme.import' && !e.success);
            expect(failEvent).toBeDefined();
        });
    });

    // ── Telemetry on preset application ──────────────────────────────

    describe('telemetry on applyPreset', () => {
        it('should emit success event on valid preset', async () => {
            await service.applyPreset('developer');
            const events = service.getTelemetryLog();
            const presetEvent = events.find(e => e.action === 'theme.preset.apply' && e.success);
            expect(presetEvent).toBeDefined();
            expect(presetEvent!.presetId).toBe('developer');
            expect(presetEvent!.themeId).toBe('obsidian');
        });

        it('should emit failure event for non-existent preset', async () => {
            await service.applyPreset('nonexistent');
            const events = service.getTelemetryLog();
            const failEvent = events.find(e => e.action === 'theme.preset.apply' && !e.success);
            expect(failEvent).toBeDefined();
            expect(failEvent!.presetId).toBe('nonexistent');
        });
    });

    // ── Telemetry log capping ────────────────────────────────────────

    describe('telemetry log capping', () => {
        it('should cap telemetry log at MAX_TELEMETRY_LOG entries', async () => {
            // Trigger more than 200 events via export (sync, fast)
            for (let i = 0; i < 210; i++) {
                service.exportTheme('graphite');
            }
            const events = service.getTelemetryLog();
            expect(events.length).toBeLessThanOrEqual(200);
        });
    });

    // ── getTelemetryLog returns copy ─────────────────────────────────

    describe('getTelemetryLog', () => {
        it('should return a copy of the log', async () => {
            await service.setTheme('obsidian');
            const a = service.getTelemetryLog();
            const b = service.getTelemetryLog();
            expect(a).not.toBe(b);
            expect(a).toEqual(b);
        });

        it('should be empty initially', () => {
            expect(service.getTelemetryLog().length).toBe(0);
        });
    });
});
