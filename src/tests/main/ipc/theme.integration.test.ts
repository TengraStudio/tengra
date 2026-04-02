import { registerThemeIpc } from '@main/ipc/theme';
import { themeStore } from '@main/utils/theme-store.util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
const mockIpcMainHandlers = new Map<string, (...args: any[]) => Promise<any>>();
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: any[]) => any | Promise<any>) => {
            mockIpcMainHandlers.set(channel, async (...args: any[]) => Promise.resolve(handler(...args)));
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

describe('Theme IPC Handlers', () => {
    const getMainWindow = () => ({ webContents: { send: vi.fn() } }) as any;

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
        registerThemeIpc(mockService as any, getMainWindow);
    });

    describe('theme:getCurrent', () => {
        it('should return current theme ID', async () => {
            vi.mocked(themeStore.getCurrentTheme).mockReturnValue('dark-theme');

            const handler = mockIpcMainHandlers.get('theme:getCurrent');
            expect(handler).toBeDefined();

            const result = await handler!({} as any);
            expect(result).toBe('dark-theme');
        });

        it('should return null if no active theme', async () => {
            vi.mocked(themeStore.getCurrentTheme).mockReturnValue('' as string);

            const handler = mockIpcMainHandlers.get('theme:getCurrent');
            const result = await handler!({} as any);

            expect(result).toBe('');
        });
    });

    describe('theme:set', () => {
        it('should set theme with valid ID', async () => {
            vi.mocked(themeStore.setTheme).mockResolvedValue(true);

            const handler = mockIpcMainHandlers.get('theme:set');
            expect(handler).toBeDefined();

            const result = await handler!({} as any, 'dark-theme');

            expect(vi.mocked(themeStore.setTheme)).toHaveBeenCalledWith('dark-theme');
            expect(result).toBe(true);
        });

        it('should return null for invalid theme ID', async () => {
            const handler = mockIpcMainHandlers.get('theme:set');

            const result1 = await handler!({} as any, '');
            expect(result1).toBe(null);

            const result2 = await handler!({} as any, 123);
            expect(result2).toBe(null);
        });
    });

    describe('theme:getAll', () => {
        it('should return all installed themes', async () => {
            const mockThemes = [
                { id: 'dark', name: 'Dark Theme', type: 'dark' },
                { id: 'light', name: 'Light Theme', type: 'light' },
            ];
            vi.mocked(themeStore.getAllThemes).mockReturnValue(mockThemes as any);

            const handler = mockIpcMainHandlers.get('theme:getAll');
            expect(handler).toBeDefined();

            const result = await handler!({} as any);

            expect(result).toEqual(mockThemes);
        });
    });

    describe('theme:runtime:install', () => {
        it('should install theme from manifest', async () => {
            const mockService = {
                getAllThemes: vi.fn(),
                installTheme: vi.fn().mockResolvedValue('new-theme'),
                uninstallTheme: vi.fn(),
                getThemesDirectory: vi.fn(),
            };
            registerThemeIpc(mockService as any, getMainWindow);

            const handler = mockIpcMainHandlers.get('theme:runtime:install');
            const manifest = { id: 'new-theme', name: 'New Theme', version: '1.0.0' };
            await handler!({} as any, manifest);

            expect(mockService.installTheme).toHaveBeenCalled();
        });
    });

    describe('theme:runtime:uninstall', () => {
        it('should uninstall theme by ID', async () => {
            const mockService = {
                getAllThemes: vi.fn(),
                installTheme: vi.fn(),
                uninstallTheme: vi.fn().mockResolvedValue(undefined),
                getThemesDirectory: vi.fn(),
            };
            registerThemeIpc(mockService as any, getMainWindow);

            const handler = mockIpcMainHandlers.get('theme:runtime:uninstall');
            await handler!({} as any, 'custom-theme');

            expect(mockService.uninstallTheme).toHaveBeenCalledWith('custom-theme');
        });
    });
});
