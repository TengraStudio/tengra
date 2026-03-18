import { registerAuditIpc } from '@main/ipc/audit';
import { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: TestValue[]) => TestValue | Promise<TestValue>) => {
            ipcMainHandlers.set(channel, async (...args: TestValue[]) => Promise.resolve(handler(...args)));
        }),
        setMaxListeners: vi.fn()
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));


describe('Audit IPC Integration', () => {
    const mockAuditLogService = {
        getLogs: vi.fn().mockResolvedValue([
            { id: '1', category: 'security', message: 'User login', timestamp: 1234567890 },
            { id: '2', category: 'system', message: 'Config updated', timestamp: 1234567900 }
        ]),
        clearLogs: vi.fn().mockResolvedValue(undefined)
    };

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();

        registerAuditIpc(mockAuditLogService as never);
    });

    it('registers all audit IPC handlers', () => {
        expect(ipcMainHandlers.has('audit:getLogs')).toBe(true);
        expect(ipcMainHandlers.has('audit:clearLogs')).toBe(true);
    });

    it('retrieves logs without filter options', async () => {
        const handler = ipcMainHandlers.get('audit:getLogs')!;
        const result = await handler({} as IpcMainInvokeEvent);

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect(mockAuditLogService.getLogs).toHaveBeenCalledWith(undefined);
    });

    it('retrieves logs with category filter', async () => {
        mockAuditLogService.getLogs.mockResolvedValue([
            { id: '1', category: 'security', message: 'User login', timestamp: 1234567890 }
        ]);

        const handler = ipcMainHandlers.get('audit:getLogs')!;
        const result = await handler({} as IpcMainInvokeEvent, { category: 'security' });

        expect(result).toHaveLength(1);
        expect((result as Record<string, TestValue>[])[0].category).toBe('security');
        expect(mockAuditLogService.getLogs).toHaveBeenCalledWith({ category: 'security' });
    });

    it('retrieves logs with date range filter', async () => {
        const handler = ipcMainHandlers.get('audit:getLogs')!;
        const startDate = 1234567800;
        const endDate = 1234567950;

        await handler({} as IpcMainInvokeEvent, { startDate, endDate });

        expect(mockAuditLogService.getLogs).toHaveBeenCalledWith({ startDate, endDate });
    });

    it('retrieves logs with limit filter', async () => {
        const handler = ipcMainHandlers.get('audit:getLogs')!;
        await handler({} as IpcMainInvokeEvent, { limit: 10 });

        expect(mockAuditLogService.getLogs).toHaveBeenCalledWith({ limit: 10 });
    });

    it('retrieves logs with multiple filters', async () => {
        const handler = ipcMainHandlers.get('audit:getLogs')!;
        const options = {
            category: 'security',
            startDate: 1234567800,
            endDate: 1234567950,
            limit: 5
        };

        await handler({} as IpcMainInvokeEvent, options);

        expect(mockAuditLogService.getLogs).toHaveBeenCalledWith(options);
    });

    it('throws error for invalid category via Zod validation', async () => {
        const handler = ipcMainHandlers.get('audit:getLogs')!;

        await expect(
            handler({} as IpcMainInvokeEvent, { category: 'invalid-category' })
        ).rejects.toThrow();
    });

    it('throws error for invalid startDate type', async () => {
        const handler = ipcMainHandlers.get('audit:getLogs')!;

        await expect(
            handler({} as IpcMainInvokeEvent, { startDate: 'not-a-number' })
        ).rejects.toThrow();
    });

    it('throws error for invalid endDate type', async () => {
        const handler = ipcMainHandlers.get('audit:getLogs')!;

        await expect(
            handler({} as IpcMainInvokeEvent, { endDate: 'not-a-number' })
        ).rejects.toThrow();
    });

    it('throws error for invalid limit type', async () => {
        const handler = ipcMainHandlers.get('audit:getLogs')!;

        await expect(
            handler({} as IpcMainInvokeEvent, { limit: 'not-a-number' })
        ).rejects.toThrow();
    });

    it('clears all logs', async () => {
        const handler = ipcMainHandlers.get('audit:clearLogs')!;
        const result = await handler({} as IpcMainInvokeEvent);

        expect(result).toEqual({ success: true });
        expect(mockAuditLogService.clearLogs).toHaveBeenCalledTimes(1);
    });

    it('clears logs successfully even on service error', async () => {
        mockAuditLogService.clearLogs.mockRejectedValue(new Error('Database error'));

        const handler = ipcMainHandlers.get('audit:clearLogs')!;

        await expect(handler({} as IpcMainInvokeEvent)).rejects.toThrow('Database error');
        expect(mockAuditLogService.clearLogs).toHaveBeenCalledTimes(1);
    });
});

