import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { AlacrittyBackend } from '@main/services/terminal/backends/alacritty.backend';
import { TerminalCreateOptions } from '@main/services/terminal/backends/terminal-backend.interface';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

// Mock child_process
const mockSpawn = vi.fn();
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
    spawn: (...args: unknown[]) => mockSpawn(...args),
    execSync: (...args: unknown[]) => mockExecSync(...args)
}));

// Mock fs
const mockExistsSync = vi.fn();
vi.mock('fs', () => ({
    existsSync: (p: string) => mockExistsSync(p)
}));

/**
 * Create a fake ChildProcess EventEmitter for spawn mocking
 */
function createMockChildProcess(): ChildProcess {
    const child = new EventEmitter() as ChildProcess;
    Object.defineProperty(child, 'killed', { value: false, writable: true });
    child.kill = vi.fn(() => {
        Object.defineProperty(child, 'killed', { value: true, writable: true });
        return true;
    });
    child.unref = vi.fn();
    Object.defineProperty(child, 'pid', { value: 12345, writable: true });
    return child;
}

/**
 * Create default terminal create options for testing
 */
function createTestOptions(overrides?: Partial<TerminalCreateOptions>): TerminalCreateOptions {
    return {
        id: 'test-session-1',
        shell: '/bin/bash',
        args: [],
        cwd: '/home/user/project',
        cols: 80,
        rows: 24,
        env: { PATH: '/usr/bin' },
        onData: vi.fn(),
        onExit: vi.fn(),
        ...overrides
    };
}

describe('AlacrittyBackend', () => {
    let backend: AlacrittyBackend;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        backend = new AlacrittyBackend();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('initialization', () => {
        it('should have id "alacritty"', () => {
            expect(backend.id).toBe('alacritty');
        });

        it('should not discover path on construction (lazy-loaded)', () => {
            expect(mockExecSync).not.toHaveBeenCalled();
            expect(mockExistsSync).not.toHaveBeenCalled();
        });
    });

    describe('isAvailable', () => {
        it('should return true when alacritty is found in PATH', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');

            const result = await backend.isAvailable();
            expect(result).toBe(true);
        });

        it('should return false when alacritty is not found anywhere', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockReturnValue(false);

            const result = await backend.isAvailable();
            expect(result).toBe(false);
        });

        it('should find alacritty at common paths when not in PATH', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockReturnValue(true);

            const result = await backend.isAvailable();
            expect(result).toBe(true);
        });

        it('should cache discovery result on subsequent calls', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');

            await backend.isAvailable();
            await backend.isAvailable();

            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });

        it('should handle empty execSync result', async () => {
            mockExecSync.mockReturnValue('');
            mockExistsSync.mockReturnValue(false);

            const result = await backend.isAvailable();
            expect(result).toBe(false);
        });

        it('should pick the first path when execSync returns multiple', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/alacritty\n/usr/bin/alacritty\n');

            const result = await backend.isAvailable();
            expect(result).toBe(true);
        });
    });

    describe('create', () => {
        it('should throw when alacritty is not available', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockReturnValue(false);

            const options = createTestOptions();
            await expect(backend.create(options)).rejects.toThrow('Alacritty is not installed or not in PATH');
        });

        it('should spawn alacritty with correct arguments', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);

            const options = createTestOptions({
                cwd: '/home/user',
                shell: '/bin/zsh',
                args: ['-l']
            });

            await backend.create(options);

            expect(mockSpawn).toHaveBeenCalledWith(
                '/usr/bin/alacritty',
                ['--working-directory', '/home/user', '-e', '/bin/zsh', '-l'],
                expect.objectContaining({
                    cwd: '/home/user',
                    detached: true,
                    stdio: 'ignore'
                })
            );
        });

        it('should unref the child process', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);

            await backend.create(createTestOptions());

            expect(mockChild.unref).toHaveBeenCalled();
        });

        it('should send onData notification after timeout', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);

            const options = createTestOptions();
            await backend.create(options);

            vi.advanceTimersByTime(100);

            expect(options.onData).toHaveBeenCalledWith('\r\n[Alacritty window opened]\r\n');
        });

        it('should call onExit when child process exits', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);

            const options = createTestOptions();
            await backend.create(options);

            mockChild.emit('exit', 0);

            expect(options.onExit).toHaveBeenCalledWith(0);
        });

        it('should call onExit with 0 when exit code is null', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);

            const options = createTestOptions();
            await backend.create(options);

            mockChild.emit('exit', null);

            expect(options.onExit).toHaveBeenCalledWith(0);
        });

        it('should pass environment variables to spawn', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);

            const env = { PATH: '/usr/bin', TERM: 'xterm-256color' };
            const options = createTestOptions({ env });
            await backend.create(options);

            expect(mockSpawn).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ env })
            );
        });

        it('should throw when spawn fails', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            mockSpawn.mockImplementation(() => { throw new Error('spawn failed'); });

            const options = createTestOptions();
            await expect(backend.create(options)).rejects.toThrow('spawn failed');
        });

        it('should discover path lazily on first create call', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);

            expect(mockExecSync).not.toHaveBeenCalled();

            await backend.create(createTestOptions());

            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });
    });

    describe('returned ITerminalProcess', () => {
        let mockChild: ChildProcess;

        beforeEach(() => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
        });

        it('write should not throw', async () => {
            const process = await backend.create(createTestOptions());
            expect(() => process.write('test input')).not.toThrow();
        });

        it('resize should not throw', async () => {
            const process = await backend.create(createTestOptions());
            expect(() => process.resize(120, 40)).not.toThrow();
        });

        it('kill should terminate the child process', async () => {
            const process = await backend.create(createTestOptions());
            process.kill();
            expect(mockChild.kill).toHaveBeenCalled();
        });

        it('kill should not throw when child is already killed', async () => {
            const process = await backend.create(createTestOptions());
            Object.defineProperty(mockChild, 'killed', { value: true, writable: true });
            expect(() => process.kill()).not.toThrow();
            expect(mockChild.kill).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should handle fs.existsSync throwing for common paths', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockImplementation(() => { throw new Error('permission denied'); });

            const result = await backend.isAvailable();
            expect(result).toBe(false);
        });

        it('should propagate spawn error through create', async () => {
            mockExecSync.mockReturnValue('/usr/bin/alacritty\n');
            const spawnError = new Error('EACCES: permission denied');
            mockSpawn.mockImplementation(() => { throw spawnError; });

            await expect(backend.create(createTestOptions())).rejects.toThrow('EACCES: permission denied');
        });
    });
});
