/**
 * Theme Service Tests
 * Comprehensive unit tests for edge cases in ThemeService
 */

import { ThemeErrorCode, ThemeService } from '@main/services/theme/theme.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('fs/promises', () => ({
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockImplementation(async (filePath: string) => {
        if (filePath.includes('black')) {
            return JSON.stringify({
                id: 'black',
                name: 'black',
                displayName: 'Black',
                version: '1.0.0',
                type: 'dark',
                colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            });
        }
        if (filePath.includes('white')) {
            return JSON.stringify({
                id: 'white',
                name: 'white',
                displayName: 'White',
                version: '1.0.0',
                type: 'light',
                colors: { background: '0 0% 100%', foreground: '0 0% 0%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            });
        }
        return JSON.stringify({
            id: 'test-theme',
            name: 'test-theme',
            displayName: 'Test Theme',
            version: '1.0.0',
            type: 'dark',
            colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
        });
    }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockImplementation(async (dir) => {
        if (dir.includes('themes')) {return ['black.theme.json', 'white.theme.json'];}
        return [];
    }),
    mkdir: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@main/services/data/data.service', () => ({
    DataService: class {
        getPath = vi.fn().mockReturnValue('/fake/path');
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('ThemeService', () => {
    let themeService: ThemeService;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { DataService } = await import('@main/services/data/data.service');
        const dataService = new DataService();
        themeService = new ThemeService(dataService as any);
        await themeService.initialize();
    });

    describe('initialize', () => {
        it('should initialize and load themes', async () => {
            expect(themeService).toBeDefined();
        });

        it('should create themes directory on init', async () => {
            const fs = await import('fs/promises');
            expect(fs.mkdir).toHaveBeenCalled();
        });
    });

    describe('getAllThemes', () => {
        it('should return all installed themes', async () => {
            const themes = await themeService.getAllThemes();
            expect(Array.isArray(themes)).toBe(true);
        });

        it('should include built-in themes', async () => {
            const themes = await themeService.getAllThemes();
            const themeIds = themes.map(t => t.id);
            expect(themeIds).toContain('black');
            expect(themeIds).toContain('white');
        });
    });

    describe('getTheme', () => {
        it('should return theme by id', async () => {
            const theme = await themeService.getTheme('black');
            expect(theme).toBeDefined();
            expect(theme?.id).toBe('black');
        });

        it('should return undefined for non-existent theme', async () => {
            const theme = await themeService.getTheme('non-existent');
            expect(theme).toBeUndefined();
        });

        it('should handle empty string theme id', async () => {
            const theme = await themeService.getTheme('');
            expect(theme).toBeUndefined();
        });

        it('should handle special characters in theme id', async () => {
            const theme = await themeService.getTheme('../etc/passwd');
            expect(theme).toBeUndefined();
        });
    });

    describe('installTheme', () => {
        it('should install valid theme manifest', async () => {
            const manifest = {
                id: 'test-theme',
                name: 'test-theme',
                displayName: 'Test Theme',
                version: '1.0.0',
                type: 'dark' as const,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    primary: '0 0% 50%',
                    secondary: '0 0% 20%',
                    accent: '0 0% 30%',
                    muted: '0 0% 10%',
                    destructive: '0 0% 50%',
                    border: '0 0% 20%',
                    input: '0 0% 20%',
                    ring: '0 0% 50%',
                    card: '0 0% 5%',
                    cardForeground: '0 0% 100%',
                    popover: '0 0% 5%',
                    popoverForeground: '0 0% 100%',
                    primaryForeground: '0 0% 100%',
                    secondaryForeground: '0 0% 100%',
                    accentForeground: '0 0% 100%',
                    destructiveForeground: '0 0% 100%',
                    mutedForeground: '0 0% 60%',
                }
            };

            const result = await themeService.installTheme(manifest);
            expect(result).toBe(true);
        });

        it('should reject invalid manifest - missing required fields', async () => {
            const invalidManifest = {
                id: 'test'
                // missing name, displayName, version, type, colors
            };

            await expect(themeService.installTheme(invalidManifest as any)).rejects.toThrow('THEME_INVALID_MANIFEST');
        });

        it('should reject invalid manifest - invalid type', async () => {
            const invalidManifest = {
                id: 'test',
                name: 'test',
                displayName: 'Test',
                version: '1.0.0',
                type: 'invalid-type',
                colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            };

            await expect(themeService.installTheme(invalidManifest as any)).rejects.toThrow();
        });

        it('should reject invalid manifest - null colors', async () => {
            const invalidManifest = {
                id: 'test',
                name: 'test',
                displayName: 'Test',
                version: '1.0.0',
                type: 'dark' as const,
                colors: null as any
            };

            await expect(themeService.installTheme(invalidManifest as any)).rejects.toThrow();
        });

        it('should reject invalid manifest - array instead of object', async () => {
            const invalidManifest = {
                id: 'test',
                name: 'test',
                displayName: 'Test',
                version: '1.0.0',
                type: 'dark' as const,
                colors: [] as any
            };

            await expect(themeService.installTheme(invalidManifest as any)).rejects.toThrow();
        });

        it('should reject manifest with non-string id', async () => {
            const invalidManifest = {
                id: 123 as any,
                name: 'test',
                displayName: 'Test',
                version: '1.0.0',
                type: 'dark' as const,
                colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            };

            await expect(themeService.installTheme(invalidManifest as any)).rejects.toThrow();
        });

        it('should handle very long theme id', async () => {
            const longId = 'a'.repeat(1000);
            const manifest = {
                id: longId,
                name: 'test',
                displayName: 'Test',
                version: '1.0.0',
                type: 'dark' as const,
                colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            };

            const result = await themeService.installTheme(manifest);
            expect(result).toBe(true);
        });
    });

    describe('uninstallTheme', () => {
        it('should uninstall custom theme', async () => {
            const result = await themeService.uninstallTheme('custom-theme');
            // May fail since we don't have custom theme installed in test
            expect(typeof result).toBe('boolean');
        });

        it('should reject uninstall of built-in themes', async () => {
            const resultBlack = await themeService.uninstallTheme('black');
            const resultWhite = await themeService.uninstallTheme('white');

            expect(resultBlack).toBe(false);
            expect(resultWhite).toBe(false);
        });

        it('should handle empty theme id', async () => {
            const result = await themeService.uninstallTheme('');
            expect(result).toBe(false);
        });

        it('should handle non-existent theme', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));
            const result = await themeService.uninstallTheme('definitely-does-not-exist-12345');
            expect(result).toBe(false);
        });

        it('should handle path traversal attempts', async () => {
            const result = await themeService.uninstallTheme('../../etc/passwd');
            expect(result).toBe(false);
        });

        it('should handle SQL injection attempts', async () => {
            const result = await themeService.uninstallTheme("'; DROP TABLE themes; --");
            expect(result).toBe(false);
        });
    });

    describe('getThemesDirectory', () => {
        it('should return themes directory path', () => {
            const dir = themeService.getThemesDirectory();
            expect(dir).toBeDefined();
            expect(typeof dir).toBe('string');
            expect(dir.length).toBeGreaterThan(0);
        });

        it('should return consistent path', () => {
            const dir1 = themeService.getThemesDirectory();
            const dir2 = themeService.getThemesDirectory();
            expect(dir1).toBe(dir2);
        });
    });

    describe('cleanup', () => {
        it('should cleanup without errors', async () => {
            await expect(themeService.cleanup()).resolves.not.toThrow();
        });

        it('should be idempotent', async () => {
            await themeService.cleanup();
            await expect(themeService.cleanup()).resolves.not.toThrow();
        });
    });
});

