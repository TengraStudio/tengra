import {
    __resetResponsiveAnalyticsForTests,
    getResponsiveAnalyticsSnapshot,
    trackResponsiveBreakpoint,
} from '@renderer/store/responsive-analytics.store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('responsive analytics store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-13T00:00:00.000Z'));
        __resetResponsiveAnalyticsForTests();
    });

    afterEach(() => {
        __resetResponsiveAnalyticsForTests();
        vi.useRealTimers();
    });

    it('tracks counters and transitions when breakpoints change', () => {
        trackResponsiveBreakpoint({ breakpoint: 'mobile', width: 500, height: 900 });
        trackResponsiveBreakpoint({ breakpoint: 'mobile', width: 520, height: 900 });
        trackResponsiveBreakpoint({ breakpoint: 'desktop', width: 1200, height: 900 });

        const snapshot = getResponsiveAnalyticsSnapshot();
        expect(snapshot.current).toBe('desktop');
        expect(snapshot.viewport).toEqual({ width: 1200, height: 900 });
        expect(snapshot.counters.mobile).toBe(2);
        expect(snapshot.counters.desktop).toBe(1);
        expect(snapshot.transitions).toHaveLength(2);
        expect(snapshot.transitions[0]).toMatchObject({
            from: 'mobile',
            to: 'desktop',
            width: 1200,
        });
    });
});
