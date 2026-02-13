import {
    __resetAnimationAnalyticsForTests,
    getAnimationAnalyticsSnapshot,
    setAnimationDebugEnabled,
    trackAnimationEvent,
} from '@renderer/store/animation-analytics.store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('animation analytics store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-13T00:00:00.000Z'));
        __resetAnimationAnalyticsForTests();
    });

    afterEach(() => {
        __resetAnimationAnalyticsForTests();
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
        expect(getAnimationAnalyticsSnapshot().debugEnabled).toBe(true);
    });
});
