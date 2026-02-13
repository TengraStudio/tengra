import {
    __resetLoadingAnalyticsForTests,
    beginLoadingOperation,
    completeLoadingOperation,
    getLoadingAnalyticsSnapshot,
    updateLoadingOperationProgress,
} from '@renderer/store/loading-analytics.store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('loading analytics store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-13T00:00:00.000Z'));
        __resetLoadingAnalyticsForTests();
    });

    afterEach(() => {
        __resetLoadingAnalyticsForTests();
        vi.useRealTimers();
    });

    it('tracks running operation progress and completion', () => {
        beginLoadingOperation({
            id: 'operation-1',
            context: 'tests',
            estimatedMs: 5000,
        });
        updateLoadingOperationProgress('operation-1', 47.8);
        vi.advanceTimersByTime(1200);
        completeLoadingOperation('operation-1', 'completed');

        const snapshot = getLoadingAnalyticsSnapshot();
        expect(snapshot.active).toEqual({});
        expect(snapshot.history).toHaveLength(1);
        expect(snapshot.history[0]?.status).toBe('completed');
        expect(snapshot.history[0]?.progress).toBe(100);
        expect(snapshot.stats.started).toBe(1);
        expect(snapshot.stats.completed).toBe(1);
        expect(snapshot.stats.avgDurationMs).toBe(1200);
    });

    it('tracks cancelled operations separately', () => {
        beginLoadingOperation({
            id: 'operation-2',
            context: 'tests',
            progress: 25,
        });
        vi.advanceTimersByTime(600);
        completeLoadingOperation('operation-2', 'cancelled');

        const snapshot = getLoadingAnalyticsSnapshot();
        expect(snapshot.stats.started).toBe(1);
        expect(snapshot.stats.completed).toBe(0);
        expect(snapshot.stats.cancelled).toBe(1);
        expect(snapshot.history[0]?.status).toBe('cancelled');
        expect(snapshot.history[0]?.progress).toBe(25);
    });
});
