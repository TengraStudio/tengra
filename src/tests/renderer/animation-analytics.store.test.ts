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
    __resetAnimationAnalyticsForTests,
    getAnimationAnalyticsSnapshot,
    setAnimationDebugEnabled,
    trackAnimationEvent,
} from '@/store/animation-analytics.store';

describe('animation analytics store', () => {
    let setItemSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-13T00:00:00.000Z'));
        setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
        __resetAnimationAnalyticsForTests();
    });

    afterEach(() => {
        __resetAnimationAnalyticsForTests();
        setItemSpy.mockRestore();
        vi.useRealTimers();
    });

    it('tracks animation events by preset and reduced-motion mode', () => {
        trackAnimationEvent({
            name: 'view-transition:chat',
            preset: 'page',
            durationMs: 240,
            reducedMotion: true,
        });

        const snapshot = getAnimationAnalyticsSnapshot();
        expect(snapshot.totals.played).toBe(1);
        expect(snapshot.totals.reducedMotionPlays).toBe(1);
        expect(snapshot.byPreset.page).toBe(1);
        expect(snapshot.recent[0]).toMatchObject({
            name: 'view-transition:chat',
            preset: 'page',
            durationMs: 240,
        });
    });

    it('stores animation debug preference', () => {
        setAnimationDebugEnabled(true);
        expect(setItemSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(120);
        expect(setItemSpy).toHaveBeenCalled();
        expect(getAnimationAnalyticsSnapshot().debugEnabled).toBe(true);
    });
});

