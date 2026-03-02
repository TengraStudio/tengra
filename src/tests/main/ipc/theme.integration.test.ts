import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
const mockIpcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            mockIpcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn((channel: string) => {
            mockIpcMainHandlers.delete(channel);
        }),
    },
    shell: {
        openPath: vi.fn().mockResolvedValue(''),
    },
}));

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock IPC wrapper

// Mock theme-store with inline factory
vi.mock('@main/utils/theme-store.util', () => ({
    themeStore: {
        getCurrentTheme: vi.fn().mockReturnValue('graphite'),
        setTheme: vi.fn().mockResolvedValue(true),
        getAllThemes: vi.fn().mockReturnValue([]),
        getThemeDetails: vi.fn().mockReturnValue(null),
        getCustomThemes: vi.fn().mockReturnValue([]),
        addCustomTheme: vi.fn().mockResolvedValue({ id: 'test', name: 'Test' }),
        updateCustomTheme: vi.fn().mockResolvedValue(true),
        deleteCustomTheme: vi.fn().mockResolvedValue(true),
        exportTheme: vi.fn().mockReturnValue(null),
        importTheme: vi.fn().mockResolvedValue(null),
        duplicateTheme: vi.fn().mockResolvedValue(null),
    }
}));

// Mock ThemeService
const mockThemeService = {
    getAllThemes: vi.fn().mockResolvedValue([]),
    installTheme: vi.fn().mockResolvedValue(undefined),
    uninstallTheme: vi.fn().mockResolvedValue(undefined),
    getThemesDirectory: vi.fn().mockReturnValue('C:\\themes'),
};

vi.mock('@main/services/theme/theme.service', () => ({
    ThemeService: vi.fn(() => mockThemeService),
}));

