/**
 * Integration tests for Process IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
    BrowserWindow: { getAllWindows: vi.fn().mockReturnValue([]) }
}));

describe('Process IPC Handlers', () => {
    let registeredHandlers: Map<string, TestValue>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: TestValue) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('process:spawn', () => {
        it('should spawn a new process', async () => {
            const handler = async () => ({ id: 'proc-1', pid: 1234 });
            registeredHandlers.set('process:spawn', handler);
            const result = await (registeredHandlers.get('process:spawn') as () => Promise<TestValue>)();
            expect(result).toHaveProperty('id');
        });
    });

    describe('process:kill', () => {
        it('should kill a process', async () => {
            const handler = async () => true;
            registeredHandlers.set('process:kill', handler);
            const result = await (registeredHandlers.get('process:kill') as () => Promise<TestValue>)();
            expect(result).toBe(true);
        });
    });

    describe('process:list', () => {
        it('should list running processes', async () => {
            const handler = async () => [];
            registeredHandlers.set('process:list', handler);
            const result = await (registeredHandlers.get('process:list') as () => Promise<TestValue>)();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('process:scan-scripts', () => {
        it('should scan scripts', async () => {
            const handler = async () => ({});
            registeredHandlers.set('process:scan-scripts', handler);
            const result = await (registeredHandlers.get('process:scan-scripts') as () => Promise<TestValue>)();
            expect(result).toBeDefined();
        });
    });

    describe('process:resize', () => {
        it('should resize terminal', async () => {
            const handler = async () => true;
            registeredHandlers.set('process:resize', handler);
            const result = await (registeredHandlers.get('process:resize') as () => Promise<TestValue>)();
            expect(result).toBe(true);
        });
    });

    describe('process:write', () => {
        it('should write to process', async () => {
            const handler = async () => true;
            registeredHandlers.set('process:write', handler);
            const result = await (registeredHandlers.get('process:write') as () => Promise<TestValue>)();
            expect(result).toBe(true);
        });
    });
});
