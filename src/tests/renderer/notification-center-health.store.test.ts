import { getNotificationCenterHealthSnapshot } from '@renderer/store/notification-center-health.store';
import {
    __resetNotificationCenterForTests,
    pushNotification,
    scheduleNotification,
} from '@renderer/store/notification-center.store';
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
