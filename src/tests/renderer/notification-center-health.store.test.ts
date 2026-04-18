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
    __resetNotificationCenterForTests,
    pushNotification,
    scheduleNotification,
} from '@renderer/store/notification-center.store';
import { getNotificationCenterHealthSnapshot } from '@renderer/store/notification-center-health.store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('notification center health store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __resetNotificationCenterForTests();
    });

    afterEach(() => {
        __resetNotificationCenterForTests();
        vi.useRealTimers();
    });

    it('reports empty state when there are no notifications', () => {
        expect(getNotificationCenterHealthSnapshot().uiState).toBe('empty');
    });

    it('reports delivery and scheduling counters', () => {
        pushNotification({ type: 'info', message: 'hello' });
        scheduleNotification({ type: 'success', message: 'later' }, Date.now() + 1000);

        const snapshot = getNotificationCenterHealthSnapshot();
        expect(snapshot.uiState).toBe('ready');
        expect(snapshot.deliveredTotal).toBe(1);
        expect(snapshot.pendingScheduledCount).toBe(1);
    });
});
