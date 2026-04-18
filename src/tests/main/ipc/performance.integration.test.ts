/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Import module under test
import { registerPerformanceIpc } from '@main/ipc/performance';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIpcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

// Mock performance service
const mockPerformanceService = {
    getMemoryStats: vi.fn(),
    detectLeak: vi.fn(),
    triggerGC: vi.fn(),
};

// Mock electron
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: TestValue[]) => TestValue | Promise<TestValue>) => {
            mockIpcMainHandlers.set(channel, async (...args: TestValue[]) => Promise.resolve(handler(...args)));
        }),
        removeHandler: vi.fn((channel: string) => {
            mockIpcMainHandlers.delete(channel);
        }),
    },
}));

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock IPC wrapper

describe('Performance IPC Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();
        
        // Register handlers
        registerPerformanceIpc(mockPerformanceService as never);
    });

    describe('performance:get-memory-stats', () => {
        it('should return memory statistics', async () => {
            const mockStats = {
                success: true,
                data: {
                    main: {
                        rss: 100 * 1024 * 1024,
                        heapTotal: 50 * 1024 * 1024,
                        heapUsed: 30 * 1024 * 1024,
                        external: 5 * 1024 * 1024,
                        arrayBuffers: 2 * 1024 * 1024,
                    },
                    timestamp: Date.now(),
                },
            };
            mockPerformanceService.getMemoryStats.mockReturnValue(mockStats);
            
            const handler = mockIpcMainHandlers.get('performance:get-memory-stats');
            expect(handler).toBeDefined();
            
            const result = await handler!({});
            
            expect(mockPerformanceService.getMemoryStats).toHaveBeenCalled();
            expect(result).toEqual(mockStats);
        });

        it('should return default stats on error', async () => {
            mockPerformanceService.getMemoryStats.mockImplementation(() => {
                throw new Error('Memory stats unavailable');
            });
            
            const handler = mockIpcMainHandlers.get('performance:get-memory-stats');
            const result = await handler!({});
            
            expect(result).toEqual({
                success: false,
                data: {
                    main: expect.any(Object),
                    timestamp: 0,
                },
            });
        });

        it('should include RSS, heapTotal, heapUsed in stats', async () => {
            const mockStats = {
                success: true,
                data: {
                    main: process.memoryUsage(),
                    timestamp: Date.now(),
                },
            };
            mockPerformanceService.getMemoryStats.mockReturnValue(mockStats);
            
            const handler = mockIpcMainHandlers.get('performance:get-memory-stats');
            const result = await handler!({});
            
            expect((result as Record<string, Record<string, TestValue>>).data.main).toHaveProperty('rss');
            expect((result as Record<string, Record<string, TestValue>>).data.main).toHaveProperty('heapTotal');
            expect((result as Record<string, Record<string, TestValue>>).data.main).toHaveProperty('heapUsed');
        });
    });

    describe('performance:detect-leak', () => {
        it('should detect memory leaks', async () => {
            const mockLeakData = {
                success: true,
                data: {
                    isPossibleLeak: true,
                    trend: [
                        { timestamp: 1000, heapUsed: 30 * 1024 * 1024 },
                        { timestamp: 2000, heapUsed: 35 * 1024 * 1024 },
                        { timestamp: 3000, heapUsed: 40 * 1024 * 1024 },
                    ],
                },
            };
            mockPerformanceService.detectLeak.mockResolvedValue(mockLeakData);
            
            const handler = mockIpcMainHandlers.get('performance:detect-leak');
            expect(handler).toBeDefined();
            
            const result = await handler!({});
            
            expect(mockPerformanceService.detectLeak).toHaveBeenCalled();
            expect(result).toEqual(mockLeakData);
        });

        it('should return no leak when memory is stable', async () => {
            const mockNoLeak = {
                success: true,
                data: {
                    isPossibleLeak: false,
                    trend: [
                        { timestamp: 1000, heapUsed: 30 * 1024 * 1024 },
                        { timestamp: 2000, heapUsed: 30 * 1024 * 1024 },
                        { timestamp: 3000, heapUsed: 30 * 1024 * 1024 },
                    ],
                },
            };
            mockPerformanceService.detectLeak.mockResolvedValue(mockNoLeak);
            
            const handler = mockIpcMainHandlers.get('performance:detect-leak');
            const result = await handler!({});
            
            expect((result as Record<string, Record<string, TestValue>>).data.isPossibleLeak).toBe(false);
        });

        it('should return default on error', async () => {
            mockPerformanceService.detectLeak.mockRejectedValue(new Error('Detection failed'));
            
            const handler = mockIpcMainHandlers.get('performance:detect-leak');
            const result = await handler!({});
            
            expect(result).toEqual({
                success: false,
                data: {
                    isPossibleLeak: false,
                    trend: [],
                },
            });
        });
    });

    describe('performance:trigger-gc', () => {
        it('should trigger garbage collection successfully', async () => {
            const mockGCResult = {
                success: true,
                data: { success: true },
            };
            mockPerformanceService.triggerGC.mockReturnValue(mockGCResult);
            
            const handler = mockIpcMainHandlers.get('performance:trigger-gc');
            expect(handler).toBeDefined();
            
            const result = await handler!({});
            
            expect(mockPerformanceService.triggerGC).toHaveBeenCalled();
            expect(result).toEqual(mockGCResult);
        });

        it('should return failure when GC unavailable', async () => {
            const mockGCUnavailable = {
                success: false,
                data: { success: false },
            };
            mockPerformanceService.triggerGC.mockReturnValue(mockGCUnavailable);
            
            const handler = mockIpcMainHandlers.get('performance:trigger-gc');
            const result = await handler!({});
            
            expect((result as Record<string, Record<string, TestValue>>).data.success).toBe(false);
        });

        it('should return default on error', async () => {
            mockPerformanceService.triggerGC.mockImplementation(() => {
                throw new Error('GC trigger failed');
            });
            
            const handler = mockIpcMainHandlers.get('performance:trigger-gc');
            const result = await handler!({});
            
            expect(result).toEqual({
                success: false,
                data: { success: false },
            });
        });
    });
});

