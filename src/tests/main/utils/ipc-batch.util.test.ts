/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Unit tests for IPC Batch Utility
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn()
    }
}));

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

describe('IPC Batch Utility - Registration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('registerBatchableHandler', () => {
        it('should register a handler as batchable', async () => {
            const { registerBatchableHandler, isBatchable, getBatchableChannels } = await import('@main/utils/ipc-batch.util');

            const handler = vi.fn().mockResolvedValue({ data: 'test' });
            registerBatchableHandler('test:channel', handler);

            expect(isBatchable('test:channel')).toBe(true);
            expect(getBatchableChannels()).toContain('test:channel');
        });
    });

    describe('unregisterBatchableHandler', () => {
        it('should unregister a handler', async () => {
            const { registerBatchableHandler, unregisterBatchableHandler, isBatchable } = await import('@main/utils/ipc-batch.util');

            const handler = vi.fn().mockResolvedValue({ data: 'test' });
            registerBatchableHandler('test:channel', handler);
            expect(isBatchable('test:channel')).toBe(true);

            unregisterBatchableHandler('test:channel');
            expect(isBatchable('test:channel')).toBe(false);
        });
    });

    describe('registerBatchableHandlers', () => {
        it('should register multiple handlers at once', async () => {
            const { registerBatchableHandlers, isBatchable } = await import('@main/utils/ipc-batch.util');

            const handlers = {
                'channel1': vi.fn().mockResolvedValue({}),
                'channel2': vi.fn().mockResolvedValue({}),
                'channel3': vi.fn().mockResolvedValue({})
            };

            registerBatchableHandlers(handlers);

            expect(isBatchable('channel1')).toBe(true);
            expect(isBatchable('channel2')).toBe(true);
            expect(isBatchable('channel3')).toBe(true);
        });
    });

    describe('registerBatchIpc', () => {
        it('should register batch:invoke handler', async () => {
            const { registerBatchIpc } = await import('@main/utils/ipc-batch.util');

            registerBatchIpc();

            expect(ipcMain.handle).toHaveBeenCalledWith('batch:invoke', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('batch:invokeSequential', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('batch:getChannels', expect.any(Function));
        });
    });

    describe('makeBatchable', () => {
        it('should make an existing handler batchable', async () => {
            const { makeBatchable, isBatchable } = await import('@main/utils/ipc-batch.util');

            const existingHandler = vi.fn().mockResolvedValue({ data: 'test' });
            makeBatchable('existing:handler', existingHandler);

            expect(isBatchable('existing:handler')).toBe(true);
        });
    });
});

describe('IPC Batch Utility - Parallel Execution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('batch:invoke handler', () => {
        it('should execute multiple requests in parallel', async () => {
            const { registerBatchIpc, registerBatchableHandler } = await import('@main/utils/ipc-batch.util');

            // Register test handlers
            const handler1 = vi.fn().mockResolvedValue({ result: 'handler1' });
            const handler2 = vi.fn().mockResolvedValue({ result: 'handler2' });
            registerBatchableHandler('test:handler1', handler1);
            registerBatchableHandler('test:handler2', handler2);

            registerBatchIpc();

            // Get the registered handler
            const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
            const batchInvokeHandler = handleCalls.find(c => c[0] === 'batch:invoke')?.[1];

            expect(batchInvokeHandler).toBeDefined();

            // Create mock event
            const mockEvent = {} as IpcMainInvokeEvent;

            // Execute batch request
            const response = await batchInvokeHandler!(mockEvent, [
                { channel: 'test:handler1', args: ['arg1'] },
                { channel: 'test:handler2', args: ['arg2'] }
            ]);

            expect(response.results).toHaveLength(2);
            expect(response.results[0].success).toBe(true);
            expect(response.results[0].data).toEqual({ result: 'handler1' });
            expect(response.results[1].success).toBe(true);
            expect(response.results[1].data).toEqual({ result: 'handler2' });
            expect(response.timing).toBeDefined();
            expect(response.timing.totalMs).toBeGreaterThanOrEqual(0);
        });

        it('should return error for non-existent handler', async () => {
            const { registerBatchIpc } = await import('@main/utils/ipc-batch.util');

            registerBatchIpc();

            // Get the registered handler
            const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
            const batchInvokeHandler = handleCalls.find(c => c[0] === 'batch:invoke')?.[1];

            const mockEvent = {} as IpcMainInvokeEvent;

            const response = await batchInvokeHandler!(mockEvent, [
                { channel: 'nonexistent:channel', args: [] }
            ]);

            expect(response.results).toHaveLength(1);
            expect(response.results[0].success).toBe(false);
            expect(response.results[0].error).toContain('not found');
        });

        it('should handle empty requests array', async () => {
            const { registerBatchIpc } = await import('@main/utils/ipc-batch.util');

            registerBatchIpc();

            const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
            const batchInvokeHandler = handleCalls.find(c => c[0] === 'batch:invoke')?.[1];

            const mockEvent = {} as IpcMainInvokeEvent;
            const response = await batchInvokeHandler!(mockEvent, []);

            expect(response.results).toEqual([]);
            expect(response.timing.totalMs).toBeGreaterThanOrEqual(0);
        });

        it('should handle handler errors gracefully', async () => {
            const { registerBatchIpc, registerBatchableHandler } = await import('@main/utils/ipc-batch.util');

            const failingHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
            registerBatchableHandler('test:failing', failingHandler);

            registerBatchIpc();

            const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
            const batchInvokeHandler = handleCalls.find(c => c[0] === 'batch:invoke')?.[1];

            const mockEvent = {} as IpcMainInvokeEvent;
            const response = await batchInvokeHandler!(mockEvent, [
                { channel: 'test:failing', args: [] }
            ]);

            expect(response.results[0].success).toBe(false);
            expect(response.results[0].error).toContain('Handler failed');
        });
    });
});

describe('IPC Batch Utility - Sequential & Metadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('batch:invokeSequential handler', () => {
        it('should execute requests sequentially', async () => {
            const { registerBatchIpc, registerBatchableHandler } = await import('@main/utils/ipc-batch.util');

            const executionOrder: number[] = [];
            const handler1 = vi.fn().mockImplementation(async () => {
                executionOrder.push(1);
                return { order: 1 };
            });
            const handler2 = vi.fn().mockImplementation(async () => {
                executionOrder.push(2);
                return { order: 2 };
            });

            registerBatchableHandler('test:seq1', handler1);
            registerBatchableHandler('test:seq2', handler2);
            registerBatchIpc();

            const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
            const batchSequentialHandler = handleCalls.find(c => c[0] === 'batch:invokeSequential')?.[1];

            const mockEvent = {} as IpcMainInvokeEvent;
            await batchSequentialHandler!(mockEvent, [
                { channel: 'test:seq1', args: [] },
                { channel: 'test:seq2', args: [] }
            ]);

            expect(executionOrder).toEqual([1, 2]);
        });
    });

    describe('batch:getChannels handler', () => {
        it('should return list of batchable channels', async () => {
            const { registerBatchIpc, registerBatchableHandler } = await import('@main/utils/ipc-batch.util');

            registerBatchableHandler('channel:a', vi.fn().mockResolvedValue({}));
            registerBatchableHandler('channel:b', vi.fn().mockResolvedValue({}));
            registerBatchIpc();

            const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
            const getChannelsHandler = handleCalls.find(c => c[0] === 'batch:getChannels')?.[1];

            const channels = await getChannelsHandler!({} as IpcMainInvokeEvent);

            expect(channels).toContain('channel:a');
            expect(channels).toContain('channel:b');
        });
    });
});

