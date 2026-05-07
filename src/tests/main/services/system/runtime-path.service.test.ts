/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mkdirSync = vi.fn();
const existsSync = vi.fn().mockReturnValue(false);
const getPath = vi.fn().mockReturnValue('/mock/appData');
const getAppPath = vi.fn().mockReturnValue('/mock/appPath');

vi.mock('fs', () => ({
    existsSync,
    mkdirSync,
}));

vi.mock('electron', () => ({
    app: {
        getPath,
        getAppPath,
        isPackaged: true,
    },
}));

describe('runtime-path.service', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        existsSync.mockReturnValue(false);
        getPath.mockReturnValue('/mock/appData');
        getAppPath.mockReturnValue('/mock/appPath');
    });

    it('creates and returns the managed runtime directories under appData', async () => {
        const runtimePaths = await import('@main/services/system/runtime-path.service');

        expect(runtimePaths.getManagedRuntimeRoot()).toBe(path.join('/mock/appData', 'runtime', 'managed'));
        expect(runtimePaths.getManagedRuntimeBinDir()).toBe(path.join('/mock/appData', 'runtime', 'managed', 'bin'));
        expect(runtimePaths.getManagedRuntimeModelsDir()).toBe(path.join('/mock/appData', 'runtime', 'managed', 'models'));
        
        expect(runtimePaths.getManagedRuntimeCacheRoot()).toBe(path.join('/mock/appData', 'runtime', 'cache'));
        expect(runtimePaths.getManagedRuntimeTempDir()).toBe(path.join('/mock/appData', 'runtime', 'cache', 'temp'));
        expect(runtimePaths.getManagedRuntimeDownloadsDir()).toBe(path.join('/mock/appData', 'runtime', 'cache', 'downloads'));
        expect(runtimePaths.getManagedRuntimeManifestsDir()).toBe(path.join('/mock/appData', 'runtime', 'cache', 'manifests'));
        
        expect(mkdirSync).toHaveBeenCalledWith(path.join('/mock/appData', 'runtime', 'managed'), { recursive: true });
        expect(mkdirSync).toHaveBeenCalledWith(path.join('/mock/appData', 'runtime', 'managed', 'bin'), { recursive: true });
    });

    it('normalizes the managed runtime binary path for the current OS', async () => {
        const runtimePaths = await import('@main/services/system/runtime-path.service');
        const executablePath = runtimePaths.getManagedRuntimeBinaryPath('llama-server');

        const expectedBinDir = path.join('/mock/appData', 'runtime', 'managed', 'bin');
        if (process.platform === 'win32') {
            expect(executablePath).toBe(path.join(expectedBinDir, 'llama-server.exe'));
            return;
        }

        expect(executablePath).toBe(path.join(expectedBinDir, 'llama-server'));
    });
});

