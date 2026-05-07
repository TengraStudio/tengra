/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    __resetLoadingAnalyticsForTests,
    beginLoadingOperation,
    completeLoadingOperation,
    getLoadingAnalyticsSnapshot,
    updateLoadingOperationProgress,
} from '@/store/loading-analytics.store';

describe('loading analytics store', () => {
    let setItemSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-13T00:00:00.000Z'));
        setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
        __resetLoadingAnalyticsForTests();
    });

    afterEach(() => {
        __resetLoadingAnalyticsForTests();
        setItemSpy.mockRestore();
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
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(120);
        expect(setItemSpy).toHaveBeenCalledTimes(2);
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

