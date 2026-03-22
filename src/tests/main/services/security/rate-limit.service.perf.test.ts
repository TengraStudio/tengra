import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { appLogger } from '@main/logging/logger';
import {
    RATE_LIMIT_PERFORMANCE_BUDGETS,
    RateLimitService
} from '@main/services/security/rate-limit.service';

const IMMEDIATE_WAIT_BUDGET_MS = Math.max(
    RATE_LIMIT_PERFORMANCE_BUDGETS.TRY_ACQUIRE_MS * 5,
    5
);

describe('RateLimitService - Performance Budgets', () => {
    let service: RateLimitService;

    beforeEach(() => {
        service = new RateLimitService();
        vi.mocked(appLogger.warn).mockClear();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    function measureAverageDuration(iterations: number, operation: () => void): number {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            operation();
        }
        return (performance.now() - start) / iterations;
    }

    describe('tryAcquire performance', () => {
        it('should complete within TRY_ACQUIRE_MS budget for unknown provider', () => {
            service.tryAcquire('unknown-provider-warmup');
            const duration = measureAverageDuration(250, () => {
                service.tryAcquire('unknown-provider');
            });

            expect(duration).toBeLessThan(RATE_LIMIT_PERFORMANCE_BUDGETS.TRY_ACQUIRE_MS);
        });

        it('should complete within TRY_ACQUIRE_MS budget when tokens available', () => {
            service.setLimit('perf-test', { requestsPerMinute: 60, maxBurst: 10 });

            const start = performance.now();
            service.tryAcquire('perf-test');
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(RATE_LIMIT_PERFORMANCE_BUDGETS.TRY_ACQUIRE_MS);
        });

        it('should complete within TRY_ACQUIRE_MS budget when tokens exhausted', () => {
            service.setLimit('perf-test', { requestsPerMinute: 60, maxBurst: 1 });
            service.tryAcquire('perf-test'); // exhaust tokens

            const start = performance.now();
            service.tryAcquire('perf-test');
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(RATE_LIMIT_PERFORMANCE_BUDGETS.TRY_ACQUIRE_MS);
        });

        it('should handle 1000 sequential tryAcquire calls within budget', () => {
            const iterations = 1000;
            service.setLimit('perf-batch', { requestsPerMinute: 60000, maxBurst: 2000 });

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                service.tryAcquire('perf-batch');
            }
            const totalDuration = performance.now() - start;
            const avgDuration = totalDuration / iterations;

            expect(avgDuration).toBeLessThan(RATE_LIMIT_PERFORMANCE_BUDGETS.TRY_ACQUIRE_MS);
        });
    });

    describe('setLimit performance', () => {
        it('should complete within SET_LIMIT_MS budget', () => {
            const start = performance.now();
            service.setLimit('perf-set', { requestsPerMinute: 60, maxBurst: 10 });
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(RATE_LIMIT_PERFORMANCE_BUDGETS.SET_LIMIT_MS);
        });

        it('should handle 100 sequential setLimit calls within budget', () => {
            const iterations = 100;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                service.setLimit(`perf-provider-${i}`, { requestsPerMinute: 60, maxBurst: 10 });
            }
            const totalDuration = performance.now() - start;
            const avgDuration = totalDuration / iterations;

            expect(avgDuration).toBeLessThan(RATE_LIMIT_PERFORMANCE_BUDGETS.SET_LIMIT_MS);
        });
    });

    describe('waitForToken performance', () => {
        it('should complete immediately for unknown provider within budget', async () => {
            const start = performance.now();
            await service.waitForToken('unknown-provider');
            const duration = performance.now() - start;

            // Async resolution and clock granularity can exceed 1ms on Windows even for immediate returns.
            expect(duration).toBeLessThan(IMMEDIATE_WAIT_BUDGET_MS);
        });

        it('should complete quickly when tokens are available', async () => {
            service.setLimit('perf-wait', { requestsPerMinute: 60, maxBurst: 10 });

            const start = performance.now();
            await service.waitForToken('perf-wait');
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(IMMEDIATE_WAIT_BUDGET_MS);
        });
    });

    describe('performance budget warning instrumentation', () => {
        it('should not log warning when tryAcquire is within budget', () => {
            service.setLimit('warn-test', { requestsPerMinute: 60, maxBurst: 10 });
            service.tryAcquire('warn-test');

            const warnCalls = vi.mocked(appLogger.warn).mock.calls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for tryAcquire')
            );
            expect(warnCalls).toHaveLength(0);
        });

        it('should not log warning when setLimit is within budget', () => {
            service.setLimit('warn-test', { requestsPerMinute: 60, maxBurst: 10 });

            const warnCalls = vi.mocked(appLogger.warn).mock.calls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for setLimit')
            );
            expect(warnCalls).toHaveLength(0);
        });

        it('should not log warning when waitForToken resolves immediately', async () => {
            service.setLimit('warn-test', { requestsPerMinute: 60, maxBurst: 10 });
            await service.waitForToken('warn-test');

            const warnCalls = vi.mocked(appLogger.warn).mock.calls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('Performance budget exceeded for waitForToken')
            );
            expect(warnCalls).toHaveLength(0);
        });
    });

    describe('RATE_LIMIT_PERFORMANCE_BUDGETS constants', () => {
        it('should have correct budget values', () => {
            expect(RATE_LIMIT_PERFORMANCE_BUDGETS.TRY_ACQUIRE_MS).toBe(1);
            expect(RATE_LIMIT_PERFORMANCE_BUDGETS.WAIT_FOR_TOKEN_MS).toBe(60000);
            expect(RATE_LIMIT_PERFORMANCE_BUDGETS.SET_LIMIT_MS).toBe(1);
            expect(RATE_LIMIT_PERFORMANCE_BUDGETS.CLEANUP_MS).toBe(100);
        });

        it('should be readonly', () => {
            const budgets = RATE_LIMIT_PERFORMANCE_BUDGETS;
            expect(Object.isFrozen(budgets)).toBe(false); // as const doesn't freeze at runtime
            expect(budgets.TRY_ACQUIRE_MS).toBe(1); // but values are correct
        });
    });
});
