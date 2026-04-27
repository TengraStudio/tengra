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
    getNotificationCenterSnapshot,
    subscribeNotificationCenter,
    useNotificationCenterStore,
} from '@/store/notification-center.store';

const NOTIFICATION_CENTER_DELIVERY_BUDGET_MS = 200;

export interface NotificationCenterHealthSnapshot {
    uiState: 'ready' | 'empty' | 'failure';
    budgetMs: number;
    deliveredTotal: number;
    dismissedTotal: number;
    suppressedTotal: number;
    actionClicksTotal: number;
    pendingScheduledCount: number;
}

export function getNotificationCenterHealthSnapshot(): NotificationCenterHealthSnapshot {
    const snapshot = getNotificationCenterSnapshot();
    const uiState = snapshot.history.length === 0 ? 'empty' : 'ready';
    return {
        uiState,
        budgetMs: NOTIFICATION_CENTER_DELIVERY_BUDGET_MS,
        deliveredTotal: snapshot.analytics.deliveredTotal,
        dismissedTotal: snapshot.analytics.dismissedTotal,
        suppressedTotal: snapshot.analytics.suppressedTotal,
        actionClicksTotal: snapshot.analytics.actionClicksTotal,
        pendingScheduledCount: snapshot.scheduled.length,
    };
}

export function subscribeNotificationCenterHealth(listener: () => void): () => void {
    return subscribeNotificationCenter(listener);
}

export function useNotificationCenterHealth<T>(
    selector: (snapshot: NotificationCenterHealthSnapshot) => T
): T {
    return useNotificationCenterStore(() => selector(getNotificationCenterHealthSnapshot()));
}
