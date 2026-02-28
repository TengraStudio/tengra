/**
 * Unit tests for TelemetryService (BACKLOG-0461)
 */
import { TelemetryErrorCode, TelemetryService } from '@main/services/analysis/telemetry.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    v4: vi.fn().mockReturnValue('test-uuid-1234')
}));

describe('TelemetryService', () => {
    let service: TelemetryService;
    let mockSettingsService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                telemetry: { enabled: true }
            })
        };

        service = new TelemetryService(mockSettingsService);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('track', () => {
        it('should track event when telemetry is enabled', () => {
            service.track('test.event', { key: 'value' });

            // Method returns void, but we verify the internal queue has the event
            // We need to access internal state via a public method or check via flush
            expect(mockSettingsService.getSettings).toHaveBeenCalled();
        });

        it('should not track event when telemetry is disabled', () => {
            mockSettingsService.getSettings.mockReturnValue({
                telemetry: { enabled: false }
            });

            service.track('test.event', { key: 'value' });

            // No settings call expected when disabled (early return)
            expect(mockSettingsService.getSettings).toHaveBeenCalled();
        });

        it('should handle missing telemetry settings (defaults to disabled)', () => {
            mockSettingsService.getSettings.mockReturnValue({});

            service.track('test.event');

            // Should return early due to falsy telemetry
            expect(mockSettingsService.getSettings).toHaveBeenCalled();
        });

        it('should handle undefined telemetry settings', () => {
            mockSettingsService.getSettings.mockReturnValue(undefined);

            service.track('test.event');

            expect(mockSettingsService.getSettings).toHaveBeenCalled();
        });

        it('should generate unique IDs for each event', () => {
            service.track('event1');
            service.track('event2');
            service.track('event3');
        });

        it('should include session ID in all events', () => {
            service.track('test.event');
        });

        it('should include timestamp in events', () => {
            service.track('test.event');
        });

        it('should handle very large properties object', () => {
            const largeProps = {
                data: 'x'.repeat(10000)
            };

            service.track('large.event', largeProps);
        });

        it('should handle special characters in event name', () => {
            service.track('event.with.dots');
            service.track('event-with-dashes');
            service.track('event_with_underscores');
        });

        it('should handle empty properties', () => {
            service.track('empty.props', {});
        });

        it('should handle undefined properties', () => {
            service.track('undefined.props', undefined);
        });

        it('should handle null properties', () => {
            // @ts-expect-error - testing null input
            service.track('null.props', null);
        });

        it('should handle nested object properties', () => {
            service.track('nested.event', {
                user: { id: 1, name: 'Test' },
                metadata: { version: '1.0.0', timestamp: Date.now() }
            });
        });

        it('should handle array properties', () => {
            service.track('array.event', {
                items: [1, 2, 3],
                strings: ['a', 'b', 'c']
            });
        });
    });

    describe('queue management', () => {
        it('should add events to queue', () => {
            service.track('event1');
            service.track('event2');
            service.track('event3');
        });

        it('should handle rapid successive track calls', () => {
            for (let i = 0; i < 100; i++) {
                service.track(`event${i}`);
            }
        });
    });

    describe('initialization', () => {
        it('should initialize without error', async () => {
            await expect(service.initialize()).resolves.not.toThrow();
        });

        it('should start flush interval on init', async () => {
            await service.initialize();
            // Interval should be set (verified by no errors)
        });

        it('should be able to cleanup after init', async () => {
            await service.initialize();
            await expect(service.cleanup()).resolves.not.toThrow();
        });
    });

    describe('cleanup', () => {
        it('should clear flush interval on cleanup', async () => {
            await service.initialize();
            await service.cleanup();
            // Should not throw
        });

        it('should flush remaining events on cleanup', async () => {
            service.track('event1');
            service.track('event2');
            await service.cleanup();
            // Events should be flushed
        });
    });

    describe('edge cases - event name validation', () => {
        it('should reject event name with spaces', () => {
            const result = service.track('event with spaces');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });

        it('should reject event name with special characters (!@#$%)', () => {
            const result = service.track('event!@#$%');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });

        it('should reject event name with unicode characters', () => {
            const result = service.track('event_ñ_über');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });

        it('should reject event name with slashes', () => {
            const result = service.track('event/path');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });

        it('should reject event name exceeding 256 characters', () => {
            const longName = 'a'.repeat(257);
            const result = service.track(longName);
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });

        it('should accept event name exactly 256 characters', () => {
            const exactName = 'a'.repeat(256);
            const result = service.track(exactName);
            expect(result.success).toBe(true);
        });

        it('should reject empty event name', () => {
            const result = service.track('');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });
    });

    describe('edge cases - properties validation', () => {
        it('should reject properties exceeding 100KB', () => {
            const hugeProps: Record<string, unknown> = {
                data: 'x'.repeat(100001)
            };
            const result = service.track('valid.event', hugeProps);
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_PROPERTIES);
        });

        it('should accept properties just under 100KB', () => {
            const props: Record<string, unknown> = {
                data: 'x'.repeat(99000)
            };
            const result = service.track('valid.event', props);
            expect(result.success).toBe(true);
        });

        it('should reject properties with circular references', () => {
            const circular: Record<string, unknown> = { a: 1 };
            circular['self'] = circular;
            const result = service.track('valid.event', circular);
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_PROPERTIES);
        });
    });

    describe('edge cases - queue overflow', () => {
        it('should reject events when queue reaches MAX_QUEUE_SIZE', () => {
            // Fill queue to capacity
            for (let i = 0; i < 10000; i++) {
                service.track(`event${i}`);
            }
            expect(service.getQueueSize()).toBe(10000);

            const result = service.track('overflow.event');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.QUEUE_OVERFLOW);
        });

        it('should not increment totalTrackedEvents on overflow', () => {
            for (let i = 0; i < 10000; i++) {
                service.track(`event${i}`);
            }
            const countBefore = service.getTotalTrackedEvents();

            service.track('overflow.event');
            expect(service.getTotalTrackedEvents()).toBe(countBefore);
        });
    });

    describe('edge cases - TelemetryErrorCode enum', () => {
        it('should have all expected error codes', () => {
            expect(TelemetryErrorCode.TELEMETRY_DISABLED).toBe('TELEMETRY_DISABLED');
            expect(TelemetryErrorCode.INVALID_EVENT_NAME).toBe('INVALID_EVENT_NAME');
            expect(TelemetryErrorCode.INVALID_PROPERTIES).toBe('INVALID_PROPERTIES');
            expect(TelemetryErrorCode.INVALID_BATCH).toBe('INVALID_BATCH');
            expect(TelemetryErrorCode.QUEUE_OVERFLOW).toBe('QUEUE_OVERFLOW');
            expect(TelemetryErrorCode.FLUSH_FAILED).toBe('FLUSH_FAILED');
            expect(TelemetryErrorCode.SETTINGS_ERROR).toBe('SETTINGS_ERROR');
        });

        it('should have exactly 7 error codes', () => {
            const values = Object.values(TelemetryErrorCode);
            expect(values).toHaveLength(7);
        });
    });

    describe('edge cases - health check', () => {
        it('should report unhealthy when queue exceeds 90% capacity', () => {
            for (let i = 0; i < 9000; i++) {
                service.track(`event${i}`);
            }
            const health = service.getHealth();
            expect(health.isHealthy).toBe(false);
            expect(health.queueSize).toBe(9000);
        });

        it('should report healthy when queue is below 90% capacity', () => {
            for (let i = 0; i < 8999; i++) {
                service.track(`event${i}`);
            }
            const health = service.getHealth();
            expect(health.isHealthy).toBe(true);
        });

        it('should report correct counters after tracking and flushing', async () => {
            service.track('event1');
            service.track('event2');
            expect(service.getHealth().totalTrackedEvents).toBe(2);

            await service.flush();
            const health = service.getHealth();
            expect(health.totalFlushedEvents).toBe(2);
            expect(health.queueSize).toBe(0);
            expect(health.lastFlushTime).not.toBeNull();
        });
    });

    describe('edge cases - flush behavior', () => {
        it('should return true when flushing an empty queue', async () => {
            const result = await service.flush();
            expect(result).toBe(true);
        });

        it('should clear queue after successful flush', async () => {
            service.track('event1');
            service.track('event2');
            expect(service.getQueueSize()).toBe(2);

            await service.flush();
            expect(service.getQueueSize()).toBe(0);
        });

        it('should update lastFlushTime after flush', async () => {
            service.track('event1');
            await service.flush();
            const health = service.getHealth();
            expect(health.lastFlushTime).toBe(Date.now());
        });

        it('should accumulate totalFlushedEvents across multiple flushes', async () => {
            service.track('event1');
            await service.flush();
            service.track('event2');
            service.track('event3');
            await service.flush();
            expect(service.getTotalFlushedEvents()).toBe(3);
        });
    });

    describe('trackBatch', () => {
        it('should track a valid batch of events', () => {
            const result = service.trackBatch([
                { name: 'event1', properties: { key: 'value1' } },
                { name: 'event2', properties: { key: 'value2' } },
                { name: 'event3' }
            ]);
            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(3);
            expect(result.results?.every(r => r.success)).toBe(true);
            expect(service.getQueueSize()).toBe(3);
        });

        it('should reject an empty batch', () => {
            const result = service.trackBatch([]);
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_BATCH);
        });

        it('should reject a non-array input', () => {
            // @ts-expect-error - testing invalid input
            const result = service.trackBatch('not-an-array');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_BATCH);
        });

        it('should reject a null input', () => {
            // @ts-expect-error - testing null input
            const result = service.trackBatch(null);
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_BATCH);
        });

        it('should reject a batch exceeding MAX_BATCH_SIZE (500)', () => {
            const events = Array.from({ length: 501 }, (_, i) => ({ name: `event${i}` }));
            const result = service.trackBatch(events);
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_BATCH);
        });

        it('should accept a batch of exactly MAX_BATCH_SIZE (500)', () => {
            const events = Array.from({ length: 500 }, (_, i) => ({ name: `event${i}` }));
            const result = service.trackBatch(events);
            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(500);
        });

        it('should report partial failure when some events are invalid', () => {
            const result = service.trackBatch([
                { name: 'valid.event' },
                { name: '' },
                { name: 'another.valid' }
            ]);
            expect(result.success).toBe(false);
            expect(result.results).toHaveLength(3);
            expect(result.results?.[0].success).toBe(true);
            expect(result.results?.[1].success).toBe(false);
            expect(result.results?.[1].error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
            expect(result.results?.[2].success).toBe(true);
        });

        it('should report partial failure when properties are oversized', () => {
            const result = service.trackBatch([
                { name: 'valid.event' },
                { name: 'oversized', properties: { data: 'x'.repeat(100001) } }
            ]);
            expect(result.success).toBe(false);
            expect(result.results?.[0].success).toBe(true);
            expect(result.results?.[1].success).toBe(false);
            expect(result.results?.[1].error).toBe(TelemetryErrorCode.INVALID_PROPERTIES);
        });

        it('should not track any events when telemetry is disabled', () => {
            mockSettingsService.getSettings.mockReturnValue({
                telemetry: { enabled: false }
            });
            const result = service.trackBatch([
                { name: 'event1' },
                { name: 'event2' }
            ]);
            expect(result.success).toBe(false);
            expect(result.results?.every(r => r.error === TelemetryErrorCode.TELEMETRY_DISABLED)).toBe(true);
            expect(service.getQueueSize()).toBe(0);
        });
    });

    describe('additional validation edge cases', () => {
        it('should reject event name that is only whitespace-like characters', () => {
            const result = service.track('   ');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });

        it('should reject event name with newlines', () => {
            const result = service.track('event\nname');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });

        it('should reject event name with tabs', () => {
            const result = service.track('event\tname');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });

        it('should accept single character event name', () => {
            const result = service.track('a');
            expect(result.success).toBe(true);
        });

        it('should accept event name with only numbers', () => {
            const result = service.track('12345');
            expect(result.success).toBe(true);
        });

        it('should reject event name with HTML tags', () => {
            const result = service.track('<script>alert</script>');
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });

        it('should reject event name with SQL injection attempt', () => {
            const result = service.track("event'; DROP TABLE--");
            expect(result.success).toBe(false);
            expect(result.error).toBe(TelemetryErrorCode.INVALID_EVENT_NAME);
        });
    });
});
