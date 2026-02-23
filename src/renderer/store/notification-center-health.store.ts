import {
    getNotificationCenterSnapshot,
    subscribeNotificationCenter,
    useNotificationCenterStore,
} from '@renderer/store/notification-center.store';

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
