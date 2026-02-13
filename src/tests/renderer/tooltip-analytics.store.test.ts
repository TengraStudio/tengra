import {
    __resetTooltipAnalyticsForTests,
    getTooltipAnalyticsSnapshot,
    trackTooltipHidden,
    trackTooltipShown,
} from '@renderer/store/tooltip-analytics.store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('tooltip analytics store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-13T00:00:00.000Z'));
        __resetTooltipAnalyticsForTests();
    });

    afterEach(() => {
        __resetTooltipAnalyticsForTests();
        vi.useRealTimers();
    });

    it('tracks tooltip show/hide events and per-tooltip counters', () => {
        trackTooltipShown('chat-send', 'top');
        trackTooltipHidden('chat-send', 'top');

        const snapshot = getTooltipAnalyticsSnapshot();
        expect(snapshot.totals.shown).toBe(1);
        expect(snapshot.totals.hidden).toBe(1);
        expect(snapshot.byId['chat-send']).toBe(2);
        expect(snapshot.recent[0]).toMatchObject({
            id: 'chat-send',
            action: 'hide',
            side: 'top',
        });
    });

    it('ignores empty tooltip ids', () => {
        trackTooltipShown('  ', 'top');
        expect(getTooltipAnalyticsSnapshot().totals.shown).toBe(0);
    });
});
