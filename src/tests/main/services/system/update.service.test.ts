/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import path from 'path';

import { SettingsService } from '@main/services/system/settings.service';
import { UpdateService } from '@main/services/system/update.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuit, mockSpawn } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockQuit: vi.fn(),
    mockSpawn: vi.fn(() => ({ unref: vi.fn() })),
}));

vi.mock('child_process', () => ({
    spawn: mockSpawn,
}));

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    openSync: vi.fn(() => 1),
    writeSync: vi.fn(),
    writeFileSync: vi.fn(),
    closeSync: vi.fn(),
    readFileSync: vi.fn(),
}));

vi.mock('electron', () => ({
    app: {
        isPackaged: true,
        getVersion: vi.fn(() => '1.0.0'),
        getPath: vi.fn(() => '/mock/app.exe'),
        getAppPath: vi.fn(() => '/mock/app'),
        quit: mockQuit,
    },
    BrowserWindow: vi.fn(),
}));

vi.mock('@main/services/system/runtime-path.service', () => ({
    getManagedRuntimeTempDir: vi.fn(() => '/mock/temp'),
}));

describe('UpdateService', () => {
    let service: UpdateService;
    let settingsService: SettingsService;

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
        settingsService = {
            getSettings: vi.fn().mockReturnValue({
                autoUpdate: { enabled: true, checkOnStartup: false },
            }),
        } as never as SettingsService;
        service = new UpdateService(settingsService);
    });

    afterEach(async () => {
        await service.cleanup();
    });

    it('checks GitHub releases and reports an available update', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                tag_name: 'v1.0.1',
                body: 'Release notes',
                assets: [
                    {
                        name: 'Tengra.exe',
                        browser_download_url: 'https://example.com/Tengra.exe',
                        size: 10,
                    },
                ],
            }),
        } as never);

        const result = await service.checkForUpdates();

        expect(result).toEqual({
            available: true,
            version: '1.0.1',
            releaseNotes: 'Release notes',
        });
    });

    it('downloads the release asset to the managed temp folder', async () => {
        vi.mocked(global.fetch)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    tag_name: 'v1.0.1',
                    assets: [
                        {
                            name: process.platform === 'win32' ? 'Tengra.exe' : (process.platform === 'darwin' ? 'Tengra.dmg' : 'Tengra.AppImage'),
                            browser_download_url: `https://example.com/Tengra.${process.platform === 'win32' ? 'exe' : (process.platform === 'darwin' ? 'dmg' : 'AppImage')}`,
                            size: 10,
                        },
                    ],
                }),
            } as never)
            .mockResolvedValueOnce({
                ok: true,
                body: true,
                arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
                headers: new Headers({ 'content-length': '3' }),
            } as never);

        await expect(service.downloadUpdate()).resolves.toBe(true);
        expect(fs.mkdirSync).toHaveBeenCalledWith(path.normalize('/mock/temp'), { recursive: true });
    });

    it('spawns the detached updater helper before quitting', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                tag_name: 'v1.0.1',
                assets: [
                    {
                        name: process.platform === 'win32' ? 'Tengra.exe' : (process.platform === 'darwin' ? 'Tengra.dmg' : 'Tengra.AppImage'),
                        browser_download_url: `https://example.com/Tengra.${process.platform === 'win32' ? 'exe' : (process.platform === 'darwin' ? 'dmg' : 'AppImage')}`,
                        size: 10,
                    },
                ],
            }),
        } as never);

        vi.mocked(fs.existsSync).mockImplementation((targetPath: fs.PathLike) => {
            const str = String(targetPath);
            return str.includes('Tengra.exe') || str.includes('Tengra.dmg') || str.includes('Tengra.AppImage') || str.includes('tengra-updater');
        });
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}) as never);

        await service.checkForUpdates();
        await expect(service.quitAndInstall()).resolves.toBeUndefined();

        expect(mockSpawn).toHaveBeenCalled();
        expect(mockQuit).toHaveBeenCalled();
    });
});

