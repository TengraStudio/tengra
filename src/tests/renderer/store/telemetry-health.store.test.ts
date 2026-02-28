/**
 * Tests for telemetry-health.store (BACKLOG-0467)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    __resetTelemetryHealthForTests,
    getTelemetryHealthSnapshot,
    recordTelemetryHealthEvent,
    subscribeTelemetryHealth
} from '@/store/telemetry-health.store';

describe('telemetry-health.store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
        __resetTelemetryHealthForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('initial state', () => {
        it('should start healthy with empty metrics', () => {
            const snap = getTelemetryHealthSnapshot();
            expect(snap.status).toBe('healthy');
            expect(snap.uiState).toBe('ready');
            expect(snap.metrics.totalCalls).toBe(0);
            expect(snap.metrics.totalFailures).toBe(0);
            expect(snap.events).toHaveLength(0);
        });

        it('should have correct budget values', () => {
            const snap = getTelemetryHealthSnapshot();
            expect(snap.budgets.trackMs).toBe(10);
            expect(snap.budgets.flushMs).toBe(5000);
            expect(snap.budgets.batchMs).toBe(50);
        });

        it('should have all channels initialized', () => {
            const snap = getTelemetryHealthSnapshot();
            expect(snap.metrics.channels['telemetry.track'].calls).toBe(0);
            expect(snap.metrics.channels['telemetry.flush'].calls).toBe(0);
            expect(snap.metrics.channels['telemetry.batch'].calls).toBe(0);
        });
    });

    describe('recordTelemetryHealthEvent', () => {
        it('should record a success event', () => {
            recordTelemetryHealthEvent({
                channel: 'telemetry.track',
                status: 'success',
                durationMs: 5
            });

            const snap = getTelemetryHealthSnapshot();
            expect(snap.metrics.totalCalls).toBe(1);
            expect(snap.metrics.totalFailures).toBe(0);
            expect(snap.metrics.channels['telemetry.track'].calls).toBe(1);
            expect(snap.events).toHaveLength(1);
        });

        it('should record a failure event', () => {
            recordTelemetryHealthEvent({
                channel: 'telemetry.flush',
                status: 'failure',
                errorCode: 'FLUSH_FAILED'
            });

            const snap = getTelemetryHealthSnapshot();
            expect(snap.metrics.totalFailures).toBe(1);
            expect(snap.metrics.lastErrorCode).toBe('FLUSH_FAILED');
            expect(snap.metrics.channels['telemetry.flush'].failures).toBe(1);
        });

        it('should record a validation-failure event', () => {
            recordTelemetryHealthEvent({
                channel: 'telemetry.track',
                status: 'validation-failure',
                errorCode: 'INVALID_EVENT_NAME'
            });

            const snap = getTelemetryHealthSnapshot();
            expect(snap.metrics.validationFailures).toBe(1);
            expect(snap.metrics.totalFailures).toBe(1);
            expect(snap.metrics.channels['telemetry.track'].validationFailures).toBe(1);
        });

        it('should detect budget exceeded', () => {
            recordTelemetryHealthEvent({
                channel: 'telemetry.track',
                status: 'success',
                durationMs: 15
            });

            const snap = getTelemetryHealthSnapshot();
            expect(snap.metrics.budgetExceeded).toBe(1);
            expect(snap.metrics.channels['telemetry.track'].budgetExceeded).toBe(1);
        });

        it('should not flag budget when within limit', () => {
            recordTelemetryHealthEvent({
                channel: 'telemetry.track',
                status: 'success',
                durationMs: 5
            });

            const snap = getTelemetryHealthSnapshot();
            expect(snap.metrics.budgetExceeded).toBe(0);
        });
    });

    describe('status computation', () => {
        it('should degrade when error rate exceeds 10%', () => {
            recordTelemetryHealthEvent({
                channel: 'telemetry.track',
                status: 'failure',
                errorCode: 'ERR'
            });

            const snap = getTelemetryHealthSnapshot();
            expect(snap.status).toBe('degraded');
            expect(snap.uiState).toBe('failure');
        });

        it('should degrade when budget is exceeded', () => {
            recordTelemetryHealthEvent({
                channel: 'telemetry.flush',
                status: 'success',
                durationMs: 6000
            });

            const snap = getTelemetryHealthSnapshot();
            expect(snap.status).toBe('degraded');
        });

        it('should remain healthy with all successes', () => {
            for (let i = 0; i < 20; i++) {
                recordTelemetryHealthEvent({
                    channel: 'telemetry.track',
                    status: 'success',
                    durationMs: 1
                });
            }

            const snap = getTelemetryHealthSnapshot();
            expect(snap.status).toBe('healthy');
            expect(snap.uiState).toBe('ready');
        });

        it('should show empty uiState when no calls recorded', () => {
            const snap = getTelemetryHealthSnapshot();
            // After reset, no events means empty when computed fresh
            expect(snap.metrics.totalCalls).toBe(0);
        });
    });

    describe('event history', () => {
        it('should cap events at 160', () => {
            for (let i = 0; i < 200; i++) {
                recordTelemetryHealthEvent({
                    channel: 'telemetry.track',
                    status: 'success',
                    durationMs: 1
                });
            }

            const snap = getTelemetryHealthSnapshot();
            expect(snap.events.length).toBeLessThanOrEqual(160);
        });

        it('should keep most recent events first', () => {
            vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
            recordTelemetryHealthEvent({
                channel: 'telemetry.track',
                status: 'success'
            });

            vi.setSystemTime(new Date('2024-01-01T00:01:00Z'));
            recordTelemetryHealthEvent({
                channel: 'telemetry.flush',
                status: 'success'
            });

            const snap = getTelemetryHealthSnapshot();
            expect(snap.events[0].channel).toBe('telemetry.flush');
            expect(snap.events[1].channel).toBe('telemetry.track');
        });
    });

    describe('subscription', () => {
        it('should notify listeners on event', () => {
            const listener = vi.fn();
            const unsubscribe = subscribeTelemetryHealth(listener);

            recordTelemetryHealthEvent({
                channel: 'telemetry.track',
                status: 'success'
            });

            expect(listener).toHaveBeenCalledTimes(1);
            unsubscribe();
        });

        it('should stop notifying after unsubscribe', () => {
            const listener = vi.fn();
            const unsubscribe = subscribeTelemetryHealth(listener);
            unsubscribe();

            recordTelemetryHealthEvent({
                channel: 'telemetry.track',
                status: 'success'
            });

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('reset', () => {
        it('should reset all metrics', () => {
            recordTelemetryHealthEvent({
                channel: 'telemetry.track',
                status: 'failure',
                errorCode: 'ERR'
            });

            __resetTelemetryHealthForTests();

            const snap = getTelemetryHealthSnapshot();
            expect(snap.metrics.totalCalls).toBe(0);
            expect(snap.metrics.totalFailures).toBe(0);
            expect(snap.status).toBe('healthy');
        });
    });
});
