import { ChildProcess } from 'child_process';

import { GhosttyBackend } from '@main/services/terminal/backends/ghostty.backend';
import { TerminalCreateOptions } from '@main/services/terminal/backends/terminal-backend.interface';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockSpawn = vi.fn();
const mockExecSync = vi.fn();

vi.mock('child_process', () => ({
    spawn: (...args: TestValue[]) => mockSpawn(...args),
    execSync: (...args: TestValue[]) => mockExecSync(...args),
}));

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/mock/userData'),
    },
}));

const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockAppendFile = vi.fn().mockResolvedValue(undefined);
const mockExistsSync = vi.fn().mockReturnValue(false);

vi.mock('fs', () => ({
    existsSync: (...args: TestValue[]) => mockExistsSync(...args),
    promises: {
        mkdir: (...args: TestValue[]) => mockMkdir(...args),
        writeFile: (...args: TestValue[]) => mockWriteFile(...args),
        appendFile: (...args: TestValue[]) => mockAppendFile(...args),
    },
}));

vi.mock('@main/services/terminal/backends/backend-discovery.util', () => ({
    findExecutableInPath: async () => {
        try {
            const result = mockExecSync();
            if (typeof result !== 'string') {
                return null;
            }
            const [firstPath] = result
                .split(/\r?\n/)
                .map(candidate => candidate.trim())
                .filter(candidate => candidate.length > 0);
            return firstPath ?? null;
        } catch {
            return null;
        }
    },
    findFirstExistingPath: async (candidatePaths: readonly string[]) => {
        for (const candidatePath of candidatePaths) {
            try {
                if (mockExistsSync(candidatePath)) {
                    return candidatePath;
                }
            } catch {
                // Ignore failing candidate paths so discovery can continue.
            }
        }
        return null;
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

// --- Helpers ---

function createMockChildProcess(overrides?: Partial<ChildProcess>): ChildProcess {
    const listeners = new Map<string, ((...args: TestValue[]) => void)[]>();
    return {
        killed: false,
        kill: vi.fn(),
        unref: vi.fn(),
        on: vi.fn((event: string, handler: (...args: TestValue[]) => void) => {
            const existing = listeners.get(event) ?? [];
            existing.push(handler);
            listeners.set(event, existing);
        }),
        emit: (event: string, ...args: TestValue[]) => {
            const handlers = listeners.get(event) ?? [];
            for (const handler of handlers) {
                handler(...args);
            }
            return true;
        },
        ...overrides,
    } as never as ChildProcess;
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

// --- Tests ---

describe('GhosttyBackend', () => {
    let backend: GhosttyBackend;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockExecSync.mockReset();
        mockSpawn.mockReset();
        mockExistsSync.mockReset().mockReturnValue(false);
        mockMkdir.mockReset().mockResolvedValue(undefined);
        mockWriteFile.mockReset().mockResolvedValue(undefined);
        mockAppendFile.mockReset().mockResolvedValue(undefined);
        backend = new GhosttyBackend();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('id', () => {
        it('should have id "ghostty"', () => {
            expect(backend.id).toBe('ghostty');
        });
    });

    describe('isAvailable', () => {
        it('returns true when ghostty is found via PATH lookup', async () => {
            mockExecSync.mockReturnValue('/usr/local/bin/ghostty\n');

            const result = await backend.isAvailable();

            expect(result).toBe(true);
        });

        it('returns false when ghostty is not found anywhere', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockReturnValue(false);

            const result = await backend.isAvailable();

            expect(result).toBe(false);
        });

        it('returns true when ghostty is found at a common location', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            // On Windows, common paths include 'C:\\Program Files\\Ghostty\\ghostty.exe'
            const expectedPath = process.platform === 'win32'
                ? 'C:\\Program Files\\Ghostty\\ghostty.exe'
                : '/usr/local/bin/ghostty';
            mockExistsSync.mockImplementation((p: string) => p === expectedPath);

            const result = await backend.isAvailable();

            expect(result).toBe(true);
        });

        it('caches discovery result on subsequent calls', async () => {
            mockExecSync.mockReturnValue('/usr/bin/ghostty\n');

            await backend.isAvailable();
            await backend.isAvailable();

            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });

        it('picks the first path line when PATH returns multiple results', async () => {
            mockExecSync.mockReturnValue('/first/ghostty\n/second/ghostty\n');

            const result = await backend.isAvailable();

            expect(result).toBe(true);
        });
    });

    describe('create', () => {
        beforeEach(() => {
            mockExecSync.mockReturnValue('/usr/bin/ghostty\n');
        });

        it('throws when ghostty is not available', async () => {
            mockExecSync.mockImplementation(() => { throw new Error('not found'); });
            mockExistsSync.mockReturnValue(false);

            const options = createDefaultOptions();
            await expect(backend.create(options)).rejects.toThrow(
                'error.terminal.backend_not_found'
            );
        });

        it('spawns ghostty process with correct arguments', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            await backend.create(options);

            expect(mockSpawn).toHaveBeenCalledTimes(1);
            const [spawnPath, spawnArgs, spawnOpts] = mockSpawn.mock.calls[0] as [string, string[], Record<string, TestValue>];
            expect(spawnPath).toBe('/usr/bin/ghostty');
            expect(spawnArgs).toContain('--working-directory');
            expect(spawnArgs).toContain(options.cwd);
            expect(spawnArgs).toContain('--command');
            expect(spawnArgs).toContain(options.shell);
            expect(spawnOpts.cwd).toBe(options.cwd);
            expect(spawnOpts.detached).toBe(true);
            expect(spawnOpts.stdio).toBe('ignore');
        });

        it('creates IPC bridge directory and command file', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            await backend.create(options);

            expect(mockMkdir).toHaveBeenCalledWith(
                expect.stringContaining('ghostty-ipc'),
                { recursive: true }
            );
            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.stringContaining('test-session-1.commands'),
                '',
                { encoding: 'utf8', flag: 'a' }
            );
        });

        it('calls onData with Ghostty window opened message', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const onData = vi.fn();
            const options = createDefaultOptions({ onData });

            await backend.create(options);
            vi.advanceTimersByTime(150);

            expect(onData).toHaveBeenCalledWith(
                expect.stringContaining('[Ghostty window opened]')
            );
            expect(onData).toHaveBeenCalledWith(
                expect.stringContaining('[Ghostty IPC ready:')
            );
        });

        it('calls onExit when child process exits', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const onExit = vi.fn();
            const options = createDefaultOptions({ onExit });

            await backend.create(options);
            mockChild.emit('exit', 0);

            expect(onExit).toHaveBeenCalledWith(0);
        });

        it('calls onExit with 0 when exit code is null', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const onExit = vi.fn();
            const options = createDefaultOptions({ onExit });

            await backend.create(options);
            mockChild.emit('exit', null);

            expect(onExit).toHaveBeenCalledWith(0);
        });

        it('returns ITerminalProcess with write, resize, and kill methods', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);

            expect(terminalProcess).toHaveProperty('write');
            expect(terminalProcess).toHaveProperty('resize');
            expect(terminalProcess).toHaveProperty('kill');
            expect(typeof terminalProcess.write).toBe('function');
            expect(typeof terminalProcess.resize).toBe('function');
            expect(typeof terminalProcess.kill).toBe('function');
        });

        it('unrefs the spawned child process', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            await backend.create(options);

            expect(mockChild.unref).toHaveBeenCalledTimes(1);
        });

        it('throws when spawn fails', async () => {
            mockSpawn.mockImplementation(() => { throw new Error('spawn ENOENT'); });
            const options = createDefaultOptions();

            await expect(backend.create(options)).rejects.toThrow('spawn ENOENT');
        });

        it('performs discovery if not yet done', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            await backend.create(options);

            expect(mockExecSync).toHaveBeenCalled();
        });
    });

    describe('kill', () => {
        it('kills the child process when kill is called', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            mockExecSync.mockReturnValue('/usr/bin/ghostty\n');
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);
            terminalProcess.kill();

            expect(mockChild.kill).toHaveBeenCalled();
        });

        it('does not kill already killed child process', async () => {
            const mockChild = createMockChildProcess({ killed: true } as Partial<ChildProcess>);
            mockSpawn.mockReturnValue(mockChild);
            mockExecSync.mockReturnValue('/usr/bin/ghostty\n');
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);
            terminalProcess.kill();

            expect(mockChild.kill).not.toHaveBeenCalled();
        });
    });

    describe('write (IPC bridge)', () => {
        beforeEach(() => {
            mockExecSync.mockReturnValue('/usr/bin/ghostty\n');
        });

        it('appends command to bridge file on newline', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);
            terminalProcess.write('echo hello\r');

            // Allow async writeBridgePayloadWithRecovery to execute
            await vi.advanceTimersByTimeAsync(10);

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('test-session-1.commands'),
                expect.stringContaining('echo hello'),
                'utf8'
            );
        });

        it('buffers characters until newline is received', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);
            terminalProcess.write('echo');

            await vi.advanceTimersByTimeAsync(10);

            expect(mockAppendFile).not.toHaveBeenCalled();
        });

        it('handles backspace by removing last character from buffer', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);
            terminalProcess.write('echox\b\r');

            await vi.advanceTimersByTimeAsync(10);

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('test-session-1.commands'),
                expect.stringContaining('echo'),
                'utf8'
            );
        });

        it('handles DEL character (0x7f) as backspace', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);
            terminalProcess.write('echoz\x7f\r');

            await vi.advanceTimersByTimeAsync(10);

            expect(mockAppendFile).toHaveBeenCalledWith(
                expect.stringContaining('test-session-1.commands'),
                expect.stringContaining('echo'),
                'utf8'
            );
        });

        it('ignores empty commands', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);
            terminalProcess.write('\r\n');

            await vi.advanceTimersByTimeAsync(10);

            expect(mockAppendFile).not.toHaveBeenCalled();
        });

        it('handles multiple commands in one write', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);
            terminalProcess.write('ls\rcd /\r');

            await vi.advanceTimersByTimeAsync(10);

            expect(mockAppendFile).toHaveBeenCalledTimes(1);
            const payload = mockAppendFile.mock.calls[0]?.[1] as string;
            expect(payload).toContain('ls');
            expect(payload).toContain('cd /');
        });

        it('logs warning when writing to unknown session', async () => {
            const { appLogger } = await import('@main/logging/logger');
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions();
            const terminalProcess = await backend.create(options);

            // Kill clears session bridge, then write should warn
            terminalProcess.kill();
            terminalProcess.write('echo test\r');

            await vi.advanceTimersByTimeAsync(10);

            expect(appLogger.warn).toHaveBeenCalledWith(
                'GhosttyBackend',
                expect.stringContaining('No IPC bridge found')
            );
        });
    });

    describe('write bridge recovery', () => {
        beforeEach(() => {
            mockExecSync.mockReturnValue('/usr/bin/ghostty\n');
        });

        it('retries with create+append when first append fails', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            mockAppendFile.mockRejectedValueOnce(new Error('ENOENT'));
            mockAppendFile.mockResolvedValueOnce(undefined);

            const options = createDefaultOptions();
            const terminalProcess = await backend.create(options);
            terminalProcess.write('echo retry\r');

            await vi.advanceTimersByTimeAsync(10);

            // First attempt fails, then writeFile + appendFile for recovery
            expect(mockWriteFile).toHaveBeenCalled();
            expect(mockAppendFile).toHaveBeenCalledTimes(2);
        });

        it('logs error when retry also fails', async () => {
            const { appLogger } = await import('@main/logging/logger');
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            // First writeFile call is during create() - succeeds
            mockWriteFile.mockResolvedValueOnce(undefined);
            // Recovery writeFile succeeds
            mockWriteFile.mockResolvedValueOnce(undefined);
            // Both appendFile calls fail (initial + recovery)
            mockAppendFile.mockRejectedValueOnce(new Error('EPERM'));
            mockAppendFile.mockRejectedValueOnce(new Error('EPERM'));

            const options = createDefaultOptions();
            const terminalProcess = await backend.create(options);
            terminalProcess.write('echo fail\r');

            await vi.advanceTimersByTimeAsync(10);

            expect(appLogger.error).toHaveBeenCalledWith(
                'GhosttyBackend',
                expect.stringContaining('Bridge append retry failed'),
                expect.anything()
            );
        });
    });

    describe('resize', () => {
        it('does not throw when resize is called', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            mockExecSync.mockReturnValue('/usr/bin/ghostty\n');
            const options = createDefaultOptions();

            const terminalProcess = await backend.create(options);

            expect(() => terminalProcess.resize(120, 40)).not.toThrow();
        });
    });

    describe('buildShellArgs (via create)', () => {
        beforeEach(() => {
            mockExecSync.mockReturnValue('/usr/bin/ghostty\n');
        });

        it('uses -lc flag for bash shells', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions({ shell: '/bin/bash' });

            await backend.create(options);

            const spawnArgs = mockSpawn.mock.calls[0]?.[1] as string[];
            expect(spawnArgs).toContain('-lc');
        });

        it('uses -lc flag for zsh shells', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions({ shell: '/bin/zsh' });

            await backend.create(options);

            const spawnArgs = mockSpawn.mock.calls[0]?.[1] as string[];
            expect(spawnArgs).toContain('-lc');
        });

        it('uses fallback args with -c for other shells', async () => {
            const mockChild = createMockChildProcess();
            mockSpawn.mockReturnValue(mockChild);
            const options = createDefaultOptions({ shell: '/bin/fish', args: ['--login'] });

            await backend.create(options);

            const spawnArgs = mockSpawn.mock.calls[0]?.[1] as string[];
            expect(spawnArgs).toContain('-c');
            expect(spawnArgs).toContain('--login');
        });
    });
});
