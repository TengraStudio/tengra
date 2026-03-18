/**
 * Integration tests for TelemetryService (BACKLOG-0462)
 */
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { SettingsService } from '@main/services/system/settings.service';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

// Mock electron and dependencies
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/tmp/test')
    }
}));

interface MockSettingsService {
    getSettings: MockInstance;
}

describe('TelemetryService Integration Tests', () => {
    let service: TelemetryService;
    let mockSettingsService: MockSettingsService;

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
            mockSettingsService as never as SettingsService
        );
    });

    afterEach(async () => {
        vi.useRealTimers();
        await service.cleanup();
    });

    describe('Full lifecycle integration', () => {
        it('should initialize and track events', async () => {
            await service.initialize();

            const result1 = service.track('app.start', { version: '1.0.0' });
            expect(result1.success).toBe(true);

            const result2 = service.track('user.action', { action: 'click' });
            expect(result2.success).toBe(true);
        });

        it('should flush events on cleanup', async () => {
            service.track('test.event');

            await service.cleanup();

            expect(service.getQueueSize()).toBe(0);
        });

        it('should maintain session across events', async () => {
            await service.initialize();

            service.track('event1');
            service.track('event2');

            const health = service.getHealth();
            expect(health.sessionId).toBeDefined();
            expect(health.sessionId.length).toBeGreaterThan(0);
        });
    });

    describe('Critical flow: Telemetry toggle', () => {
        it('should stop tracking when disabled', async () => {
            await service.initialize();

            // Enable: track works
            mockSettingsService.getSettings.mockReturnValue({ telemetry: { enabled: true } });
            const result1 = service.track('enabled.event');
            expect(result1.success).toBe(true);

            // Disable: track returns disabled error
            mockSettingsService.getSettings.mockReturnValue({ telemetry: { enabled: false } });
            const result2 = service.track('disabled.event');
            expect(result2.success).toBe(false);
            expect(result2.error).toBe('TELEMETRY_DISABLED');
        });

        it('should handle missing telemetry settings', async () => {
            mockSettingsService.getSettings.mockReturnValue({});

            const result = service.track('no.settings');
            expect(result.success).toBe(false);
        });
    });

    describe('Critical flow: Queue overflow handling', () => {
        it('should reject events when queue is full', async () => {
            // Fill queue to max
            for (let i = 0; i < 10000; i++) {
                service.track(`event${i}`);
            }

            // One more should fail
            const result = service.track('overflow.event');
            expect(result.success).toBe(false);
            expect(result.error).toBe('QUEUE_OVERFLOW');
        });
    });

    describe('Critical flow: Health monitoring', () => {
        it('should report healthy status', async () => {
            await service.initialize();

            const health = service.getHealth();

            expect(health.isHealthy).toBe(true);
            expect(health.queueSize).toBe(0);
            expect(health.telemetryEnabled).toBe(true);
        });

        it('should report unhealthy when queue near full', async () => {
            // Fill queue to 95% of max
            for (let i = 0; i < 9500; i++) {
                service.track(`event${i}`);
            }

            const health = service.getHealth();
            expect(health.isHealthy).toBe(false);
        });
    });

    describe('Critical flow: Event validation', () => {
        it('should reject invalid event names', async () => {
            await service.initialize();

            // Empty name
            const result1 = service.track('');
            expect(result1.success).toBe(false);

            // Too long
            const result2 = service.track('a'.repeat(300));
            expect(result2.success).toBe(false);

            // Invalid characters
            const result3 = service.track('event<script>');
            expect(result3.success).toBe(false);

            const result4 = service.track('event@name');
            expect(result4.success).toBe(false);
        });

        it('should accept valid event names', async () => {
            await service.initialize();

            expect(service.track('simple').success).toBe(true);
            expect(service.track('event.name').success).toBe(true);
            expect(service.track('event-name').success).toBe(true);
            expect(service.track('event_name').success).toBe(true);
            expect(service.track('Event123.Name').success).toBe(true);
        });
    });

    describe('Critical flow: Properties validation', () => {
        it('should accept valid properties', async () => {
            await service.initialize();

            const result = service.track('test.event', {
                userId: '123',
                action: 'click',
                metadata: { version: '1.0' }
            });

            expect(result.success).toBe(true);
        });

        it('should reject oversized properties', async () => {
            await service.initialize();

            const largeData = 'x'.repeat(100001); // 100KB + 1
            const result = service.track('test.event', { data: largeData });

            expect(result.success).toBe(false);
            expect(result.error).toBe('INVALID_PROPERTIES');
        });
    });

    describe('Critical flow: Retry and recovery', () => {
        it('should track flush success', async () => {
            service.track('test1');
            service.track('test2');

            const flushResult = await service.flush();

            expect(flushResult).toBe(true);
            expect(service.getQueueSize()).toBe(0);
        });
    });

    describe('Performance budgets', () => {
        it('should have performance budgets defined', async () => {
            const { TELEMETRY_PERFORMANCE_BUDGETS } = await import('@main/services/analysis/telemetry.service');

            expect(TELEMETRY_PERFORMANCE_BUDGETS.track).toBeDefined();
            expect(TELEMETRY_PERFORMANCE_BUDGETS.flush).toBeDefined();
            expect(TELEMETRY_PERFORMANCE_BUDGETS.initialize).toBeDefined();
            expect(TELEMETRY_PERFORMANCE_BUDGETS.cleanup).toBeDefined();
        });
    });

    describe('Regression: batch then flush cycle', () => {
        it('should flush all events tracked via trackBatch', async () => {
            await service.initialize();

            const batch = Array.from({ length: 10 }, (_, i) => ({ name: `batch.event${i}` }));
            const result = service.trackBatch(batch);
            expect(result.success).toBe(true);
            expect(service.getQueueSize()).toBe(10);

            await service.flush();
            expect(service.getQueueSize()).toBe(0);
            expect(service.getTotalFlushedEvents()).toBe(10);
        });

        it('should maintain correct counters across mixed track and trackBatch', async () => {
            service.track('single.event');
            service.trackBatch([{ name: 'batch1' }, { name: 'batch2' }]);
            expect(service.getTotalTrackedEvents()).toBe(3);
            expect(service.getQueueSize()).toBe(3);

            await service.flush();
            expect(service.getTotalFlushedEvents()).toBe(3);

            service.track('after.flush');
            expect(service.getTotalTrackedEvents()).toBe(4);
            expect(service.getQueueSize()).toBe(1);
        });
    });

    describe('Regression: multiple flush cycles', () => {
        it('should handle repeated init-track-flush-cleanup cycles', async () => {
            for (let cycle = 0; cycle < 3; cycle++) {
                const svc = new TelemetryService(
                    mockSettingsService as never as SettingsService
                );
                await svc.initialize();
                svc.track(`cycle${cycle}.event`);
                await svc.flush();
                expect(svc.getQueueSize()).toBe(0);
                await svc.cleanup();
            }
        });
    });

    describe('Regression: telemetry toggle mid-batch', () => {
        it('should reject remaining events when disabled mid-batch', () => {
            let callCount = 0;
            mockSettingsService.getSettings.mockImplementation(() => {
                callCount++;
                // Disable after first call
                return { telemetry: { enabled: callCount <= 1 } };
            });

            const result = service.trackBatch([
                { name: 'event1' },
                { name: 'event2' },
                { name: 'event3' }
            ]);

            expect(result.success).toBe(false);
            expect(result.results?.[0].success).toBe(true);
            expect(result.results?.[1].success).toBe(false);
            expect(result.results?.[2].success).toBe(false);
        });
    });

    describe('Regression: health after overflow recovery', () => {
        it('should recover health after flush clears overflow state', async () => {
            // Fill to 91% (unhealthy threshold)
            for (let i = 0; i < 9100; i++) {
                service.track(`event${i}`);
            }
            expect(service.getHealth().isHealthy).toBe(false);

            await service.flush();
            expect(service.getHealth().isHealthy).toBe(true);
            expect(service.getHealth().queueSize).toBe(0);
        });
    });
});
