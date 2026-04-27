/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { existsSync } from 'fs';

import { SettingsService } from '@main/services/system/settings.service';
import { UpdateService } from '@main/services/system/update.service';
import { autoUpdater } from 'electron-updater';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockElectronApp = vi.hoisted(() => ({ isPackaged: false }));

vi.mock('fs', () => ({
    existsSync: vi.fn(),
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('electron-updater', () => ({
    autoUpdater: {
        logger: null as never,
        autoDownload: true,
        autoInstallOnAppQuit: true,
        on: vi.fn(),
        checkForUpdates: vi.fn().mockResolvedValue(undefined),
        downloadUpdate: vi.fn().mockResolvedValue(undefined),
        quitAndInstall: vi.fn()
    }
}));
 
vi.mock('electron', () => ({
    app: mockElectronApp,
    BrowserWindow: vi.fn(),
    ipcMain: { handle: vi.fn() }
}));

vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: (e: Error) => e?.message ?? 'unknown'
}));

describe('UpdateService', () => {
    let service: UpdateService;
    let mockSettingsService: SettingsService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(existsSync).mockReturnValue(true);
        mockElectronApp.isPackaged = false;

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                autoUpdate: { enabled: false, checkOnStartup: false }
            })
        } as never as SettingsService;


        service = new UpdateService(mockSettingsService);
    });

    afterEach(async () => {
        await service?.cleanup();
    });

    describe('constructor', () => {
        it('should disable updates when app-update.yml is missing', () => {
            vi.mocked(existsSync).mockReturnValue(false);
            autoUpdater.autoDownload = true;
            autoUpdater.autoInstallOnAppQuit = true;
            service = new UpdateService(mockSettingsService);

            expect(autoUpdater.on).not.toHaveBeenCalled();
        });

        it('should configure autoUpdater settings when app-update.yml exists', () => {
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

        it('should swallow expected failures', async () => {
            vi.mocked(autoUpdater.checkForUpdates).mockRejectedValueOnce(new Error('Network error'));
            await expect(service.checkForUpdates()).resolves.toBeUndefined();
        });

        it('should surface feed access failures as warnings', async () => {
            const mockWindow = {
                isDestroyed: vi.fn().mockReturnValue(false),
                webContents: { send: vi.fn() }
            };

            service.init(mockWindow as never);
            vi.mocked(autoUpdater.checkForUpdates).mockRejectedValueOnce(
                Object.assign(new Error('Request failed for releases.atom'), { statusCode: 404 })
            );

            await service.checkForUpdates();

            expect(mockWindow.webContents.send).toHaveBeenCalledWith(
                'update:status',
                { state: 'warning', warning: 'Update feed unavailable for this repository' }
            );
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

        it('should not require a GitHub token on startup', async () => {
            mockElectronApp.isPackaged = true;
            mockSettingsService.getSettings = vi.fn().mockReturnValue({
                autoUpdate: { enabled: true, checkOnStartup: true }
            });

            const mockWindow = {
                isDestroyed: vi.fn().mockReturnValue(false),
                webContents: { send: vi.fn() }
            };
            vi.useFakeTimers();
            vi.mocked(autoUpdater.checkForUpdates).mockRejectedValueOnce(
                Object.assign(new Error('Request failed for releases.atom'), { statusCode: 404 })
            );

            service.init(mockWindow as never);
            await vi.advanceTimersByTimeAsync(10000);
            vi.useRealTimers();

            expect(mockWindow.webContents.send).toHaveBeenCalledWith(
                'update:status',
                { state: 'warning', warning: 'Update feed unavailable for this repository' }
            );
        });
    });
});
