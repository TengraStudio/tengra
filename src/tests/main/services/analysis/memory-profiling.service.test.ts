import type { MemoryReport, MemorySnapshot } from '@main/services/analysis/memory-profiling.service';
import { MemoryProfilingService } from '@main/services/analysis/memory-profiling.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock v8 module
vi.mock('v8', () => ({
    getHeapStatistics: vi.fn(() => ({
        total_heap_size: 100 * 1024 * 1024,
        total_heap_size_executable: 5 * 1024 * 1024,
        total_physical_size: 95 * 1024 * 1024,
        total_available_size: 1500 * 1024 * 1024,
        used_heap_size: 50 * 1024 * 1024,
        heap_size_limit: 2048 * 1024 * 1024,
        malloced_memory: 1024 * 1024,
        peak_malloced_memory: 2 * 1024 * 1024,
        does_zap_garbage: 0,
        number_of_native_contexts: 1,
        number_of_detached_contexts: 0,
        total_global_handles_size: 0,
        used_global_handles_size: 0,
        external_memory: 0,
    })),
    writeHeapSnapshot: vi.fn(() => '/tmp/heap-snapshot.heapsnapshot'),
}));

const MOCK_MEMORY = {
    heapUsed: 50 * 1024 * 1024,
    heapTotal: 100 * 1024 * 1024,
    external: 10 * 1024 * 1024,
    arrayBuffers: 5 * 1024 * 1024,
    rss: 200 * 1024 * 1024,
};