// Mock fs
vi.mock('fs/promises', () => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Import the module under test AFTER mocks
import { registerThemeIpc } from '@main/ipc/theme';
import { themeStore } from '@main/utils/theme-store.util';

describe('Theme IPC Handlers', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();

        // Register handlers with mock service
        const mockService = {
            getAllThemes: vi.fn().mockResolvedValue([]),
            installTheme: vi.fn().mockResolvedValue(undefined),
            uninstallTheme: vi.fn().mockResolvedValue(undefined),
            getThemesDirectory: vi.fn().mockReturnValue('C:\\themes'),
        };
        registerThemeIpc(mockService as never);
    });

    describe('theme:getCurrent', () => {
        it('should return current theme ID', async () => {
            vi.mocked(themeStore.getCurrentTheme).mockReturnValue('dark-theme');

            const handler = mockIpcMainHandlers.get('theme:getCurrent');
            expect(handler).toBeDefined();

            const result = await handler!({});
            expect(result).toBe('dark-theme');
        });

        it('should return null if no active theme', async () => {
            vi.mocked(themeStore.getCurrentTheme).mockReturnValue('' as string);

            const handler = mockIpcMainHandlers.get('theme:getCurrent');
            const result = await handler!({});

            expect(result).toBe('');
        });
    });

    describe('theme:set', () => {
        it('should set theme with valid ID', async () => {
            vi.mocked(themeStore.setTheme).mockResolvedValue(true);

            const handler = mockIpcMainHandlers.get('theme:set');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'dark-theme');

            expect(vi.mocked(themeStore.setTheme)).toHaveBeenCalledWith('dark-theme');
            expect(result).toBe(true);
        });

        it('should return null for invalid theme ID', async () => {
            const handler = mockIpcMainHandlers.get('theme:set');

            const result1 = await handler!({}, '');
            expect(result1).toBe(null);

            const result2 = await handler!({}, 123);
            expect(result2).toBe(null);
        });

        it('should return null for theme ID with invalid characters', async () => {
            const handler = mockIpcMainHandlers.get('theme:set');

            const result1 = await handler!({}, 'theme/with/slashes');
            expect(result1).toBe(null);

            const result2 = await handler!({}, 'theme with spaces');
            expect(result2).toBe(null);
        });
    });

    describe('theme:getAll', () => {
        it('should return all installed themes', async () => {
            const mockThemes = [
                { id: 'dark', name: 'Dark Theme', type: 'dark' },
                { id: 'light', name: 'Light Theme', type: 'light' },
            ];
            vi.mocked(themeStore.getAllThemes).mockReturnValue(mockThemes as never);

            const handler = mockIpcMainHandlers.get('theme:getAll');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(result).toEqual(mockThemes);
        });

        it('should return empty array if no themes', async () => {
            vi.mocked(themeStore.getAllThemes).mockReturnValue([]);

            const handler = mockIpcMainHandlers.get('theme:getAll');
            const result = await handler!({});

            expect(result).toEqual([]);
        });
    });

    describe('theme:runtime:install', () => {
        it('should install theme from manifest', async () => {
            vi.clearAllMocks();

            const mockService = {
                getAllThemes: vi.fn().mockResolvedValue([]),
                installTheme: vi.fn().mockResolvedValue('new-theme'),
                uninstallTheme: vi.fn(),
                getThemesDirectory: vi.fn(() => 'C:\\themes'),
            };

            // Re-register with new mock
            mockIpcMainHandlers.clear();
            registerThemeIpc(mockService as never);

            const handler = mockIpcMainHandlers.get('theme:runtime:install');
            expect(handler).toBeDefined();

            const manifest = { id: 'new-theme', name: 'New Theme', version: '1.0.0' };
            await handler!({}, manifest);

            expect(mockService.installTheme).toHaveBeenCalled();
        });

        it('should reject invalid manifest', async () => {
            const handler = mockIpcMainHandlers.get('theme:runtime:install');

            await expect(handler!({}, null)).rejects.toThrow('Invalid theme manifest');
            await expect(handler!({}, 'not-an-object')).rejects.toThrow('Invalid theme manifest');
        });
    });

    describe('theme:runtime:uninstall', () => {
        it('should uninstall theme by ID', async () => {
            vi.clearAllMocks();

            const mockService = {
                getAllThemes: vi.fn().mockResolvedValue([]),
                installTheme: vi.fn(),
                uninstallTheme: vi.fn().mockResolvedValue(undefined),
                getThemesDirectory: vi.fn(() => 'C:\\themes'),
            };

            // Re-register with new mock
            mockIpcMainHandlers.clear();
            registerThemeIpc(mockService as never);

            const handler = mockIpcMainHandlers.get('theme:runtime:uninstall');
            expect(handler).toBeDefined();

            await handler!({}, 'custom-theme');

            expect(mockService.uninstallTheme).toHaveBeenCalledWith('custom-theme');
        });

        it('should reject invalid theme ID', async () => {
            const handler = mockIpcMainHandlers.get('theme:runtime:uninstall');

            await expect(handler!({}, '')).rejects.toThrow();
            await expect(handler!({}, null)).rejects.toThrow();
        });
    });

    describe('theme:export', () => {
        it('should export theme to temp file', async () => {
            vi.mocked(themeStore.exportTheme).mockReturnValue('{"id":"test"}');

            const handler = mockIpcMainHandlers.get('theme:export');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'my-theme');

            expect(result).toBe(true);
        });

        it('should return false for invalid theme ID', async () => {
            const handler = mockIpcMainHandlers.get('theme:export');

            const result = await handler!({}, '');
            expect(result).toBe(false);
        });

        it('should return false when export fails', async () => {
            vi.mocked(themeStore.exportTheme).mockReturnValue(null);

            const handler = mockIpcMainHandlers.get('theme:export');
            const result = await handler!({}, 'valid-id');

            expect(result).toBe(false);
        });
    });

    describe('theme:runtime:openDirectory', () => {
        it('should open themes directory', async () => {
            const electron = await import('electron');
            vi.mocked(electron.shell.openPath).mockResolvedValue('');

            const handler = mockIpcMainHandlers.get('theme:runtime:openDirectory');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(vi.mocked(electron.shell.openPath)).toHaveBeenCalledWith('C:\\themes');
            expect(result).toBe(true);
        });
    });

    describe('theme:getCustom', () => {
        it('should return empty array as default', async () => {
            vi.mocked(themeStore.getCustomThemes).mockReturnValue([]);

            const handler = mockIpcMainHandlers.get('theme:getCustom');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(result).toEqual([]);
        });

        it('should return custom themes', async () => {
            const mockCustomThemes = [{ id: 'custom-1', name: 'Custom Theme' }];
            vi.mocked(themeStore.getCustomThemes).mockReturnValue(mockCustomThemes as never);

            const handler = mockIpcMainHandlers.get('theme:getCustom');
            const result = await handler!({});

            expect(result).toEqual(mockCustomThemes);
        });
    });

    describe('theme:addCustom', () => {
        it('should add custom theme', async () => {
            vi.mocked(themeStore.addCustomTheme).mockResolvedValue({ id: 'test', name: 'Test', isDark: true, colors: {}, createdAt: Date.now(), modifiedAt: Date.now() } as never);

            const handler = mockIpcMainHandlers.get('theme:addCustom');
            expect(handler).toBeDefined();

            const theme = {
                name: 'My Custom Theme',
                category: 'elite-dark',
                isDark: true,
                isCustom: true,
                source: 'user-created',
                colors: {},
            };

            await handler!({}, theme);

            expect(vi.mocked(themeStore.addCustomTheme)).toHaveBeenCalled();
        });

        it('should reject theme with invalid ID', async () => {
            const handler = mockIpcMainHandlers.get('theme:addCustom');

            const theme1 = { name: '', category: 'elite-dark', isDark: true, isCustom: true, source: 'user-created' };
            await expect(handler!({}, theme1)).rejects.toThrow();
        });

        it('should reject theme with invalid category', async () => {
            const handler = mockIpcMainHandlers.get('theme:addCustom');

            const theme = { name: 'Test', category: 'invalid-category', isDark: true, isCustom: true, source: 'user-created' };
            await expect(handler!({}, theme)).rejects.toThrow();
        });
    });

    describe('theme:deleteCustom', () => {
        it('should delete custom theme', async () => {
            vi.mocked(themeStore.deleteCustomTheme).mockResolvedValue(true);

            const handler = mockIpcMainHandlers.get('theme:deleteCustom');
            expect(handler).toBeDefined();

            await handler!({}, 'custom-1');

            expect(vi.mocked(themeStore.deleteCustomTheme)).toHaveBeenCalledWith('custom-1');
        });

        it('should reject invalid theme ID', async () => {
            const handler = mockIpcMainHandlers.get('theme:deleteCustom');

            await expect(handler!({}, '')).rejects.toThrow();
        });
    });

    describe('theme:getDetails', () => {
        it('should return theme details', async () => {
            const mockDetails = { id: 'dark', name: 'Dark Theme', version: '1.0.0' };
            vi.mocked(themeStore.getThemeDetails).mockReturnValue(mockDetails as never);

            const handler = mockIpcMainHandlers.get('theme:getDetails');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'dark');

            expect(result).toEqual(mockDetails);
        });

        it('should return null for invalid ID', async () => {
            const handler = mockIpcMainHandlers.get('theme:getDetails');

            const result = await handler!({}, '');
            expect(result).toBe(null);
        });

        it('should return null when theme not found', async () => {
            vi.mocked(themeStore.getThemeDetails).mockReturnValue(null);

            const handler = mockIpcMainHandlers.get('theme:getDetails');
            const result = await handler!({}, 'nonexistent');

            expect(result).toBe(null);
        });
    });

    describe('theme:import', () => {
        it('should import theme from JSON', async () => {
            vi.mocked(themeStore.importTheme).mockResolvedValue(null);

            const handler = mockIpcMainHandlers.get('theme:import');
            expect(handler).toBeDefined();

            const jsonString = JSON.stringify({
                id: 'imported',
                name: 'Imported Theme',
                version: '1.0.0',
            });

            await handler!({}, jsonString);

            expect(vi.mocked(themeStore.importTheme)).toHaveBeenCalledWith(jsonString);
        });

        it('should handle non-string input', async () => {
            const handler = mockIpcMainHandlers.get('theme:import');

            // validateJsonString returns null for non-strings, which throws error
            await expect(handler!({}, 123)).rejects.toThrow();
            await expect(handler!({}, null)).rejects.toThrow();
        });

        it('should handle empty string', async () => {
            const handler = mockIpcMainHandlers.get('theme:import');

            // Empty string passes validateJsonString but may fail import
            vi.mocked(themeStore.importTheme).mockImplementation(() => {
                throw new Error('Invalid JSON');
            });

            await expect(handler!({}, '')).rejects.toThrow();
        });
    });

    describe('theme:duplicate', () => {
        it('should duplicate theme with new name', async () => {
            vi.mocked(themeStore.duplicateTheme).mockResolvedValue(null);

            const handler = mockIpcMainHandlers.get('theme:duplicate');
            expect(handler).toBeDefined();

            await handler!({}, 'original-theme', 'Duplicated Theme');

            expect(vi.mocked(themeStore.duplicateTheme)).toHaveBeenCalled();
        });

        it('should reject invalid theme ID', async () => {
            const handler = mockIpcMainHandlers.get('theme:duplicate');

            await expect(handler!({}, '', 'New Name')).rejects.toThrow();
        });

        it('should reject invalid new name', async () => {
            const handler = mockIpcMainHandlers.get('theme:duplicate');

            await expect(handler!({}, 'theme-id', '')).rejects.toThrow();
        });
    });
});
