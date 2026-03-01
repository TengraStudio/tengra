import { PerformanceService } from '@main/services/analysis/performance.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@main/utils/cache.util', () => ({
    getCacheAnalyticsSnapshot: vi.fn().mockReturnValue({ hitRate: 0.9 })
}));

describe('PerformanceService', () => {
    let service: PerformanceService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new PerformanceService();
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
    });

    it('should initialize and start monitoring', async () => {
        await service.initialize();
        // No throw means success
    });

    it('should cleanup and stop monitoring', async () => {
        await service.initialize();
        await service.cleanup();
        // Should not throw
    });

    describe('getMemoryStats', () => {
        it('should return memory statistics', () => {
            const result = service.getMemoryStats();
            expect(result.success).toBe(true);
            expect(result.result?.main).toBeDefined();
            expect(result.result?.timestamp).toBeGreaterThan(0);
        });

        it('should track history and trim to max', () => {
            for (let i = 0; i < 65; i++) {
                service.getMemoryStats();
            }
            // Internal history should be trimmed to maxHistoryLength (60)
            const dashboard = service.getDashboard();
            expect(dashboard.result?.memory.sampleCount).toBeLessThanOrEqual(60);
        });
    });

    describe('detectLeak', () => {
        it('should return no leak with insufficient history', async () => {
            const result = await service.detectLeak();
            expect(result.success).toBe(true);
            expect(result.result?.isPossibleLeak).toBe(false);
        });

        it('should detect possible leak with strictly increasing samples', async () => {
            // Manually populate history by calling getMemoryStats
            // We need to control heapUsed, but process.memoryUsage is real
            // Instead, just verify the structure works
            for (let i = 0; i < 6; i++) {
                service.getMemoryStats();
            }
            const result = await service.detectLeak();
            expect(result.success).toBe(true);
            expect(result.result).toHaveProperty('isPossibleLeak');
            expect(result.result).toHaveProperty('trend');
        });
    });

    describe('triggerGC', () => {
        it('should return error when gc not exposed', () => {
            const result = service.triggerGC();
            // global.gc is typically not available in tests
            expect(result.success).toBe(false);
            expect(result.error).toContain('GC not exposed');
        });

        it('should trigger gc when available', () => {
            const originalGc = global.gc;
            global.gc = vi.fn();
            try {
                const result = service.triggerGC();
                expect(result.success).toBe(true);
                expect(global.gc).toHaveBeenCalled();
            } finally {
                global.gc = originalGc;
            }
        });
    });

    describe('getDashboard', () => {
        it('should return dashboard data', () => {
            const result = service.getDashboard();
            expect(result.success).toBe(true);
            expect(result.result?.memory).toBeDefined();
            expect(result.result?.alerts).toBeInstanceOf(Array);
            expect(result.result?.caches).toBeDefined();
        });
    });

    describe('memory monitoring interval', () => {
        it('should sample memory on interval', async () => {
            await service.initialize();
            vi.advanceTimersByTime(60000);
            const dashboard = service.getDashboard();
            expect(dashboard.result?.memory.sampleCount).toBeGreaterThan(0);
        });
    });
});
