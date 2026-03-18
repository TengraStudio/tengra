import { ExternalRuntimeDependencyService } from '@main/services/system/external-runtime-dependency.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const externalDependencyMocks = vi.hoisted(() => ({
    access: vi.fn(async () => undefined),
    execFile: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock('fs/promises', () => ({
    access: externalDependencyMocks.access,
}));

vi.mock('child_process', () => ({
    execFile: externalDependencyMocks.execFile,
}));

describe('ExternalRuntimeDependencyService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', externalDependencyMocks.fetch);
    });

    it('reports Ollama as ready when installed and running', async () => {
        externalDependencyMocks.access.mockResolvedValue(undefined);
        externalDependencyMocks.fetch.mockResolvedValue({ ok: true });

        const service = new ExternalRuntimeDependencyService();
        const result = await service.assess('ollama');

        expect(result).toEqual({
            detected: true,
            running: true,
            action: 'none',
            message: 'Ollama is installed and running',
            messageKey: 'images.runtimeHealth.ollama.running',
        });
    });

    it('reports Ollama as install-required when it is missing', async () => {
        externalDependencyMocks.access.mockRejectedValue(new Error('missing'));
        externalDependencyMocks.execFile.mockImplementation(
            (
                _command: string,
                _args: string[],
                _options: { windowsHide?: boolean },
                callback: (error: Error | null) => void
            ) => {
                callback(new Error('not found'));
                return {} as never;
            }
        );
        externalDependencyMocks.fetch.mockRejectedValue(new Error('offline'));

        const service = new ExternalRuntimeDependencyService();
        const result = await service.assess('ollama');

        expect(result).toEqual({
            detected: false,
            running: false,
            action: 'install',
            message: 'Ollama is not installed',
            messageKey: 'images.runtimeHealth.ollama.notInstalled',
        });
    });

    it('reports Ollama as start-required when installed but offline', async () => {
        externalDependencyMocks.access.mockResolvedValue(undefined);
        externalDependencyMocks.fetch.mockRejectedValue(new Error('offline'));

        const service = new ExternalRuntimeDependencyService();
        const result = await service.assess('ollama');

        expect(result).toEqual({
            detected: true,
            running: false,
            action: 'start',
            message: 'Ollama is installed but not running',
            messageKey: 'images.runtimeHealth.ollama.notRunning',
        });
    });
});
