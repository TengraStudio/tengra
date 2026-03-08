import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { TerminalCreateOptions } from '@main/services/terminal/backends/terminal-backend.interface';
import { WarpBackend } from '@main/services/terminal/backends/warp.backend';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

const mockExecSync = vi.fn();
const mockSpawn = vi.fn();

vi.mock('child_process', () => ({
    execSync: (...args: unknown[]) => mockExecSync(...args),
    spawn: (...args: unknown[]) => mockSpawn(...args),
}));

const mockExistsSync = vi.fn();

vi.mock('fs', () => ({
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

// ── Helpers ─────────────────────────────────────────────────────────────

function createMockChildProcess(): ChildProcess {
    const emitter = new EventEmitter();
    const child = emitter as unknown as ChildProcess;
    Object.defineProperty(child, 'killed', { value: false, writable: true });
    child.unref = vi.fn();
    child.kill = vi.fn(() => {
        Object.defineProperty(child, 'killed', { value: true, writable: true });
        return true;
    });
    return child;
}

function createDefaultOptions(overrides?: Partial<TerminalCreateOptions>): TerminalCreateOptions {
    return {
        id: 'test-session-1',
        shell: '/bin/bash',
        args: [],
        cwd: '/home/user/workspace',
        cols: 80,
        rows: 24,
        env: { PATH: '/usr/bin' },
        onData: vi.fn(),
        onExit: vi.fn(),
        ...overrides,
    };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('WarpBackend', () => {
    let backend: WarpBackend;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        backend = new WarpBackend();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ── Identity ────────────────────────────────────────────────────────

    it('should have id "warp"', () => {
        expect(backend.id).toBe('warp');
    });

    // ── isAvailable ─────────────────────────────────────────────────────

    describe('isAvailable', () => {
        it('should return true when warp is found in PATH', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');

            const available = await backend.isAvailable();
            expect(available).toBe(true);
        });

        it('should return false when warp is not found anywhere', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockReturnValue(false);

            const available = await backend.isAvailable();
            expect(available).toBe(false);
        });

        it('should cache discovery result after first call', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');

            await backend.isAvailable();
            await backend.isAvailable();

            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });

        it('should check common paths when PATH lookup fails', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockReturnValue(false);

            await backend.isAvailable();

            expect(mockExistsSync).toHaveBeenCalled();
        });

        it('should return true when warp is found at a common path', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockImplementation((p: string) => p.includes('warp') || p.includes('Warp'));

            const available = await backend.isAvailable();
            expect(available).toBe(true);
        });
    });

    // ── create ──────────────────────────────────────────────────────────

    describe('create', () => {
        it('should throw when warp is not installed', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockReturnValue(false);

            const options = createDefaultOptions();
            await expect(backend.create(options)).rejects.toThrow('Warp is not installed or not in PATH');
        });

        it('should spawn warp process with correct arguments', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            const options = createDefaultOptions();
            await backend.create(options);

            expect(mockSpawn).toHaveBeenCalledWith(
                '/usr/local/bin/warp',
                [options.cwd],
                expect.objectContaining({
                    cwd: options.cwd,
                    detached: true,
                    stdio: 'ignore',
                })
            );
        });

        it('should unref the child process', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            await backend.create(createDefaultOptions());

            expect(child.unref).toHaveBeenCalled();
        });

        it('should send data callback after timeout', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            const options = createDefaultOptions();
            await backend.create(options);

            vi.advanceTimersByTime(150);
            expect(options.onData).toHaveBeenCalledWith('\r\n[Warp window opened]\r\n');
        });

        it('should call onExit when child process exits', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            const options = createDefaultOptions();
            await backend.create(options);

            child.emit('exit', 0);
            expect(options.onExit).toHaveBeenCalledWith(0);
        });

        it('should call onExit with 0 when exit code is null', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            const options = createDefaultOptions();
            await backend.create(options);

            child.emit('exit', null);
            expect(options.onExit).toHaveBeenCalledWith(0);
        });

        it('should return a terminal process with write, resize, kill', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            const process = await backend.create(createDefaultOptions());

            expect(process).toHaveProperty('write');
            expect(process).toHaveProperty('resize');
            expect(process).toHaveProperty('kill');
        });

        it('should kill the child process when kill is called', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            const process = await backend.create(createDefaultOptions());
            process.kill();

            expect(child.kill).toHaveBeenCalled();
        });

        it('should not kill an already killed process', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            const process = await backend.create(createDefaultOptions());

            // First kill
            process.kill();
            expect(child.kill).toHaveBeenCalledTimes(1);

            // Second kill — child.killed is now true so kill() should not be called again
            process.kill();
            expect(child.kill).toHaveBeenCalledTimes(1);
        });

        it('should handle write without error (input bridging not supported)', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            const process = await backend.create(createDefaultOptions());

            expect(() => process.write('echo hello')).not.toThrow();
        });

        it('should handle resize without error', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            const process = await backend.create(createDefaultOptions());

            expect(() => process.resize(120, 40)).not.toThrow();
        });
    });

    // ── Error handling ──────────────────────────────────────────────────

    describe('error handling', () => {
        it('should rethrow spawn errors', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            mockSpawn.mockImplementation(() => { throw new Error('spawn failed'); });

            await expect(backend.create(createDefaultOptions())).rejects.toThrow('spawn failed');
        });

        it('should run discovery before create if not yet done', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/warp\n');
            const child = createMockChildProcess();
            mockSpawn.mockReturnValue(child);

            // Call create directly without calling isAvailable first
            const process = await backend.create(createDefaultOptions());
            expect(process).toBeDefined();
            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });

        it('should handle execSync returning empty string', async () => {
            mockExecSync.mockReturnValue('');
            mockExistsSync.mockReturnValue(false);

            const available = await backend.isAvailable();
            expect(available).toBe(false);
        });

        it('should handle fs.existsSync throwing for common paths', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockImplementation(() => { throw new Error('permission denied'); });

            const available = await backend.isAvailable();
            expect(available).toBe(false);
        });
    });
});
