// Import module under test
import { registerMetricsIpc } from '@main/ipc/metrics';
// Import dependencies first
import { appLogger } from '@main/logging/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIpcMainHandlers = new Map<string, (...args: any[]) => any>();

// Mock metrics service
const mockMetricsService = {
    getProviderStats: vi.fn(),
    getAllProviderStats: vi.fn(),
    getSummary: vi.fn(),
    reset: vi.fn(),
};

// Mock electron
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
            mockIpcMainHandlers.set(channel, handler);
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

// Mock metrics service
vi.mock('@main/services/analysis/metrics.service', () => ({
    getMetricsService: () => mockMetricsService,
}));

// Mock IPC wrapper
vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createSafeIpcHandler: (_name: string, handler: (...args: any[]) => any, fallback: any) => async (...args: any[]) => {
        try {
            const result = await handler(...args);
            return result;
        } catch {
            return fallback;
        }
    },
}));

describe('Metrics IPC Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();
        
        // Register handlers
        registerMetricsIpc();
    });

    describe('metrics:get-provider-stats', () => {
        it('should get stats for specific provider', async () => {
            const mockStats = {
                provider: 'openai',
                requests: 100,
                successRate: 0.95,
                avgLatencyMs: 250,
            };
            mockMetricsService.getProviderStats.mockReturnValue(mockStats);
            
            const handler = mockIpcMainHandlers.get('metrics:get-provider-stats');
            expect(handler).toBeDefined();
            
            const result = await handler!({}, 'openai');
            
            expect(mockMetricsService.getProviderStats).toHaveBeenCalledWith('openai');
            expect(result).toEqual(mockStats);
        });

        it('should get all provider stats when no provider specified', async () => {
            const mockAllStats = {
                openai: { requests: 100, successRate: 0.95 },
                anthropic: { requests: 50, successRate: 0.98 },
            };
            mockMetricsService.getAllProviderStats.mockReturnValue(mockAllStats);
            
            const handler = mockIpcMainHandlers.get('metrics:get-provider-stats');
            const result = await handler!({}, undefined);
            
            expect(mockMetricsService.getAllProviderStats).toHaveBeenCalled();
            expect(result).toEqual(mockAllStats);
        });

        it('should get all stats when null provider', async () => {
            const mockAllStats = { total: 150 };
            mockMetricsService.getAllProviderStats.mockReturnValue(mockAllStats);
            
            const handler = mockIpcMainHandlers.get('metrics:get-provider-stats');
            const result = await handler!({}, null);
            
            expect(mockMetricsService.getAllProviderStats).toHaveBeenCalled();
            expect(result).toEqual(mockAllStats);
        });

        it('should reject invalid provider types', async () => {
            const mockAllStats = { total: 0 };
            mockMetricsService.getAllProviderStats.mockReturnValue(mockAllStats);
            
            const handler = mockIpcMainHandlers.get('metrics:get-provider-stats');
            
            // Should fall back to getAllProviderStats for invalid types
            await handler!({}, 123);
            await handler!({}, {});
            await handler!({}, []);
            
            expect(mockMetricsService.getAllProviderStats).toHaveBeenCalledTimes(3);
        });

        it('should reject overly long provider names', async () => {
            const mockAllStats = { total: 0 };
            mockMetricsService.getAllProviderStats.mockReturnValue(mockAllStats);
            
            const handler = mockIpcMainHandlers.get('metrics:get-provider-stats');
            const longProvider = 'a'.repeat(100);
            
            await handler!({}, longProvider);
            
            expect(mockMetricsService.getAllProviderStats).toHaveBeenCalled();
            expect(mockMetricsService.getProviderStats).not.toHaveBeenCalled();
        });

        it('should trim provider names', async () => {
            const mockStats = { provider: 'openai', requests: 10 };
            mockMetricsService.getProviderStats.mockReturnValue(mockStats);
            
            const handler = mockIpcMainHandlers.get('metrics:get-provider-stats');
            await handler!({}, '  openai  ');
            
            expect(mockMetricsService.getProviderStats).toHaveBeenCalledWith('openai');
        });
    });

    describe('metrics:get-summary', () => {
        it('should get metrics summary', async () => {
            const mockSummary = {
                totalRequests: 500,
                successRate: 0.96,
                avgLatencyMs: 300,
                providers: ['openai', 'anthropic', 'google'],
            };
            mockMetricsService.getSummary.mockReturnValue(mockSummary);
            
            const handler = mockIpcMainHandlers.get('metrics:get-summary');
            expect(handler).toBeDefined();
            
            const result = await handler!({});
            
            expect(mockMetricsService.getSummary).toHaveBeenCalled();
            expect(result).toEqual(mockSummary);
        });

        it('should return default summary on error', async () => {
            mockMetricsService.getSummary.mockImplementation(() => {
                throw new Error('Service error');
            });
            
            const handler = mockIpcMainHandlers.get('metrics:get-summary');
            const result = await handler!({});
            
            expect(result).toEqual({
                totalRequests: 0,
                successRate: 0,
                avgLatencyMs: 0,
                providers: [],
            });
        });
    });

    describe('metrics:reset', () => {
        it('should reset all metrics', async () => {
            mockMetricsService.reset.mockReturnValue(undefined);
            
            const handler = mockIpcMainHandlers.get('metrics:reset');
            expect(handler).toBeDefined();
            
            const result = await handler!({});
            
            expect(mockMetricsService.reset).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('should return false on reset error', async () => {
            mockMetricsService.reset.mockImplementation(() => {
                throw new Error('Reset failed');
            });
            
            const handler = mockIpcMainHandlers.get('metrics:reset');
            const result = await handler!({});
            
            expect(result).toBe(false);
        });

        it('should log reset action', async () => {
            mockMetricsService.reset.mockReturnValue(undefined);
            
            const handler = mockIpcMainHandlers.get('metrics:reset');
            await handler!({});
            
            expect(appLogger.info).toHaveBeenCalledWith('MetricsIPC', 'Metrics reset');
        });
    });
});
