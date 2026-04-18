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
 * Tests for TelemetryService meta-telemetry counters (BACKLOG-0465)
 */
import {
    type MetaTelemetrySnapshot,
    TelemetryService
} from '@main/services/analysis/telemetry.service';
import { SettingsService } from '@main/services/system/settings.service';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('uuid', () => ({
    v4: vi.fn().mockReturnValue('meta-test-uuid')
}));

interface MockSettingsService {
    getSettings: MockInstance;
}

describe('TelemetryService Meta-Telemetry', () => {
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

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getMetaTelemetry', () => {
        it('should return zeroed snapshot on fresh service', () => {
            const meta: MetaTelemetrySnapshot = service.getMetaTelemetry();
            expect(meta.flushAttempts).toBe(0);
            expect(meta.flushFailures).toBe(0);
            expect(meta.budgetExceeded).toBe(0);
            expect(meta.overflowDrops).toBe(0);
            expect(meta.validationRejects).toBe(0);
            expect(meta.lastOperationAt).toBeNull();
        });

        it('should increment validationRejects on invalid event name', () => {
            service.track('invalid name!');
            service.track('');
            const meta = service.getMetaTelemetry();
            expect(meta.validationRejects).toBe(2);
        });

        it('should increment validationRejects on invalid properties', () => {
            const circular: Record<string, TestValue> = { a: 1 };
            circular['self'] = circular;
            service.track('valid.event', circular);
            expect(service.getMetaTelemetry().validationRejects).toBe(1);
        });

        it('should increment overflowDrops when queue is full', () => {
            for (let i = 0; i < 10000; i++) {
                service.track(`event${i}`);
            }
            service.track('overflow.event');
            service.track('overflow.event2');
            expect(service.getMetaTelemetry().overflowDrops).toBe(2);
        });

        it('should update lastOperationAt on successful track', () => {
            service.track('valid.event');
            const meta = service.getMetaTelemetry();
            expect(meta.lastOperationAt).toBe(Date.now());
        });

        it('should increment flushAttempts on flush', async () => {
            service.track('event1');
            await service.flush();
            expect(service.getMetaTelemetry().flushAttempts).toBe(1);
        });

        it('should not increment flushAttempts for empty queue', async () => {
            await service.flush();
            expect(service.getMetaTelemetry().flushAttempts).toBe(0);
        });

        it('should update lastOperationAt on successful flush', async () => {
            service.track('event1');
            await service.flush();
            expect(service.getMetaTelemetry().lastOperationAt).toBe(Date.now());
        });

        it('should track budgetExceeded via performance mock', () => {
            let callCount = 0;
            vi.spyOn(performance, 'now').mockImplementation(() => {
                callCount++;
                return callCount === 1 ? 0 : 50;
            });

            service.track('slow.event');
            expect(service.getMetaTelemetry().budgetExceeded).toBe(1);
        });

        it('should not count disabled telemetry as validation reject', () => {
            mockSettingsService.getSettings.mockReturnValue({
                telemetry: { enabled: false }
            });
            service.track('event');
            expect(service.getMetaTelemetry().validationRejects).toBe(0);
        });

        it('should accumulate across multiple operations', async () => {
            service.track('valid1');
            service.track('valid2');
            service.track('invalid name!');
            await service.flush();

            const meta = service.getMetaTelemetry();
            expect(meta.validationRejects).toBe(1);
            expect(meta.flushAttempts).toBe(1);
            expect(meta.lastOperationAt).not.toBeNull();
        });
    });

    describe('meta-telemetry snapshot shape', () => {
        it('should return all expected fields', () => {
            const meta = service.getMetaTelemetry();
            const keys = Object.keys(meta).sort();
            expect(keys).toEqual([
                'budgetExceeded',
                'flushAttempts',
                'flushFailures',
                'lastOperationAt',
                'overflowDrops',
                'validationRejects'
            ]);
        });
    });
});
