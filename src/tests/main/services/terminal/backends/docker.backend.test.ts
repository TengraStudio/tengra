/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DockerBackend } from '@main/services/terminal/backends/docker.backend';
import { ITerminalProcess, TerminalCreateOptions } from '@main/services/terminal/backends/terminal-backend.interface';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTerminalProcess: ITerminalProcess = {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
};

const mockProxyCreate = vi.fn().mockResolvedValue(mockTerminalProcess);
const mockProxyIsAvailable = vi.fn().mockResolvedValue(true);

vi.mock('@main/services/terminal/backends/proxy-terminal.backend', () => ({
    ProxyTerminalBackend: class {
        id = 'proxy-terminal';
        isAvailable = mockProxyIsAvailable;
        create = mockProxyCreate;
    },
}));

vi.mock('@main/services/security/auth.service', () => ({
    AuthService: class {
        getActiveToken = vi.fn().mockResolvedValue('test-token');
    },
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

function createBaseOptions(overrides?: Partial<TerminalCreateOptions>): TerminalCreateOptions {
    return {
        id: 'test-session',
        shell: '/bin/bash',
        args: [],
        cwd: '/home/user',
        cols: 80,
        rows: 24,
        env: { PATH: '/usr/bin' },
        onData: vi.fn(),
        onExit: vi.fn(),
        ...overrides,
    };
}

describe('DockerBackend', () => {
    let backend: DockerBackend;
    let mockAuthService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthService = { getActiveToken: vi.fn() };
        backend = new DockerBackend(mockAuthService);
    });

    describe('initialization', () => {
        it('should have id set to docker', () => {
            expect(backend.id).toBe('docker');
        });

        it('should use ProxyTerminalBackend internally for availability', async () => {
            const result = await backend.isAvailable();
            expect(result).toBe(true);
            expect(mockProxyIsAvailable).toHaveBeenCalled();
        });
    });

    describe('isAvailable', () => {
        it('should delegate availability check to proxy', async () => {
            const result = await backend.isAvailable();
            expect(result).toBe(true);
            expect(mockProxyIsAvailable).toHaveBeenCalledOnce();
        });

        it('should return false when proxy is unavailable', async () => {
            mockProxyIsAvailable.mockResolvedValueOnce(false);
            const result = await backend.isAvailable();
            expect(result).toBe(false);
        });
    });

    describe('create - container exec', () => {
        it('should create a terminal with docker exec command', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
            });

            const process = await backend.create(options);

            expect(process).toBe(mockTerminalProcess);
            expect(mockProxyCreate).toHaveBeenCalledOnce();

            const passedOptions = mockProxyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.shell).toBe('docker');
            expect(passedOptions.args).toEqual(['exec', '-it', 'abc123', '/bin/sh']);
        });

        it('should use custom shell from metadata', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123', shell: '/bin/bash' },
            });

            await backend.create(options);

            const passedOptions = mockProxyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.args).toEqual(['exec', '-it', 'abc123', '/bin/bash']);
        });

        it('should set TERM environment variable to xterm-256color', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
                env: { PATH: '/usr/bin', HOME: '/root' },
            });

            await backend.create(options);

            const passedOptions = mockProxyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.env).toEqual({
                PATH: '/usr/bin',
                HOME: '/root',
                TERM: 'xterm-256color',
            });
        });
    });

    describe('error handling', () => {
        it('should throw when containerId is missing from metadata', async () => {
            const options = createBaseOptions({ metadata: {} });

            await expect(backend.create(options)).rejects.toThrow(
                'containerId (string) is required for Docker terminal'
            );
        });
    });
});
