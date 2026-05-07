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
    __resetNotificationCenterForTests,
    getNotificationCenterSnapshot,
    pushNotification,
    runNotificationAction,
    scheduleNotification,
    setNotificationPreferences,
} from '@/store/notification-center.store';

describe('notification center store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-13T00:00:00.000Z'));
        __resetNotificationCenterForTests();
    });

    afterEach(() => {
        __resetNotificationCenterForTests();
        vi.useRealTimers();
    });

    it('pushes notifications to active + history and tracks analytics', () => {
        const id = pushNotification({
            type: 'success',
            message: 'Build completed',
            source: 'tests',
        });

        expect(typeof id).toBe('string');

        const snapshot = getNotificationCenterSnapshot();
        expect(snapshot.active).toHaveLength(1);
        expect(snapshot.history).toHaveLength(1);
        expect(snapshot.analytics.deliveredTotal).toBe(1);
        expect(snapshot.analytics.deliveredByType.success).toBe(1);
    });

    it('suppresses disabled notification types', () => {
        setNotificationPreferences({ info: false });
        const id = pushNotification({
            type: 'info',
            message: 'Muted info',
        });

        expect(id).toBeNull();
        const snapshot = getNotificationCenterSnapshot();
        expect(snapshot.active).toHaveLength(0);
        expect(snapshot.analytics.suppressedTotal).toBe(1);
    });

    it('executes notification actions and dismisses by default', () => {
        const onAction = vi.fn();
        const id = pushNotification({
            type: 'warning',
            message: 'Quota almost exhausted',
            actions: [
                {
                    id: 'open-quota',
                    label: 'Open Quota',
                    onAction,
                },
            ],
        });

        expect(id).toBeTruthy();
        runNotificationAction(id!, 'open-quota');

        const snapshot = getNotificationCenterSnapshot();
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(snapshot.active).toHaveLength(0);
        expect(snapshot.analytics.actionClicksTotal).toBe(1);
    });

    it('schedules notifications for future delivery', () => {
        const deliverAt = Date.now() + 30_000;
        const scheduleId = scheduleNotification(
            {
                type: 'info',
                message: 'Follow-up reminder',
            },
            deliverAt
        );

        expect(scheduleId).toBeTruthy();
        expect(getNotificationCenterSnapshot().scheduled).toHaveLength(1);
        expect(getNotificationCenterSnapshot().active).toHaveLength(0);

        vi.advanceTimersByTime(30_001);

        const snapshot = getNotificationCenterSnapshot();
        expect(snapshot.scheduled).toHaveLength(0);
        expect(snapshot.active).toHaveLength(1);
        expect(snapshot.analytics.deliveredFromScheduleTotal).toBe(1);
    });

    it('enforces active toast queue limits while retaining history', () => {
        for (let index = 0; index < 12; index += 1) {
            pushNotification({
                type: 'info',
                message: `Notification ${index + 1}`,
                source: 'tests',
                durationMs: null,
            });
        }

        const snapshot = getNotificationCenterSnapshot();
        expect(snapshot.active).toHaveLength(8);
        expect(snapshot.history).toHaveLength(12);
        expect(snapshot.active[0]?.message).toBe('Notification 12');
        expect(snapshot.active[7]?.message).toBe('Notification 5');
    });
});

