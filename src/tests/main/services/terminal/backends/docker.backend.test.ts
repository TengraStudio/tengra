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

const mockNodePtyCreate = vi.fn().mockResolvedValue(mockTerminalProcess);
const mockNodePtyIsAvailable = vi.fn().mockResolvedValue(true);

vi.mock('@main/services/terminal/backends/node-pty.backend', () => ({
    NodePtyBackend: class {
        id = 'node-pty';
        isAvailable = mockNodePtyIsAvailable;
        create = mockNodePtyCreate;
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

    beforeEach(() => {
        vi.clearAllMocks();
        backend = new DockerBackend();
    });

    describe('initialization', () => {
        it('should have id set to docker', () => {
            expect(backend.id).toBe('docker');
        });

        it('should use NodePtyBackend internally for availability', async () => {
            const result = await backend.isAvailable();
            expect(result).toBe(true);
            expect(mockNodePtyIsAvailable).toHaveBeenCalled();
        });
    });

    describe('isAvailable', () => {
        it('should delegate availability check to node-pty', async () => {
            const result = await backend.isAvailable();
            expect(result).toBe(true);
            expect(mockNodePtyIsAvailable).toHaveBeenCalledOnce();
        });

        it('should return false when node-pty is unavailable', async () => {
            mockNodePtyIsAvailable.mockResolvedValueOnce(false);
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
            expect(mockNodePtyCreate).toHaveBeenCalledOnce();

            const passedOptions = mockNodePtyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.shell).toBe('docker');
            expect(passedOptions.args).toEqual(['exec', '-it', 'abc123', '/bin/sh']);
        });

        it('should use custom shell from metadata', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123', shell: '/bin/bash' },
            });

            await backend.create(options);

            const passedOptions = mockNodePtyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.args).toEqual(['exec', '-it', 'abc123', '/bin/bash']);
        });

        it('should default to /bin/sh when no shell specified', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
            });

            await backend.create(options);

            const passedOptions = mockNodePtyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.args).toEqual(['exec', '-it', 'abc123', '/bin/sh']);
        });

        it('should set TERM environment variable to xterm-256color', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
                env: { PATH: '/usr/bin', HOME: '/root' },
            });

            await backend.create(options);

            const passedOptions = mockNodePtyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.env).toEqual({
                PATH: '/usr/bin',
                HOME: '/root',
                TERM: 'xterm-256color',
            });
        });

        it('should preserve other options like cwd, cols, rows', async () => {
            const options = createBaseOptions({
                cwd: '/workspace',
                cols: 120,
                rows: 40,
                metadata: { containerId: 'abc123' },
            });

            await backend.create(options);

            const passedOptions = mockNodePtyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.cwd).toBe('/workspace');
            expect(passedOptions.cols).toBe(120);
            expect(passedOptions.rows).toBe(40);
        });

        it('should pass onData and onExit callbacks through', async () => {
            const onData = vi.fn();
            const onExit = vi.fn();
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
                onData,
                onExit,
            });

            await backend.create(options);

            const passedOptions = mockNodePtyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.onData).toBe(onData);
            expect(passedOptions.onExit).toBe(onExit);
        });
    });

    describe('create - command execution via returned process', () => {
        it('should return a process that supports write', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
            });

            const process = await backend.create(options);
            process.write('ls -la\n');

            expect(mockTerminalProcess.write).toHaveBeenCalledWith('ls -la\n');
        });

        it('should return a process that supports resize', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
            });

            const process = await backend.create(options);
            process.resize(200, 50);

            expect(mockTerminalProcess.resize).toHaveBeenCalledWith(200, 50);
        });

        it('should return a process that supports kill', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
            });

            const process = await backend.create(options);
            process.kill();

            expect(mockTerminalProcess.kill).toHaveBeenCalledOnce();
        });
    });

    describe('error handling', () => {
        it('should throw when containerId is missing from metadata', async () => {
            const options = createBaseOptions({ metadata: {} });

            await expect(backend.create(options)).rejects.toThrow(
                'containerId (string) is required for Docker terminal'
            );
        });

        it('should throw when metadata is undefined', async () => {
            const options = createBaseOptions({ metadata: undefined });

            await expect(backend.create(options)).rejects.toThrow(
                'containerId (string) is required for Docker terminal'
            );
        });

        it('should throw when containerId is not a string', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 12345 },
            });

            await expect(backend.create(options)).rejects.toThrow(
                'containerId (string) is required for Docker terminal'
            );
        });

        it('should propagate errors from node-pty create', async () => {
            mockNodePtyCreate.mockRejectedValueOnce(new Error('node-pty spawn failed'));

            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
            });

            await expect(backend.create(options)).rejects.toThrow('node-pty spawn failed');
        });

        it('should not call node-pty create when containerId is invalid', async () => {
            const options = createBaseOptions({ metadata: {} });

            await expect(backend.create(options)).rejects.toThrow();
            expect(mockNodePtyCreate).not.toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('should allow killing a docker exec session', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
            });

            const process = await backend.create(options);
            process.kill();

            expect(mockTerminalProcess.kill).toHaveBeenCalledOnce();
        });

        it('should support creating multiple sessions', async () => {
            const secondProcess: ITerminalProcess = {
                write: vi.fn(),
                resize: vi.fn(),
                kill: vi.fn(),
            };
            mockNodePtyCreate
                .mockResolvedValueOnce(mockTerminalProcess)
                .mockResolvedValueOnce(secondProcess);

            const options1 = createBaseOptions({
                id: 'session-1',
                metadata: { containerId: 'container-1' },
            });
            const options2 = createBaseOptions({
                id: 'session-2',
                metadata: { containerId: 'container-2' },
            });

            const p1 = await backend.create(options1);
            const p2 = await backend.create(options2);

            p1.kill();
            p2.kill();

            expect(mockTerminalProcess.kill).toHaveBeenCalledOnce();
            expect(secondProcess.kill).toHaveBeenCalledOnce();
        });
    });

    describe('connection', () => {
        it('should connect to docker via node-pty with correct arguments', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'my-container-id' },
            });

            await backend.create(options);

            const passedOptions = mockNodePtyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.shell).toBe('docker');
            expect(passedOptions.args[0]).toBe('exec');
            expect(passedOptions.args[1]).toBe('-it');
            expect(passedOptions.args[2]).toBe('my-container-id');
        });

        it('should override TERM env even when already set', async () => {
            const options = createBaseOptions({
                metadata: { containerId: 'abc123' },
                env: { TERM: 'dumb' },
            });

            await backend.create(options);

            const passedOptions = mockNodePtyCreate.mock.calls[0]![0] as TerminalCreateOptions;
            expect(passedOptions.env.TERM).toBe('xterm-256color');
        });
    });
});