describe('MemoryProfilingService', () => {
    let service: MemoryProfilingService;
    let memoryUsageSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        memoryUsageSpy = vi.spyOn(process, 'memoryUsage').mockReturnValue(MOCK_MEMORY as NodeJS.MemoryUsage);
        service = new MemoryProfilingService();
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
        memoryUsageSpy.mockRestore();
    });

    describe('constructor', () => {
        it('should create service without DataService', () => {
            const svc = new MemoryProfilingService();
            expect(svc).toBeDefined();
        });

        it('should create service with DataService', () => {
            const mockDataService = { getPath: vi.fn(() => '/logs') } as never;
            const svc = new MemoryProfilingService(mockDataService);
            expect(svc).toBeDefined();
        });
    });

    describe('takeSnapshot', () => {
        it('should return a valid memory snapshot', () => {
            const snapshot = service.takeSnapshot();

            expect(snapshot.timestamp).toBeGreaterThan(0);
            expect(snapshot.heapUsed).toBe(MOCK_MEMORY.heapUsed);
            expect(snapshot.heapTotal).toBe(MOCK_MEMORY.heapTotal);
            expect(snapshot.external).toBe(MOCK_MEMORY.external);
            expect(snapshot.arrayBuffers).toBe(MOCK_MEMORY.arrayBuffers);
            expect(snapshot.rss).toBe(MOCK_MEMORY.rss);
        });

        it('should accumulate snapshots', () => {
            service.takeSnapshot();
            service.takeSnapshot();
            service.takeSnapshot();

            const report = service.analyzeMemory();
            expect(report.snapshots).toHaveLength(3);
        });

        it('should enforce maxSnapshots limit of 100', () => {
            for (let i = 0; i < 110; i++) {
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            expect(report.snapshots).toHaveLength(100);
        });

        it('should keep the most recent snapshots when exceeding limit', () => {
            // First snapshot has distinct heapUsed
            memoryUsageSpy.mockReturnValueOnce({
                ...MOCK_MEMORY,
                heapUsed: 1,
            } as NodeJS.MemoryUsage);
            service.takeSnapshot();

            // Fill with 100 more to push the first one out
            memoryUsageSpy.mockReturnValue({
                ...MOCK_MEMORY,
                heapUsed: 999,
            } as NodeJS.MemoryUsage);
            for (let i = 0; i < 100; i++) {
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            // The first snapshot (heapUsed=1) should have been evicted
            expect(report.snapshots.every((s: MemorySnapshot) => s.heapUsed === 999)).toBe(true);
        });
    });

    describe('startMonitoring', () => {
        it('should take an initial snapshot immediately', () => {
            service.startMonitoring(60000);

            const report = service.analyzeMemory();
            expect(report.snapshots).toHaveLength(1);
        });

        it('should take additional snapshots at the configured interval', () => {
            service.startMonitoring(5000);

            vi.advanceTimersByTime(5000);
            expect(service.analyzeMemory().snapshots).toHaveLength(2);

            vi.advanceTimersByTime(5000);
            expect(service.analyzeMemory().snapshots).toHaveLength(3);
        });

        it('should stop previous monitoring before starting a new one', () => {
            service.startMonitoring(5000);
            service.startMonitoring(10000);

            // Advance by 10s: if old interval was still running, we'd have extra snapshots
            vi.advanceTimersByTime(10000);
            // 1 initial from first start + 1 initial from second start + 1 interval tick
            expect(service.analyzeMemory().snapshots).toHaveLength(3);
        });

        it('should use default interval of 30000ms', () => {
            service.startMonitoring();

            vi.advanceTimersByTime(30000);
            expect(service.analyzeMemory().snapshots).toHaveLength(2);
        });
    });

    describe('stopMonitoring', () => {
        it('should stop collecting snapshots', () => {
            service.startMonitoring(5000);
            service.stopMonitoring();

            vi.advanceTimersByTime(15000);
            // Only the initial snapshot from startMonitoring
            expect(service.analyzeMemory().snapshots).toHaveLength(1);
        });

        it('should be safe to call when not monitoring', () => {
            expect(() => service.stopMonitoring()).not.toThrow();
        });

        it('should be safe to call multiple times', () => {
            service.startMonitoring(5000);
            service.stopMonitoring();
            expect(() => service.stopMonitoring()).not.toThrow();
        });
    });

    describe('analyzeMemory', () => {
        it('should return stable trend with zero snapshots', () => {
            const report = service.analyzeMemory();

            expect(report.trend).toBe('stable');
            expect(report.averageHeapUsed).toBe(0);
            expect(report.peakHeapUsed).toBe(0);
            expect(report.leakSuspects).toHaveLength(0);
            expect(report.snapshots).toHaveLength(0);
        });

        it('should return stable trend with single snapshot', () => {
            service.takeSnapshot();
            const report = service.analyzeMemory();

            expect(report.trend).toBe('stable');
            expect(report.averageHeapUsed).toBe(MOCK_MEMORY.heapUsed);
            expect(report.peakHeapUsed).toBe(MOCK_MEMORY.heapUsed);
            expect(report.recommendations).toContain('Not enough snapshots for analysis. Take more snapshots.');
        });

        it('should return stable trend with two snapshots of same value', () => {
            service.takeSnapshot();
            service.takeSnapshot();

            const report = service.analyzeMemory();
            expect(report.trend).toBe('stable');
        });

        it('should calculate correct average and peak', () => {
            const values = [100, 200, 300, 400, 500];
            for (const val of values) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: val,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            expect(report.averageHeapUsed).toBe(300);
            expect(report.peakHeapUsed).toBe(500);
        });

        it('should detect increasing trend', () => {
            // Create a clearly increasing sequence
            for (let i = 0; i < 10; i++) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: 1000000 * (i + 1) * 10,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            expect(report.trend).toBe('increasing');
        });

        it('should detect decreasing trend', () => {
            // Create a clearly decreasing sequence
            for (let i = 10; i > 0; i--) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: 1000000 * i * 10,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            expect(report.trend).toBe('decreasing');
        });

        it('should detect stable trend for flat values', () => {
            for (let i = 0; i < 10; i++) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: 50 * 1024 * 1024,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            expect(report.trend).toBe('stable');
        });
    });

    describe('leak detection', () => {
        it('should detect continuous heap growth suspect when growth > 20%', () => {
            // Create 10 snapshots with > 20% growth from first to last
            for (let i = 0; i < 10; i++) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: 100 + i * 10,
                    external: 1000,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            const heapSuspect = report.leakSuspects.find(
                (s) => s.name === 'Continuous Heap Growth'
            );
            expect(heapSuspect).toBeDefined();
        });

        it('should not flag heap growth suspect when growth <= 20%', () => {
            // Create 10 snapshots with minimal growth
            for (let i = 0; i < 10; i++) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: 1000 + i,
                    external: 1000,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            const heapSuspect = report.leakSuspects.find(
                (s) => s.name === 'Continuous Heap Growth'
            );
            expect(heapSuspect).toBeUndefined();
        });

        it('should detect external memory growth suspect when > 1.5x', () => {
            // Need at least 5 snapshots with external growth > 1.5x
            const externalValues = [1000, 1100, 1200, 1400, 1600];
            for (const ext of externalValues) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    external: ext,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            const extSuspect = report.leakSuspects.find(
                (s) => s.name === 'External Memory Growth (Native Modules)'
            );
            expect(extSuspect).toBeDefined();
        });

        it('should not flag external memory when growth <= 1.5x', () => {
            const externalValues = [1000, 1000, 1000, 1000, 1100];
            for (const ext of externalValues) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    external: ext,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            const extSuspect = report.leakSuspects.find(
                (s) => s.name === 'External Memory Growth (Native Modules)'
            );
            expect(extSuspect).toBeUndefined();
        });

        it('should not check for leak suspects with fewer than required snapshots', () => {
            service.takeSnapshot();
            service.takeSnapshot();
            service.takeSnapshot();

            const report = service.analyzeMemory();
            expect(report.leakSuspects).toHaveLength(0);
        });
    });

    describe('recommendations', () => {
        it('should recommend investigation for increasing trend', () => {
            for (let i = 0; i < 10; i++) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: 1000000 * (i + 1) * 10,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            expect(report.recommendations.some((r) => r.includes('memory leaks'))).toBe(true);
        });

        it('should report healthy memory when no issues found', () => {
            for (let i = 0; i < 5; i++) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: 10 * 1024 * 1024,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            expect(report.recommendations).toContain('Memory usage appears healthy.');
        });

        it('should warn when peak heap approaches limit', () => {
            // v8 mock has heap_size_limit = 2048 MB, so 70% = ~1434 MB
            for (let i = 0; i < 5; i++) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: 1500 * 1024 * 1024,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            expect(report.recommendations.some((r) => r.includes('approaching the limit'))).toBe(true);
        });

        it('should warn when average heap exceeds 500MB', () => {
            for (let i = 0; i < 5; i++) {
                memoryUsageSpy.mockReturnValueOnce({
                    ...MOCK_MEMORY,
                    heapUsed: 600 * 1024 * 1024,
                } as NodeJS.MemoryUsage);
                service.takeSnapshot();
            }

            const report = service.analyzeMemory();
            expect(report.recommendations.some((r) => r.includes('high'))).toBe(true);
        });

        it('should include insufficient data recommendation for < 2 snapshots', () => {
            service.takeSnapshot();
            const report = service.analyzeMemory();
            expect(report.recommendations).toContain('Not enough snapshots for analysis. Take more snapshots.');
        });
    });

    describe('forceGC', () => {
        it('should return true and call gc when exposed', () => {
            const mockGc = vi.fn();
            (global as Record<string, unknown>).gc = mockGc;

            const result = service.forceGC();

            expect(result).toBe(true);
            expect(mockGc).toHaveBeenCalledOnce();

            delete (global as Record<string, unknown>).gc;
        });

        it('should return false when gc is not exposed', () => {
            delete (global as Record<string, unknown>).gc;

            const result = service.forceGC();

            expect(result).toBe(false);
        });
    });

    describe('getHeapStatistics', () => {
        it('should return v8 heap statistics', () => {
            const stats = service.getHeapStatistics();

            expect(stats).toBeDefined();
            expect(stats.heap_size_limit).toBe(2048 * 1024 * 1024);
            expect(stats.used_heap_size).toBe(50 * 1024 * 1024);
        });
    });

    describe('writeHeapSnapshot', () => {
        it('should write heap snapshot and return path', async () => {
            const snapshotPath = await service.writeHeapSnapshot();
            expect(snapshotPath).toBe('/tmp/heap-snapshot.heapsnapshot');
        });

        it('should use dataService path when available', async () => {
            const mockDataService = { getPath: vi.fn(() => '/custom/logs') } as never;
            const svcWithData = new MemoryProfilingService(mockDataService);

            await svcWithData.writeHeapSnapshot();

            const v8Module = await import('v8');
            expect(vi.mocked(v8Module.writeHeapSnapshot)).toHaveBeenCalledWith(
                expect.stringContaining('/custom/logs')
            );

            await svcWithData.cleanup();
        });

        it('should fallback to app userData path when dataService is absent', async () => {
            await service.writeHeapSnapshot();

            const v8Module = await import('v8');
            expect(vi.mocked(v8Module.writeHeapSnapshot)).toHaveBeenCalledWith(
                expect.stringContaining('/tmp')
            );
        });

        it('should return filepath when v8.writeHeapSnapshot returns empty', async () => {
            const v8Module = await import('v8');
            vi.mocked(v8Module.writeHeapSnapshot).mockReturnValueOnce('');

            const snapshotPath = await service.writeHeapSnapshot();
            expect(snapshotPath).toContain('heap-');
            expect(snapshotPath).toContain('.heapsnapshot');
        });
    });

    describe('getFormattedMemoryUsage', () => {
        it('should return formatted memory values in MB', () => {
            const formatted = service.getFormattedMemoryUsage();

            expect(formatted.heapUsed).toMatch(/^\d+\.\d{2} MB$/);
            expect(formatted.heapTotal).toMatch(/^\d+\.\d{2} MB$/);
            expect(formatted.external).toMatch(/^\d+\.\d{2} MB$/);
            expect(formatted.arrayBuffers).toMatch(/^\d+\.\d{2} MB$/);
            expect(formatted.rss).toMatch(/^\d+\.\d{2} MB$/);
        });

        it('should contain all expected keys', () => {
            const formatted = service.getFormattedMemoryUsage();
            const keys = Object.keys(formatted);

            expect(keys).toContain('heapUsed');
            expect(keys).toContain('heapTotal');
            expect(keys).toContain('external');
            expect(keys).toContain('arrayBuffers');
            expect(keys).toContain('rss');
            expect(keys).toHaveLength(5);
        });

        it('should format known values correctly', () => {
            memoryUsageSpy.mockReturnValueOnce({
                heapUsed: 1024 * 1024,
                heapTotal: 2 * 1024 * 1024,
                external: 512 * 1024,
                arrayBuffers: 256 * 1024,
                rss: 4 * 1024 * 1024,
            } as NodeJS.MemoryUsage);

            const formatted = service.getFormattedMemoryUsage();
            expect(formatted.heapUsed).toBe('1.00 MB');
            expect(formatted.heapTotal).toBe('2.00 MB');
            expect(formatted.external).toBe('0.50 MB');
            expect(formatted.arrayBuffers).toBe('0.25 MB');
            expect(formatted.rss).toBe('4.00 MB');
        });
    });

    describe('clearSnapshots', () => {
        it('should clear all collected snapshots', () => {
            service.takeSnapshot();
            service.takeSnapshot();
            service.clearSnapshots();

            const report = service.analyzeMemory();
            expect(report.snapshots).toHaveLength(0);
        });

        it('should be safe to call on empty snapshots', () => {
            expect(() => service.clearSnapshots()).not.toThrow();
        });
    });

    describe('cleanup', () => {
        it('should stop monitoring and clear snapshots', async () => {
            service.startMonitoring(5000);
            service.takeSnapshot();

            await service.cleanup();

            // Verify monitoring stopped
            vi.advanceTimersByTime(15000);
            const report = service.analyzeMemory();
            expect(report.snapshots).toHaveLength(0);
        });

        it('should be safe to call multiple times', async () => {
            await service.cleanup();
            await expect(service.cleanup()).resolves.not.toThrow();
        });
    });

    describe('analyzeMemory report structure', () => {
        it('should return all required fields in MemoryReport', () => {
            service.takeSnapshot();
            service.takeSnapshot();
            service.takeSnapshot();

            const report: MemoryReport = service.analyzeMemory();

            expect(report).toHaveProperty('snapshots');
            expect(report).toHaveProperty('trend');
            expect(report).toHaveProperty('averageHeapUsed');
            expect(report).toHaveProperty('peakHeapUsed');
            expect(report).toHaveProperty('leakSuspects');
            expect(report).toHaveProperty('recommendations');
            expect(Array.isArray(report.snapshots)).toBe(true);
            expect(Array.isArray(report.leakSuspects)).toBe(true);
            expect(Array.isArray(report.recommendations)).toBe(true);
        });

        it('should have valid trend value', () => {
            service.takeSnapshot();
            const report = service.analyzeMemory();

            expect(['stable', 'increasing', 'decreasing']).toContain(report.trend);
        });
    });
});
