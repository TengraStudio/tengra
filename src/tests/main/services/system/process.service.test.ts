import { ProcessService } from '@main/services/system/process.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        service = new ProcessService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('spawn', () => {
        it('should spawn a process and return an id', () => {
            const id = service.spawn('node', ['--version'], '/tmp');
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });

        it('should register the process in running tasks', () => {
            const id = service.spawn('node', [], '/tmp');
            const tasks = service.getRunningTasks();
            expect(tasks.some(t => t.id === id)).toBe(true);
        });
    });

    describe('kill', () => {
        it('should kill an existing process', () => {
            const id = service.spawn('node', [], '/tmp');
            const result = service.kill(id);
            expect(result).toBe(true);
            expect(mockPtyProcess.kill).toHaveBeenCalled();
        });

        it('should return false for unknown process', () => {
            expect(service.kill('nonexistent')).toBe(false);
        });
    });

    describe('getRunningTasks', () => {
        it('should return empty array initially', () => {
            expect(service.getRunningTasks()).toEqual([]);
        });
    });

    describe('resize', () => {
        it('should resize a running process', () => {
            const id = service.spawn('node', [], '/tmp');
            expect(service.resize(id, 120, 40)).toBe(true);
            expect(mockPtyProcess.resize).toHaveBeenCalledWith(120, 40);
        });

        it('should return false for unknown process', () => {
            expect(service.resize('nope', 80, 24)).toBe(false);
        });
    });

    describe('write', () => {
        it('should write to a running process', () => {
            const id = service.spawn('node', [], '/tmp');
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
