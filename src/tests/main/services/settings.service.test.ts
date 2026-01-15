/**
 * Unit tests for SettingsService
 */
import * as fs from 'fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';


// Mock electron
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/mock/userData')
    }
}));

// Mock fs with both sync and promises API
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
    promises: {
        access: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        rename: vi.fn(),
        unlink: vi.fn(),
        mkdir: vi.fn()
    }
}));

// Mock DataService
const mockDataService = {
    getPath: vi.fn().mockReturnValue('/mock/config')
};

// Mock AuthService
const mockAuthService = {
    getAllTokens: vi.fn().mockReturnValue({}),
    setToken: vi.fn(),
    saveToken: vi.fn()
};

describe('SettingsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: file does not exist (access throws)
        vi.mocked(fs.promises.access).mockRejectedValue(new Error('ENOENT'));
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('constructor and loadSettings', () => {
        it('should use DataService path when provided', async () => {
            vi.mocked(fs.promises.access).mockRejectedValue(new Error('ENOENT'));

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();

            expect(mockDataService.getPath).toHaveBeenCalledWith('config');
        });

        it('should load default settings when file does not exist', async () => {
            vi.mocked(fs.promises.access).mockRejectedValue(new Error('ENOENT'));

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();
            const settings = service.getSettings();

            expect(settings.general.language).toBe('en');
            expect(settings.general.theme).toBe('graphite');
            expect(settings.general.fontSize).toBe(14);
        });

        it('should load settings from file when it exists', async () => {
            vi.mocked(fs.promises.access).mockResolvedValue(undefined);
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
                general: {
                    language: 'tr',
                    theme: 'dark',
                    fontSize: 16
                }
            }));

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();
            const settings = service.getSettings();

            expect(settings.general.language).toBe('tr');
            expect(settings.general.theme).toBe('dark');
            expect(settings.general.fontSize).toBe(16);
        });

        it('should merge loaded settings with defaults', async () => {
            vi.mocked(fs.promises.access).mockResolvedValue(undefined);
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
                general: {
                    language: 'tr'
                }
            }));

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();
            const settings = service.getSettings();

            // Custom value
            expect(settings.general.language).toBe('tr');
            // Default values preserved
            expect(settings.ollama.url).toBe('http://127.0.0.1:11434');
        });

        it('should handle empty settings file', async () => {
            vi.mocked(fs.promises.access).mockResolvedValue(undefined);
            vi.mocked(fs.promises.readFile).mockResolvedValue('');

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();
            const settings = service.getSettings();

            // Should fall back to defaults
            expect(settings.general.language).toBe('en');
        });

        it('should handle whitespace-only settings file', async () => {
            vi.mocked(fs.promises.access).mockResolvedValue(undefined);
            vi.mocked(fs.promises.readFile).mockResolvedValue('   \n\t  ');

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();
            const settings = service.getSettings();

            expect(settings.general.language).toBe('en');
        });

        it('should attempt recovery for corrupted JSON', async () => {
            vi.mocked(fs.promises.access).mockResolvedValue(undefined);
            // Valid JSON with garbage appended
            vi.mocked(fs.promises.readFile).mockResolvedValue('{"general":{"language":"fr"}}garbage');
            vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();
            const settings = service.getSettings();

            // Should recover the valid JSON part
            expect(settings.general.language).toBe('fr');
        });

        it('should remove avatar fields from loaded settings', async () => {
            vi.mocked(fs.promises.access).mockResolvedValue(undefined);
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
                userAvatar: 'base64data',
                aiAvatar: 'base64data',
                general: { language: 'en' }
            }));

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();
            const settings = service.getSettings() as Record<string, unknown>;

            expect(settings.userAvatar).toBeUndefined();
            expect(settings.aiAvatar).toBeUndefined();
        });
    });

    describe('saveSettings', () => {
        it('should save settings and return updated settings', async () => {
            vi.mocked(fs.promises.access).mockRejectedValue(new Error('ENOENT'));
            vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
            vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();

            const result = await service.saveSettings({ general: { language: 'de' } } as never);

            // saveSettings returns AppSettings, not boolean
            expect(result).toBeDefined();
            expect(result.general.language).toBe('de');
            expect(fs.promises.writeFile).toHaveBeenCalled();
        });

        it('should merge partial settings with existing', async () => {
            vi.mocked(fs.promises.access).mockResolvedValue(undefined);
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
                general: { language: 'en', theme: 'dark' }
            }));
            vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
            vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();

            await service.saveSettings({ general: { language: 'fr' } } as never);
            const settings = service.getSettings();

            expect(settings.general.language).toBe('fr');
        });
    });

    describe('reloadSettings', () => {
        it('should reload settings from disk', async () => {
            vi.mocked(fs.promises.access).mockResolvedValue(undefined);
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
                general: { language: 'de', theme: 'custom' }
            }));

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);
            await service.initialize();

            // Simulate external file change
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
                general: { language: 'fr', theme: 'light' }
            }));

            const reloaded = await service.reloadSettings();

            expect(reloaded.general.language).toBe('fr');
            expect(reloaded.general.theme).toBe('light');
        });
    });

    describe('getSettingsPath', () => {
        it('should return the settings file path', async () => {
            vi.mocked(fs.promises.access).mockRejectedValue(new Error('ENOENT'));

            const { SettingsService } = await import('@main/services/system/settings.service');
            const service = new SettingsService(mockDataService as any, mockAuthService as any);

            const settingsPath = service.getSettingsPath();

            expect(settingsPath).toContain('settings.json');
        });
    });
});
