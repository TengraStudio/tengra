/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

// Mock i18n to return the key
vi.mock('@main/utils/i18n.util', () => ({
    t: (key: string) => key,
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
            message: 'backend.ollamaIsInstalledAndRunning',
            messageKey: 'runtime.health.ollama.running',
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
            message: 'backend.ollamaIsNotInstalled',
            messageKey: 'runtime.health.ollama.notInstalled',
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
            message: 'backend.ollamaIsInstalledButNotRunning',
            messageKey: 'runtime.health.ollama.notRunning',
        });
    });
});

