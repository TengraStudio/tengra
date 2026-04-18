/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    __resetTooltipAnalyticsForTests,
    getTooltipAnalyticsSnapshot,
    trackTooltipHidden,
    trackTooltipShown,
} from '@renderer/store/tooltip-analytics.store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('tooltip analytics store', () => {
    let setItemSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-13T00:00:00.000Z'));
        setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
        __resetTooltipAnalyticsForTests();
    });

    afterEach(() => {
        __resetTooltipAnalyticsForTests();
        setItemSpy.mockRestore();
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
        expect(setItemSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(120);
        expect(setItemSpy).toHaveBeenCalled();
    });

    it('ignores empty tooltip ids', () => {
        trackTooltipShown('  ', 'top');
        expect(getTooltipAnalyticsSnapshot().totals.shown).toBe(0);
    });
});