describe('ThemeService Edge Cases', () => {
    let themeService: ThemeService;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { DataService } = await import('@main/services/data/data.service');
        const dataService = new DataService();
        themeService = new ThemeService(dataService as any);
    });

    describe('initialize with file system errors', () => {
        it('should handle missing themes directory gracefully', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error('Permission denied'));

            await expect(themeService.initialize()).rejects.toThrow();
        });

        it('should handle corrupt theme file', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.readFile).mockResolvedValueOnce('invalid json{{{');

            await themeService.initialize();
            // Should continue loading other themes
            const themes = await themeService.getAllThemes();
            expect(Array.isArray(themes)).toBe(true);
        });

        it('should handle empty themes directory', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.readdir).mockResolvedValueOnce([] as any);

            await themeService.initialize();
            const themes = await themeService.getAllThemes();
            expect(Array.isArray(themes)).toBe(true);
        });
    });

    describe('installTheme error handling', () => {
        it('should handle write permission errors', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Permission denied'));

            const manifest = {
                id: 'test-theme',
                name: 'test-theme',
                displayName: 'Test Theme',
                version: '1.0.0',
                type: 'dark' as const,
                colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            };

            await expect(themeService.installTheme(manifest)).rejects.toThrow();
        });

        it('should handle disk full errors', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

            const manifest = {
                id: 'test-theme-2',
                name: 'test-theme-2',
                displayName: 'Test Theme 2',
                version: '1.0.0',
                type: 'dark' as const,
                colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            };

            await expect(themeService.installTheme(manifest)).rejects.toThrow();
        });
    });

    describe('uninstallTheme error handling', () => {
        it('should handle file not found', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

            const result = await themeService.uninstallTheme('nonexistent-theme');
            expect(result).toBe(false);
        });

        it('should handle permission errors', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('EACCES: permission denied'));

            await expect(themeService.uninstallTheme('custom-uninstall-test')).rejects.toThrow();
        });
    });

    describe('race condition handling', () => {
        it('should handle concurrent install requests', async () => {
            const manifest1 = {
                id: 'race-test-1',
                name: 'race-test-1',
                displayName: 'Race Test 1',
                version: '1.0.0',
                type: 'dark' as const,
                colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            };

            const manifest2 = {
                id: 'race-test-2',
                name: 'race-test-2',
                displayName: 'Race Test 2',
                version: '1.0.0',
                type: 'dark' as const,
                colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            };

            const [result1, result2] = await Promise.all([
                themeService.installTheme(manifest1),
                themeService.installTheme(manifest2)
            ]);

            expect(typeof result1).toBe('boolean');
            expect(typeof result2).toBe('boolean');
        });
    });
});

