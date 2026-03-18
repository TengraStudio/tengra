/**
 * Performance budget tests for MonitoringService (BACKLOG-0456)
 * Verifies that timing instrumentation logs warnings when budgets are exceeded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('os', () => ({
    loadavg: vi.fn(),
    totalmem: vi.fn(),
    freemem: vi.fn(),
    platform: vi.fn(),
}));

vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { exec } from 'child_process';
import * as os from 'os';

import { appLogger } from '@main/logging/logger';
import { MONITORING_PERFORMANCE_BUDGETS, MonitoringService } from '@main/services/analysis/monitoring.service';

const mockExec = exec as never as ReturnType<typeof vi.fn>;

describe('MonitoringService performance budgets', () => {
    let service: MonitoringService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(os.platform).mockReturnValue('win32');
        vi.mocked(os.loadavg).mockReturnValue([0.5, 0.3, 0.2]);
        vi.mocked(os.totalmem).mockReturnValue(16_000_000_000);
        vi.mocked(os.freemem).mockReturnValue(8_000_000_000);
        mockExec.mockImplementation(
            (_cmd: string, _opts: Record<string, TestValue>, cb: (err: null, out: string, stderr: string) => void) => {
                cb(null, 'mock output', '');
            }
        );
        service = new MonitoringService();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('MONITORING_PERFORMANCE_BUDGETS constants', () => {
        it('should define all expected budget keys', () => {
            expect(MONITORING_PERFORMANCE_BUDGETS.GET_USAGE_MS).toBe(100);
            expect(MONITORING_PERFORMANCE_BUDGETS.GET_SYSTEM_MONITOR_MS).toBe(6000);
            expect(MONITORING_PERFORMANCE_BUDGETS.GET_BATTERY_STATUS_MS).toBe(6000);
            expect(MONITORING_PERFORMANCE_BUDGETS.COLLECT_ALL_METRICS_MS).toBe(15000);
            expect(MONITORING_PERFORMANCE_BUDGETS.INITIALIZE_MS).toBe(100);
            expect(MONITORING_PERFORMANCE_BUDGETS.CLEANUP_MS).toBe(100);
        });

        it('should be readonly (frozen-like via as const)', () => {
            const budgets = MONITORING_PERFORMANCE_BUDGETS;
            expect(typeof budgets.GET_USAGE_MS).toBe('number');
            expect(typeof budgets.INITIALIZE_MS).toBe('number');
        });
    });

    describe('warnIfOverBudget logging', () => {
        it('should not warn when getUsage completes within budget', async () => {
            await service.initialize();
            vi.mocked(appLogger.warn).mockClear();

            await service.getUsage();

            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('Performance budget exceeded')
            );
            expect(budgetWarnings).toHaveLength(0);
        });

        it('should not warn when initialize completes within budget', async () => {
            vi.mocked(appLogger.warn).mockClear();

            await service.initialize();

            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for initialize')
            );
            expect(budgetWarnings).toHaveLength(0);
        });

        it('should not warn when cleanup completes within budget', async () => {
            await service.initialize();
            vi.mocked(appLogger.warn).mockClear();

            await service.cleanup();

            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for cleanup')
            );
            expect(budgetWarnings).toHaveLength(0);
        });

        it('should warn when getUsage exceeds budget', async () => {
            await service.initialize();
            vi.mocked(appLogger.warn).mockClear();

            // Simulate slow operation by making performance.now return large deltas
            const originalNow = performance.now;
            let callCount = 0;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                // First call returns 0 (start), second call returns budget + extra (end)
                return callCount % 2 === 1 ? 0 : MONITORING_PERFORMANCE_BUDGETS.GET_USAGE_MS + 50;
            });

            await service.getUsage();

            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for getUsage')
            );
            expect(budgetWarnings).toHaveLength(1);
            expect(budgetWarnings[0][2]).toEqual(
                expect.objectContaining({ budgetMs: MONITORING_PERFORMANCE_BUDGETS.GET_USAGE_MS })
            );

            vi.spyOn(performance, 'now').mockRestore();
            performance.now = originalNow;
        });

        it('should warn when getSystemMonitor exceeds budget', async () => {
            await service.initialize();
            vi.mocked(appLogger.warn).mockClear();

            let callCount = 0;
            const originalNow = performance.now;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                return callCount % 2 === 1 ? 0 : MONITORING_PERFORMANCE_BUDGETS.GET_SYSTEM_MONITOR_MS + 500;
            });

            await service.getSystemMonitor();

            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) =>
                    typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for getSystemMonitor')
            );
            expect(budgetWarnings).toHaveLength(1);

            vi.spyOn(performance, 'now').mockRestore();
            performance.now = originalNow;
        });

        it('should warn when getBatteryStatus exceeds budget', async () => {
            await service.initialize();
            vi.mocked(appLogger.warn).mockClear();

            let callCount = 0;
            const originalNow = performance.now;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                return callCount % 2 === 1 ? 0 : MONITORING_PERFORMANCE_BUDGETS.GET_BATTERY_STATUS_MS + 500;
            });

            await service.getBatteryStatus();

            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) =>
                    typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for getBatteryStatus')
            );
            expect(budgetWarnings).toHaveLength(1);

            vi.spyOn(performance, 'now').mockRestore();
            performance.now = originalNow;
        });

        it('should include elapsedMs and budgetMs in warning metadata', async () => {
            await service.initialize();
            vi.mocked(appLogger.warn).mockClear();

            let callCount = 0;
            const originalNow = performance.now;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                return callCount % 2 === 1 ? 0 : MONITORING_PERFORMANCE_BUDGETS.GET_USAGE_MS + 200;
            });

            await service.getUsage();

            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarning = warnCalls.find(
                (call) => typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for getUsage')
            );
            expect(budgetWarning).toBeDefined();
            expect(budgetWarning![2]).toEqual({
                elapsedMs: MONITORING_PERFORMANCE_BUDGETS.GET_USAGE_MS + 200,
                budgetMs: MONITORING_PERFORMANCE_BUDGETS.GET_USAGE_MS,
            });

            vi.spyOn(performance, 'now').mockRestore();
            performance.now = originalNow;
        });

        it('should still log warning even when getUsage fails', async () => {
            await service.initialize();
            vi.mocked(os.loadavg).mockImplementation(() => {
                throw new Error('OS error');
            });
            vi.mocked(appLogger.warn).mockClear();

            let callCount = 0;
            const originalNow = performance.now;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                return callCount % 2 === 1 ? 0 : MONITORING_PERFORMANCE_BUDGETS.GET_USAGE_MS + 50;
            });

            const result = await service.getUsage();
            expect(result.success).toBe(false);

            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for getUsage')
            );
            expect(budgetWarnings).toHaveLength(1);

            vi.spyOn(performance, 'now').mockRestore();
            performance.now = originalNow;
        });
    });
});
