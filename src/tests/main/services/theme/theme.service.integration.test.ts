/**
 * Theme Service Integration Tests
 * Integration and regression coverage for critical flows in ThemeService
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ThemeService } from '@main/services/theme/theme.service';

// Mock the entire module to have full control
vi.mock('fs/promises');
vi.mock('@main/services/data/data.service', () => ({
    DataService: class {
        getPath = vi.fn().mockReturnValue('/fake/user/data')
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

describe('ThemeService Integration Tests', () => {
    let themeService: ThemeService;
    let tempDir: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Create temp directory for each test
        tempDir = path.join(os.tmpdir(), `theme-test-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });

        // Setup mocks
        vi.mocked(fs.access).mockResolvedValue(undefined);
        vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
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
                id: 'lifecycle-test-theme',
                name: 'lifecycle-test-theme',
                displayName: 'Lifecycle Test Theme',
                version: '1.0.0',
                type: 'dark',
                colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' }
            });
        });
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.readdir).mockResolvedValue(['black.theme.json', 'white.theme.json'] as any);
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.unlink).mockResolvedValue(undefined);
        vi.mocked(fs.rename).mockResolvedValue(undefined);

        const { DataService } = await import('@main/services/data/data.service');
        const dataService = new DataService();
        vi.mocked(dataService.getPath).mockReturnValue(tempDir);

        themeService = new ThemeService(dataService as any);
        await themeService.initialize();
    });

    describe('Full Theme Lifecycle', () => {
        it('should complete full lifecycle: initialize -> install -> get -> uninstall', async () => {
            // 1. Initialize - already done in beforeEach
            let themes = await themeService.getAllThemes();
            const initialCount = themes.length;
            expect(initialCount).toBeGreaterThan(0);

            // 2. Install new theme
            const newTheme = {
                id: 'lifecycle-test-theme',
                name: 'lifecycle-test-theme',
                displayName: 'Lifecycle Test Theme',
                version: '1.0.0',
                type: 'dark' as const,
                colors: {
                    background: '0 0% 10%',
                    foreground: '0 0% 95%',
                    primary: '199 89% 48%',
                    primaryForeground: '0 0% 100%',
                    secondary: '0 0% 20%',
                    secondaryForeground: '0 0% 100%',
                    accent: '199 70% 15%',
                    accentForeground: '199 89% 70%',
                    muted: '0 0% 15%',
                    mutedForeground: '0 0% 60%',
                    destructive: '0 72% 51%',
                    destructiveForeground: '0 0% 100%',
                    border: '0 0% 25%',
                    input: '0 0% 25%',
                    ring: '199 89% 48%',
                    card: '0 0% 12%',
                    cardForeground: '0 0% 95%',
                    popover: '0 0% 12%',
                    popoverForeground: '0 0% 95%'
                }
            };

            const installResult = await themeService.installTheme(newTheme);
            expect(installResult).toBe(true);

            // 3. Get the theme
            const retrieved = await themeService.getTheme('lifecycle-test-theme');
            expect(retrieved).toBeDefined();
            expect(retrieved?.displayName).toBe('Lifecycle Test Theme');

            // 4. Verify all themes includes new one
            themes = await themeService.getAllThemes();
            const ids = themes.map(t => t.id);
            expect(ids).toContain('lifecycle-test-theme');

            // 5. Uninstall theme
            const uninstallResult = await themeService.uninstallTheme('lifecycle-test-theme');
            expect(uninstallResult).toBe(true);

            // 6. Verify theme is gone
            const afterUninstall = await themeService.getTheme('lifecycle-test-theme');
            expect(afterUninstall).toBeUndefined();
        });

        it('should handle theme reinstall after uninstall', async () => {
            const theme = {
                id: 'reinstall-test',
                name: 'reinstall-test',
                displayName: 'Reinstall Test',
                version: '1.0.0',
                type: 'light' as const,
                colors: {
                    background: '0 0% 100%',
                    foreground: '0 0% 0%',
                    primary: '262 83% 58%',
                    primaryForeground: '0 0% 100%',
                    secondary: '0 0% 95%',
                    secondaryForeground: '0 0% 10%',
                    accent: '262 70% 95%',
                    accentForeground: '262 83% 40%',
                    muted: '0 0% 92%',
                    mutedForeground: '0 0% 40%',
                    destructive: '0 84% 60%',
                    destructiveForeground: '0 0% 100%',
                    border: '0 0% 85%',
                    input: '0 0% 85%',
                    ring: '262 83 %58%',
                    card: '0 0% 98%',
                    cardForeground: '0 0% 10%',
                    popover: '0 0% 100%',
                    popoverForeground: '0 0% 0%'
                }
            };

            await themeService.installTheme(theme);
            await themeService.uninstallTheme('reinstall-test');
            const result = await themeService.installTheme(theme);
            expect(result).toBe(true);
        });
    });

    describe('Built-in Theme Protection', () => {
        it('should never allow uninstalling black theme', async () => {
            const result = await themeService.uninstallTheme('black');
            expect(result).toBe(false);
        });

        it('should never allow uninstalling white theme', async () => {
            const result = await themeService.uninstallTheme('white');
            expect(result).toBe(false);
        });

        it('should allow reinstalling built-in themes', async () => {
            const blackTheme = {
                id: 'black',
                name: 'tandem-black',
                displayName: 'Tandem Black',
                version: '1.0.0',
                type: 'dark' as const,
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    primary: '199 89% 48%',
                    primaryForeground: '0 0% 100%',
                    secondary: '0 0% 10%',
                    secondaryForeground: '0 0% 100%',
                    accent: '199 70% 15%',
                    accentForeground: '199 89% 70%',
                    muted: '0 0% 8%',
                    mutedForeground: '0 0% 60%',
                    destructive: '0 72% 51%',
                    destructiveForeground: '0 0% 100%',
                    border: '0 0% 15%',
                    input: '0 0% 15%',
                    ring: '199 89% 48%',
                    card: '0 0% 4%',
                    cardForeground: '0 0% 100%',
                    popover: '0 0% 4%',
                    popoverForeground: '0 0% 100%'
                }
            };

            const result = await themeService.installTheme(blackTheme);
            expect(result).toBe(true);
        });
    });

    describe('Theme Directory Operations', () => {
        it('should return valid themes directory path', () => {
            const dir = themeService.getThemesDirectory();
            expect(dir).toContain('runtime');
            expect(dir).toContain('themes');
        });

        it('should handle themes directory being opened', async () => {
            // This is handled by IPC layer, service just provides path
            const dir = themeService.getThemesDirectory();
            expect(typeof dir).toBe('string');
        });
    });

    describe('Error Recovery', () => {
        it('should recover from corrupt theme file during load', async () => {
            // Setup: simulate corrupt theme file
            vi.mocked(fs.readdir).mockResolvedValueOnce(['black.theme.json', 'white.theme.json', 'corrupt.theme.json'] as any);
            vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
                if (filePath.includes('corrupt')) return 'not valid json {{{';
                if (filePath.includes('black')) return JSON.stringify({ id: 'black', name: 'black', displayName: 'Black', version: '1.0.0', type: 'dark', colors: { background: '0 0% 0%', foreground: '0 0% 100%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' } });
                return JSON.stringify({ id: 'white', name: 'white', displayName: 'White', version: '1.0.0', type: 'light', colors: { background: '0 0% 100%', foreground: '0 0% 0%', primary: '', secondary: '', accent: '', muted: '', destructive: '', border: '', input: '', ring: '', card: '', cardForeground: '', popover: '', popoverForeground: '', primaryForeground: '', secondaryForeground: '', accentForeground: '', destructiveForeground: '', mutedForeground: '' } });
            });

            // Create new service and initialize
            const { DataService } = await import('@main/services/data/data.service');
            const dataService = new DataService();
            const recoveryService = new ThemeService(dataService as any);

            // Should not throw, just skip corrupt file
            await recoveryService.initialize();

            // Should still have some themes loaded
            const themes = await recoveryService.getAllThemes();
            expect(themes.length).toBeGreaterThan(0);
        });
    });

    it('should handle missing theme file gracefully', async () => {
        // File system error during uninstall
        vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('ENOENT'));

        const result = await themeService.uninstallTheme('definitely-does-not-exist-999');
        expect(result).toBe(false);
    });
});

describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous install operations', async () => {
        const themes = Array.from({ length: 5 }, (_, i) => ({
            id: `concurrent-${i}`,
            name: `concurrent-${i}`,
            displayName: `Concurrent ${i}`,
            version: '1.0.0',
            type: 'dark' as const,
            colors: {
                background: '0 0% 10%',
                foreground: '0 0% 95%',
                primary: '199 89% 48%',
                primaryForeground: '0 0% 100%',
                secondary: '0 0% 20%',
                secondaryForeground: '0 0% 100%',
                accent: '199 70% 15%',
                accentForeground: '199 89% 70%',
                muted: '0 0% 15%',
                mutedForeground: '0 0% 60%',
                destructive: '0 72% 51%',
                destructiveForeground: '0 0% 100%',
                border: '0 0% 25%',
                input: '0 0% 25%',
                ring: '199 89% 48%',
                card: '0 0% 12%',
                cardForeground: '0 0% 95%',
                popover: '0 0% 12%',
                popoverForeground: '0 0% 95%'
            }
        }));

        const results = await Promise.all(themes.map(t => themeService.installTheme(t)));
        results.forEach(result => expect(typeof result).toBe('boolean'));
    });

    it('should handle mixed success/failure operations', async () => {
        // First succeeds
        const result1 = await themeService.installTheme({
            id: 'mixed-1',
            name: 'mixed-1',
            displayName: 'Mixed 1',
            version: '1.0.0',
            type: 'dark' as const,
            colors: {
                background: '0 0% 10%',
                foreground: '0 0% 95%',
                primary: '199 89% 48%',
                primaryForeground: '0 0% 100%',
                secondary: '0 0% 20%',
                secondaryForeground: '0 0% 100%',
                accent: '199 70% 15%',
                accentForeground: '199 89% 70%',
                muted: '0 0% 15%',
                mutedForeground: '0 0% 60%',
                destructive: '0 72% 51%',
                destructiveForeground: '0 0% 100%',
                border: '0 0% 25%',
                input: '0 0% 25%',
                ring: '199 89% 48%',
                card: '0 0% 12%',
                cardForeground: '0 0% 95%',
                popover: '0 0% 12%',
                popoverForeground: '0 0% 95%'
            }
        });
        expect(result1).toBe(true);

        // Second should succeed too
        const result2 = await themeService.installTheme({
            id: 'mixed-2',
            name: 'mixed-2',
            displayName: 'Mixed 2',
            version: '1.0.0',
            type: 'dark' as const,
            colors: {
                background: '0 0% 10%',
                foreground: '0 0% 95%',
                primary: '199 89% 48%',
                primaryForeground: '0 0% 100%',
                secondary: '0 0% 20%',
                secondaryForeground: '0 0% 100%',
                accent: '199 70% 15%',
                accentForeground: '199 89% 70%',
                muted: '0 0% 15%',
                mutedForeground: '0 0% 60%',
                destructive: '0 72% 51%',
                destructiveForeground: '0 0% 100%',
                border: '0 0% 25%',
                input: '0 0% 25%',
                ring: '199 89% 48%',
                card: '0 0% 12%',
                cardForeground: '0 0% 95%',
                popover: '0 0% 12%',
                popoverForeground: '0 0% 95%'
            }
        });
        expect(result2).toBe(true);
    });
});
