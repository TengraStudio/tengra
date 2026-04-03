import * as os from 'os';
import * as path from 'path';

import { ProcessService } from '@main/services/system/process.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_CWD = path.join(os.tmpdir(), 'tengra-tests', 'process-service');

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('@main/utils/windows-command.util', () => ({
    resolveWindowsCommand: (cmd: string) => cmd
}));

vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: (e: Error) => e?.message ?? 'unknown'
}));

vi.mock('@shared/utils/sanitize.util', () => ({
    quoteShellArg: (arg: string) => `"${arg}"`,
    safeJsonParse: <T>(str: string, fallback: T) => {
        try { return JSON.parse(str) as T; } catch { return fallback; }
    }
}));

const mockPtyProcess = {
    pid: 1234,
    onData: vi.fn(),
    onExit: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
    write: vi.fn()
};

interface PseudoExitEvent {
    exitCode: number;
}

let latestExitHandler: ((event: PseudoExitEvent) => void) | null = null;

vi.mock('node-pty', () => ({
    spawn: vi.fn(() => mockPtyProcess)
}));

vi.mock('child_process', () => ({
    exec: vi.fn()
}));

vi.mock('util', () => ({
    promisify: () => vi.fn().mockResolvedValue({ stdout: 'output', stderr: '' })
}));

vi.mock('fs', () => ({
    promises: {
        access: vi.fn().mockRejectedValue(new Error('not found')),
        readFile: vi.fn().mockResolvedValue('{}')
    }
}));

describe('ProcessService', () => {
    let service: ProcessService;

    beforeEach(() => {
        vi.clearAllMocks();
        latestExitHandler = null;
        mockPtyProcess.onExit.mockImplementation((handler: (event: PseudoExitEvent) => void) => {
            latestExitHandler = handler;
            return mockPtyProcess;
        });
        service = new ProcessService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('spawn', () => {
        it('should spawn a process and return an id', () => {
            const id = service.spawn('node', ['--version'], TEST_CWD);
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });

        it('should register the process in running tasks', () => {
            const id = service.spawn('node', [], TEST_CWD);
            const tasks = service.getRunningTasks();
            expect(tasks.some(t => t.id === id)).toBe(true);
        });
    });

    describe('kill', () => {
        it('should kill an existing process', () => {
            const id = service.spawn('node', [], TEST_CWD);
            const result = service.kill(id);
            expect(result).toBe(true);
            expect(mockPtyProcess.kill).toHaveBeenCalled();
        });

        it('should return false for unknown process', () => {
            expect(service.kill('nonexistent')).toBe(false);
        });
    });

    describe('lifecycle', () => {
        it('removes task when process exits with success', () => {
            const id = service.spawn('node', [], TEST_CWD);
            expect(service.getRunningTasks().some(task => task.id === id)).toBe(true);

            latestExitHandler?.({ exitCode: 0 });

            expect(service.getRunningTasks().some(task => task.id === id)).toBe(false);
        });

        it('keeps task record when process exits with failure', () => {
            const id = service.spawn('node', [], TEST_CWD);
            expect(service.getRunningTasks().some(task => task.id === id)).toBe(true);

            latestExitHandler?.({ exitCode: 1 });

            const failedTask = service.getRunningTasks().find(task => task.id === id);
            expect(failedTask?.status).toBe('failed');
        });
    });

    describe('getRunningTasks', () => {
        it('should return empty array initially', () => {
            expect(service.getRunningTasks()).toEqual([]);
        });
    });

    describe('resize', () => {
        it('should resize a running process', () => {
            const id = service.spawn('node', [], TEST_CWD);
            expect(service.resize(id, 120, 40)).toBe(true);
            expect(mockPtyProcess.resize).toHaveBeenCalledWith(120, 40);
        });

        it('should return false for unknown process', () => {
            expect(service.resize('nope', 80, 24)).toBe(false);
        });
    });

    describe('write', () => {
        it('should write to a running process', () => {
            const id = service.spawn('node', [], TEST_CWD);
            expect(service.write(id, 'hello')).toBe(true);
            expect(mockPtyProcess.write).toHaveBeenCalledWith('hello');
        });

        it('should return false for unknown process', () => {
            expect(service.write('nope', 'data')).toBe(false);
        });
    });

    describe('scanScripts', () => {
        it('should return empty object when no package.json', async () => {
            const scripts = await service.scanScripts('/nonexistent');
            expect(scripts).toEqual({});
        });
    });
});
