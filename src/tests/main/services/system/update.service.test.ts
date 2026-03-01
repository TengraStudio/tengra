import { DataService } from '@main/services/data/data.service';
import { SettingsService } from '@main/services/system/settings.service';
import { UpdateService } from '@main/services/system/update.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('electron-updater', () => ({
    autoUpdater: {
        logger: null as unknown,
        autoDownload: true,
        autoInstallOnAppQuit: true,
        on: vi.fn(),
        checkForUpdates: vi.fn().mockResolvedValue(undefined),
        downloadUpdate: vi.fn().mockResolvedValue(undefined),
        quitAndInstall: vi.fn()
    }
}));

vi.mock('electron-log', () => ({
    default: {
        transports: {
            file: { level: 'info', resolvePathFn: null as unknown }
        },
        info: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('electron', () => ({
    app: { isPackaged: false },
    BrowserWindow: vi.fn(),
    ipcMain: { handle: vi.fn() }
}));

import { autoUpdater } from 'electron-updater';

vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: (e: Error) => e?.message ?? 'unknown'
}));

describe('UpdateService', () => {
    let service: UpdateService;
    let mockSettingsService: SettingsService;
    let mockDataService: DataService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                autoUpdate: { enabled: false, checkOnStartup: false }
            })
        } as unknown as SettingsService;

        mockDataService = {
            getPath: vi.fn().mockReturnValue('/mock/data')
        } as unknown as DataService;

        service = new UpdateService(mockSettingsService, mockDataService);
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('constructor', () => {
        it('should configure autoUpdater settings', () => {
            expect(autoUpdater.autoDownload).toBe(false);
            expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should clear window reference', async () => {
            await expect(service.cleanup()).resolves.not.toThrow();
        });
    });

    describe('checkForUpdates', () => {
        it('should call autoUpdater.checkForUpdates', async () => {
            await service.checkForUpdates();
            expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
        });

        it('should throw on failure', async () => {
            vi.mocked(autoUpdater.checkForUpdates).mockRejectedValueOnce(new Error('Network error'));
            await expect(service.checkForUpdates()).rejects.toThrow('Network error');
        });
    });

    describe('downloadUpdate', () => {
        it('should call autoUpdater.downloadUpdate', async () => {
            await service.downloadUpdate();
            expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
        });

        it('should throw on failure', async () => {
            vi.mocked(autoUpdater.downloadUpdate).mockRejectedValueOnce(new Error('Download failed'));
            await expect(service.downloadUpdate()).rejects.toThrow('Download failed');
        });
    });

    describe('quitAndInstall', () => {
        it('should call autoUpdater.quitAndInstall', () => {
            service.quitAndInstall();
            expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
        });
    });

    describe('init', () => {
        it('should skip auto-updater in dev mode', () => {
            const mockWindow = { webContents: { send: vi.fn() } };
            service.init(mockWindow as never);
            // In dev mode, events should NOT be registered
            expect(autoUpdater.on).not.toHaveBeenCalled();
        });
    });
});