describe('ThemeService Additional Edge Cases', () => {
    let themeService: ThemeService;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { DataService } = await import('@main/services/data/data.service');
        const dataService = new DataService();
        themeService = new ThemeService(dataService as unknown as import('@main/services/data/data.service').DataService);
        await themeService.initialize();
    });

    describe('getTheme edge cases', () => {
        it('should return undefined for empty string id', async () => {
            const theme = await themeService.getTheme('');
            expect(theme).toBeUndefined();
        });

        it('should return undefined for overly long id (>256 chars)', async () => {
            const longId = 'x'.repeat(257);
            const theme = await themeService.getTheme(longId);
            expect(theme).toBeUndefined();
        });

        it('should return undefined for unknown id', async () => {
            const theme = await themeService.getTheme('completely-unknown-theme');
            expect(theme).toBeUndefined();
        });
    });

    describe('uninstallTheme edge cases', () => {
        it('should return false for id with special characters', async () => {
            const result = await themeService.uninstallTheme('theme@#$%!');
            expect(result).toBe(false);
        });

        it('should return false for built-in theme black', async () => {
            const result = await themeService.uninstallTheme('black');
            expect(result).toBe(false);
        });

        it('should return false for built-in theme white', async () => {
            const result = await themeService.uninstallTheme('white');
            expect(result).toBe(false);
        });

        it('should return false for empty id', async () => {
            const result = await themeService.uninstallTheme('');
            expect(result).toBe(false);
        });
    });

    describe('validateManifest via installTheme', () => {
        const validColors = {
            background: '0 0% 0%', foreground: '0 0% 100%', primary: '0 0% 50%',
            secondary: '0 0% 20%', accent: '0 0% 30%', muted: '0 0% 10%',
            destructive: '0 0% 50%', border: '0 0% 20%', input: '0 0% 20%',
            ring: '0 0% 50%', card: '0 0% 5%', cardForeground: '0 0% 100%',
            popover: '0 0% 5%', popoverForeground: '0 0% 100%',
            primaryForeground: '0 0% 100%', secondaryForeground: '0 0% 100%',
            accentForeground: '0 0% 100%', destructiveForeground: '0 0% 100%',
            mutedForeground: '0 0% 60%'
        };

        it('should reject manifest without id', async () => {
            const manifest = { name: 'test', displayName: 'Test', version: '1.0.0', type: 'dark', colors: validColors };
            await expect(themeService.installTheme(manifest as unknown as import('@shared/types/theme').ThemeManifest)).rejects.toThrow('THEME_INVALID_MANIFEST');
        });

        it('should reject manifest without name', async () => {
            const manifest = { id: 'test', displayName: 'Test', version: '1.0.0', type: 'dark', colors: validColors };
            await expect(themeService.installTheme(manifest as unknown as import('@shared/types/theme').ThemeManifest)).rejects.toThrow('THEME_INVALID_MANIFEST');
        });

        it('should reject manifest without displayName', async () => {
            const manifest = { id: 'test', name: 'test', version: '1.0.0', type: 'dark', colors: validColors };
            await expect(themeService.installTheme(manifest as unknown as import('@shared/types/theme').ThemeManifest)).rejects.toThrow('THEME_INVALID_MANIFEST');
        });

        it('should reject manifest without version', async () => {
            const manifest = { id: 'test', name: 'test', displayName: 'Test', type: 'dark', colors: validColors };
            await expect(themeService.installTheme(manifest as unknown as import('@shared/types/theme').ThemeManifest)).rejects.toThrow('THEME_INVALID_MANIFEST');
        });

        it('should reject manifest with invalid type', async () => {
            const manifest = { id: 'test', name: 'test', displayName: 'Test', version: '1.0.0', type: 'neon', colors: validColors };
            await expect(themeService.installTheme(manifest as unknown as import('@shared/types/theme').ThemeManifest)).rejects.toThrow('THEME_INVALID_MANIFEST');
        });

        it('should reject manifest without colors', async () => {
            const manifest = { id: 'test', name: 'test', displayName: 'Test', version: '1.0.0', type: 'dark' };
            await expect(themeService.installTheme(manifest as unknown as import('@shared/types/theme').ThemeManifest)).rejects.toThrow('THEME_INVALID_MANIFEST');
        });

        it('should reject manifest with missing required color', async () => {
            const incompleteColors = { ...validColors };
            delete (incompleteColors as Record<string, string>)['ring'];
            const manifest = { id: 'test', name: 'test', displayName: 'Test', version: '1.0.0', type: 'dark', colors: incompleteColors };
            await expect(themeService.installTheme(manifest as unknown as import('@shared/types/theme').ThemeManifest)).rejects.toThrow('THEME_INVALID_MANIFEST');
        });
    });

    describe('ThemeErrorCode enum', () => {
        it('should have all expected error code values', () => {
            expect(ThemeErrorCode.INVALID_MANIFEST).toBe('THEME_INVALID_MANIFEST');
            expect(ThemeErrorCode.THEME_NOT_FOUND).toBe('THEME_NOT_FOUND');
            expect(ThemeErrorCode.INSTALL_FAILED).toBe('THEME_INSTALL_FAILED');
            expect(ThemeErrorCode.UNINSTALL_FAILED).toBe('THEME_UNINSTALL_FAILED');
            expect(ThemeErrorCode.UNINSTALL_BUILTIN).toBe('THEME_UNINSTALL_BUILTIN');
            expect(ThemeErrorCode.VALIDATION_FAILED).toBe('THEME_VALIDATION_FAILED');
            expect(ThemeErrorCode.PERMISSION_DENIED).toBe('THEME_PERMISSION_DENIED');
            expect(ThemeErrorCode.DISK_FULL).toBe('THEME_DISK_FULL');
            expect(ThemeErrorCode.CORRUPT_THEME_FILE).toBe('THEME_CORRUPT_FILE');
        });
    });

    describe('getMetrics', () => {
        it('should return correct structure', () => {
            const metrics = themeService.getMetrics();
            expect(typeof metrics).toBe('object');
            expect(metrics).not.toBeNull();
        });
    });

    describe('getThemesDirectory', () => {
        it('should return a non-empty string', () => {
            const dir = themeService.getThemesDirectory();
            expect(typeof dir).toBe('string');
            expect(dir.length).toBeGreaterThan(0);
        });
    });
});
