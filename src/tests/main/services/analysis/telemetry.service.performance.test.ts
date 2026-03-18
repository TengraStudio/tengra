/**
 * Performance instrumentation tests for TelemetryService (BACKLOG-0466)
 */
import { appLogger } from '@main/logging/logger';
import {
    TELEMETRY_PERFORMANCE_BUDGETS,
    TelemetryService
} from '@main/services/analysis/telemetry.service';
import { afterEach, beforeEach, describe, expect, it, type MockInstance,vi } from 'vitest';

// Mock the logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: vi.fn().mockReturnValue('test-uuid-perf')
}));

interface MockSettingsService {
    getSettings: MockInstance;
}

describe('TelemetryService Performance Instrumentation', () => {
    let service: TelemetryService;
    let mockSettingsService: MockSettingsService;
    let warnSpy: MockInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                telemetry: { enabled: true }
            })
        };

        service = new TelemetryService(
            mockSettingsService as never as ConstructorParameters<typeof TelemetryService>[0]
        );

        warnSpy = appLogger.warn as never as MockInstance;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('performance budgets constants', () => {
        it('should export TELEMETRY_PERFORMANCE_BUDGETS with correct keys', () => {
            expect(TELEMETRY_PERFORMANCE_BUDGETS).toBeDefined();
            expect(TELEMETRY_PERFORMANCE_BUDGETS.track).toBe(10);
            expect(TELEMETRY_PERFORMANCE_BUDGETS.flush).toBe(5000);
            expect(TELEMETRY_PERFORMANCE_BUDGETS.initialize).toBe(1000);
            expect(TELEMETRY_PERFORMANCE_BUDGETS.cleanup).toBe(2000);
        });

        it('should have readonly budgets', () => {
            const budgets = TELEMETRY_PERFORMANCE_BUDGETS;
            expect(Object.isFrozen(budgets)).toBe(false); // as const doesn't freeze
            expect(typeof budgets.track).toBe('number');
            expect(typeof budgets.flush).toBe('number');
            expect(typeof budgets.initialize).toBe('number');
            expect(typeof budgets.cleanup).toBe('number');
        });
    });

    describe('track() timing instrumentation', () => {
        it('should not log warning when track completes within budget', () => {
            service.track('fast.event');

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for track')
            );
            expect(budgetWarnings).toHaveLength(0);
        });

        it('should log warning when track exceeds budget', () => {
            const originalNow = performance.now;
            let callCount = 0;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                // First call returns 0, second returns budget + 1
                return callCount === 1 ? 0 : TELEMETRY_PERFORMANCE_BUDGETS.track + 1;
            });

            service.track('slow.event');

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for track')
            );
            expect(budgetWarnings).toHaveLength(1);
            expect(budgetWarnings[0][1]).toContain('budget: 10ms');

            performance.now = originalNow;
        });
    });

    describe('flush() timing instrumentation', () => {
        it('should not log warning when flush completes within budget', async () => {
            service.track('event1');
            await service.flush();

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for flush')
            );
            expect(budgetWarnings).toHaveLength(0);
        });

        it('should log warning when flush exceeds budget', async () => {
            let callCount = 0;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                // flush() calls performance.now twice: start and end
                return callCount % 2 === 1 ? 0 : TELEMETRY_PERFORMANCE_BUDGETS.flush + 100;
            });

            service.track('event1');
            await service.flush();

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for flush')
            );
            expect(budgetWarnings).toHaveLength(1);
            expect(budgetWarnings[0][1]).toContain('budget: 5000ms');
        });
    });

    describe('initialize() timing instrumentation', () => {
        it('should not log warning when initialize completes within budget', async () => {
            await service.initialize();

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for initialize')
            );
            expect(budgetWarnings).toHaveLength(0);
        });

        it('should log warning when initialize exceeds budget', async () => {
            let callCount = 0;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                return callCount === 1 ? 0 : TELEMETRY_PERFORMANCE_BUDGETS.initialize + 500;
            });

            await service.initialize();

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for initialize')
            );
            expect(budgetWarnings).toHaveLength(1);
            expect(budgetWarnings[0][1]).toContain('budget: 1000ms');
        });
    });

    describe('cleanup() timing instrumentation', () => {
        it('should not log warning when cleanup completes within budget', async () => {
            await service.initialize();
            warnSpy.mockClear();

            await service.cleanup();

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for cleanup')
            );
            expect(budgetWarnings).toHaveLength(0);
        });

        it('should log warning when cleanup exceeds budget', async () => {
            await service.initialize();
            service.track('event1');
            warnSpy.mockClear();

            let callCount = 0;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                // cleanup calls performance.now twice (start + end), flush also calls it twice
                // We want the outermost (cleanup) to exceed budget
                if (callCount === 1) {return 0;}
                return TELEMETRY_PERFORMANCE_BUDGETS.cleanup + 500;
            });

            await service.cleanup();

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for cleanup')
            );
            expect(budgetWarnings).toHaveLength(1);
            expect(budgetWarnings[0][1]).toContain('budget: 2000ms');
        });
    });

    describe('trackBatch() timing instrumentation', () => {
        it('should not log warning when batch completes within budget', () => {
            service.trackBatch([
                { name: 'event1' },
                { name: 'event2' }
            ]);

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for trackBatch')
            );
            expect(budgetWarnings).toHaveLength(0);
        });

        it('should use scaled budget based on batch size', () => {
            const events = [{ name: 'e1' }, { name: 'e2' }, { name: 'e3' }];
            let callCount = 0;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                // trackBatch calls performance.now twice for itself, plus track() calls it twice per event
                // We return 0 for all starts, and a value exceeding per-event budget * count for the final
                if (callCount === 1) {return 0;}
                // Return value exceeding 3 * 10ms = 30ms budget for the batch
                return 31;
            });

            service.trackBatch(events);

            const budgetWarnings = warnSpy.mock.calls.filter(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded for trackBatch')
            );
            expect(budgetWarnings).toHaveLength(1);
        });
    });

    describe('warning message format', () => {
        it('should include operation name, duration and budget in warning', () => {
            let callCount = 0;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                return callCount === 1 ? 0 : 15.75;
            });

            service.track('test.event');

            const budgetWarning = warnSpy.mock.calls.find(
                (call: TestValue[]) =>
                    call[0] === 'TelemetryService' &&
                    typeof call[1] === 'string' &&
                    call[1].includes('Performance budget exceeded')
            );

            expect(budgetWarning).toBeDefined();
            if (!budgetWarning || typeof budgetWarning[1] !== 'string') {
                throw new Error('Expected performance budget warning to be emitted');
            }
            const message = budgetWarning[1];
            expect(message).toContain('track');
            expect(message).toContain('15.75ms');
            expect(message).toContain('budget: 10ms');
        });
    });
});
