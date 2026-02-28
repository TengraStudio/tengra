import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockSpawn = vi.fn();
const mockExecSync = vi.fn();

vi.mock('child_process', () => ({
    spawn: (...args: unknown[]) => mockSpawn(...args),
    execSync: (...args: unknown[]) => mockExecSync(...args),
}));

const mockExistsSync = vi.fn();

vi.mock('fs', () => ({
    existsSync: (p: string) => mockExistsSync(p),
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { KittyBackend } from '@main/services/terminal/backends/kitty.backend';
import { TerminalCreateOptions } from '@main/services/terminal/backends/terminal-backend.interface';

// --- Helpers ---

function createOptions(overrides?: Partial<TerminalCreateOptions>): TerminalCreateOptions {
    return {
        id: 'test-session',
        shell: '/bin/bash',
        args: [],
        cwd: '/home/user',
        cols: 80,
        rows: 24,
        env: { HOME: '/home/user' },
        onData: vi.fn(),
        onExit: vi.fn(),
        ...overrides,
    };
}

interface MockChildProcess {
    unref: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
    pid: number;
}

function createMockChild(): MockChildProcess {
    return {
        unref: vi.fn(),
        on: vi.fn(),
        kill: vi.fn(),
        killed: false,
        pid: 12345,
    };
}

// --- Tests ---

describe('KittyBackend', () => {
    let backend: KittyBackend;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        backend = new KittyBackend();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('id', () => {
        it('should have id "kitty"', () => {
            expect(backend.id).toBe('kitty');
        });
    });

    describe('isAvailable', () => {
        it('should return true when kitty is found in PATH', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');

            const available = await backend.isAvailable();

            expect(available).toBe(true);
        });

        it('should return false when kitty is not found anywhere', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('not found');
            });
            mockExistsSync.mockReturnValue(false);

            const available = await backend.isAvailable();

            expect(available).toBe(false);
        });

        it('should cache the discovery result on subsequent calls', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');

            await backend.isAvailable();
            await backend.isAvailable();

            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });

        it('should find kitty at common path when not in PATH', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('not found');
            });
            // On Windows the backend checks Windows-specific common paths
            const isWin = process.platform === 'win32';
            const expectedPath = isWin
                ? 'C:\\Program Files\\kitty\\kitty.exe'
                : '/usr/bin/kitty';
            mockExistsSync.mockImplementation((p: string) => p === expectedPath);

            const available = await backend.isAvailable();

            expect(available).toBe(true);
        });

        it('should return first PATH result when multiple lines exist', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/kitty\n/usr/bin/kitty\n');

            const available = await backend.isAvailable();

            expect(available).toBe(true);
        });

        it('should return false when execSync returns empty string', async () => {
            mockExecSync.mockReturnValue('');
            mockExistsSync.mockReturnValue(false);

            const available = await backend.isAvailable();

            expect(available).toBe(false);
        });
    });

    describe('create', () => {
        it('should throw error when kitty is not available', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('not found');
            });
            mockExistsSync.mockReturnValue(false);

            const options = createOptions();

            await expect(backend.create(options)).rejects.toThrow(
                'Kitty is not installed or not in PATH'
            );
        });

        it('should spawn kitty with correct arguments', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            const mockChild = createMockChild();
            mockSpawn.mockReturnValue(mockChild);

            const options = createOptions({
                cwd: '/projects/my-app',
                shell: '/bin/zsh',
                args: ['-l'],
            });

            await backend.create(options);

            expect(mockSpawn).toHaveBeenCalledWith(
                '/usr/bin/kitty',
                ['--directory', '/projects/my-app', '--', '/bin/zsh', '-l'],
                expect.objectContaining({
                    cwd: '/projects/my-app',
                    detached: true,
                    stdio: 'ignore',
                })
            );
        });

        it('should unref the spawned child process', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            const mockChild = createMockChild();
            mockSpawn.mockReturnValue(mockChild);

            await backend.create(createOptions());

            expect(mockChild.unref).toHaveBeenCalled();
        });

        it('should send onData notification after timeout', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            const mockChild = createMockChild();
            mockSpawn.mockReturnValue(mockChild);

            const options = createOptions();
            await backend.create(options);

            vi.advanceTimersByTime(100);

            expect(options.onData).toHaveBeenCalledWith('\r\n[Kitty window opened]\r\n');
        });

        it('should call onExit when child process exits', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            const mockChild = createMockChild();
            mockSpawn.mockReturnValue(mockChild);

            const options = createOptions();
            await backend.create(options);

            const exitHandler = mockChild.on.mock.calls.find(
                (call: unknown[]) => call[0] === 'exit'
            )?.[1] as (code: number | null) => void;
            expect(exitHandler).toBeDefined();

            exitHandler(0);
            expect(options.onExit).toHaveBeenCalledWith(0);
        });

        it('should default exit code to 0 when null', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            const mockChild = createMockChild();
            mockSpawn.mockReturnValue(mockChild);

            const options = createOptions();
            await backend.create(options);

            const exitHandler = mockChild.on.mock.calls.find(
                (call: unknown[]) => call[0] === 'exit'
            )?.[1] as (code: number | null) => void;

            exitHandler(null);
            expect(options.onExit).toHaveBeenCalledWith(0);
        });

        it('should return a valid ITerminalProcess', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            const mockChild = createMockChild();
            mockSpawn.mockReturnValue(mockChild);

            const process = await backend.create(createOptions());

            expect(process).toHaveProperty('write');
            expect(process).toHaveProperty('resize');
            expect(process).toHaveProperty('kill');
        });

        it('should pass env from options to spawn', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            const mockChild = createMockChild();
            mockSpawn.mockReturnValue(mockChild);

            const customEnv = { PATH: '/usr/bin', TERM: 'xterm-256color' };
            await backend.create(createOptions({ env: customEnv }));

            expect(mockSpawn).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ env: customEnv })
            );
        });

        it('should rethrow spawn errors', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            mockSpawn.mockImplementation(() => {
                throw new Error('ENOENT: spawn failed');
            });

            await expect(backend.create(createOptions())).rejects.toThrow('ENOENT: spawn failed');
        });

        it('should auto-discover kitty on first create call', async () => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            const mockChild = createMockChild();
            mockSpawn.mockReturnValue(mockChild);

            await backend.create(createOptions());

            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });
    });

    describe('ITerminalProcess', () => {
        let mockChild: MockChildProcess;

        beforeEach(() => {
            mockExecSync.mockReturnValue('/usr/bin/kitty\n');
            mockChild = createMockChild();
            mockSpawn.mockReturnValue(mockChild);
        });

        it('write should not throw', async () => {
            const proc = await backend.create(createOptions());
            expect(() => proc.write('hello')).not.toThrow();
        });

        it('resize should not throw', async () => {
            const proc = await backend.create(createOptions());
            expect(() => proc.resize(120, 40)).not.toThrow();
        });

        it('kill should kill the child process', async () => {
            const proc = await backend.create(createOptions());

            proc.kill();

            expect(mockChild.kill).toHaveBeenCalled();
        });

        it('kill should not kill an already killed process', async () => {
            mockChild.killed = true;
            const proc = await backend.create(createOptions());

            proc.kill();

            expect(mockChild.kill).not.toHaveBeenCalled();
        });
    });

    describe('discoverKittyPath (via isAvailable)', () => {
        it('should handle existsSync throwing for certain paths', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('not found');
            });
            let callCount = 0;
            mockExistsSync.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Permission denied');
                }
                return false;
            });

            const available = await backend.isAvailable();

            expect(available).toBe(false);
        });

        it('should try common paths in order and return first match', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('not found');
            });

            const isWin = process.platform === 'win32';
            const matchPath = isWin
                ? 'C:\\Program Files\\Kitty\\kitty.exe'
                : '/usr/local/bin/kitty';

            const checkedPaths: string[] = [];
            mockExistsSync.mockImplementation((p: string) => {
                checkedPaths.push(p);
                return p === matchPath;
            });

            const available = await backend.isAvailable();

            expect(available).toBe(true);
            expect(checkedPaths.length).toBeGreaterThanOrEqual(1);
        });
    });
});
