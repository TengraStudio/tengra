import { beforeEach, describe, expect, it, vi } from 'vitest';

const mkdirSync = vi.fn();
const existsSync = vi.fn().mockReturnValue(false);
const getPath = vi.fn().mockReturnValue('/mock/appData');

vi.mock('fs', () => ({
    existsSync,
    mkdirSync,
}));

vi.mock('electron', () => ({
    app: {
        getPath,
    },
}));

describe('runtime-path.service', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        existsSync.mockReturnValue(false);
        getPath.mockReturnValue('/mock/appData');
    });

    it('creates and returns the managed runtime directories under appData', async () => {
        const runtimePaths = await import('@main/services/system/runtime-path.service');

        expect(runtimePaths.getManagedRuntimeRoot()).toBe('/mock/appData/Tengra/runtime');
        expect(runtimePaths.getManagedRuntimeBinDir()).toBe('/mock/appData/Tengra/runtime/bin');
        expect(runtimePaths.getManagedRuntimeModelsDir()).toBe('/mock/appData/Tengra/runtime/models');
        expect(runtimePaths.getManagedRuntimeTempDir()).toBe('/mock/appData/Tengra/runtime/temp');
        expect(mkdirSync).toHaveBeenCalledWith('/mock/appData/Tengra/runtime', { recursive: true });
        expect(mkdirSync).toHaveBeenCalledWith('/mock/appData/Tengra/runtime/bin', { recursive: true });
        expect(mkdirSync).toHaveBeenCalledWith('/mock/appData/Tengra/runtime/models', { recursive: true });
        expect(mkdirSync).toHaveBeenCalledWith('/mock/appData/Tengra/runtime/temp', { recursive: true });
    });

    it('normalizes the managed runtime binary path for the current OS', async () => {
        const runtimePaths = await import('@main/services/system/runtime-path.service');
        const executablePath = runtimePaths.getManagedRuntimeBinaryPath('llama-server');

        if (process.platform === 'win32') {
            expect(executablePath).toBe('/mock/appData/Tengra/runtime/bin/llama-server.exe');
            return;
        }

        expect(executablePath).toBe('/mock/appData/Tengra/runtime/bin/llama-server');
    });
});
