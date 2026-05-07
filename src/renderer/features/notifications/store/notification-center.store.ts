/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { normalizeWorkspaceCompatSource } from '@shared/constants';
import { useSyncExternalStore } from 'react';

import type { Toast } from '@/types';

const NOTIFICATION_CENTER_STORAGE_KEY = 'tengra.notification-center.v1';
const NOTIFICATION_CENTER_VERSION = 1;
const NOTIFICATIONS_ENABLED = false;
const DEFAULT_NOTIFICATION_DURATION_MS = 5000;
const MAX_ACTIVE_NOTIFICATIONS = 8;
const MAX_NOTIFICATION_HISTORY = 240;
const SCHEDULED_NOTIFICATION_MAX_DELAY_MS = 2_147_483_647;

export type NotificationType = Toast['type'];

export type NotificationActionTone = 'default' | 'primary' | 'destructive';

export type NotificationAction = {
    id: string;
    label: string;
    tone?: NotificationActionTone;
    autoClose?: boolean;
    onAction?: () => void;
};

export type PersistedNotificationAction = Omit<NotificationAction, 'onAction'>;

export type NotificationRecord = {
    id: string;
    type: NotificationType;
    message: string;
    title?: string;
    source?: string;
    createdAt: number;
    readAt?: number;
    dismissedAt?: number;
    actions: PersistedNotificationAction[];
};

export type NotificationInput = {
    id?: string;
    type: NotificationType;
    message: string;
    title?: string;
    source?: string;
    actions?: NotificationAction[];
    durationMs?: number | null;
};

type ScheduledNotification = {
    id: string;
    deliverAt: number;
    payload: Omit<NotificationInput, 'durationMs' | 'actions'> & {
        actions: PersistedNotificationAction[];
        durationMs: number | null;
    };
};

type NotificationPreferences = Record<NotificationType, boolean>;

type NotificationAnalytics = {
    deliveredTotal: number;
    deliveredByType: Record<NotificationType, number>;
    suppressedTotal: number;
    dismissedTotal: number;
    actionClicksTotal: number;
    scheduledTotal: number;
    deliveredFromScheduleTotal: number;
    lastDeliveredAt?: number;
};

export type NotificationCenterSnapshot = {
    version: number;
    active: NotificationRecord[];
    history: NotificationRecord[];
    preferences: NotificationPreferences;
    analytics: NotificationAnalytics;
    scheduled: ScheduledNotification[];
};

type Listener = () => void;

const listeners = new Set<Listener>();
const actionHandlers = new Map<string, () => void>();
const dismissTimers = new Map<string, number>();
const scheduledTimers = new Map<string, number>();

const defaultPreferences: NotificationPreferences = {
    info: true,
    success: true,
    warning: true,
    error: true,
};

const defaultAnalytics: NotificationAnalytics = {
    deliveredTotal: 0,
    deliveredByType: {
        info: 0,
        success: 0,
        warning: 0,
        error: 0,
    },
    suppressedTotal: 0,
    dismissedTotal: 0,
    actionClicksTotal: 0,
    scheduledTotal: 0,
    deliveredFromScheduleTotal: 0,
};

const defaultSnapshot: NotificationCenterSnapshot = {
    version: NOTIFICATION_CENTER_VERSION,
    active: [],
    history: [],
    preferences: defaultPreferences,
    analytics: defaultAnalytics,
    scheduled: [],
};

let snapshot: NotificationCenterSnapshot = defaultSnapshot;

function nowMs(): number {
    return Date.now();
}

function createNotificationId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createActionKey(notificationId: string, actionId: string): string {
    return `${notificationId}:${actionId}`;
}

function normalizeNotificationSource(source?: string): string | undefined {
    const trimmedSource = source?.trim();
    if (!trimmedSource) {
        return undefined;
    }
    return normalizeWorkspaceCompatSource(trimmedSource) ?? trimmedSource;
}

function isObject(value: RendererDataValue): value is Record<string, RendererDataValue> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeType(value: RendererDataValue): NotificationType {
    if (value === 'success' || value === 'error' || value === 'warning') {
        return value;
    }
    return 'info';
}

function normalizeAction(value: RendererDataValue): PersistedNotificationAction | null {
    if (!isObject(value)) {
        return null;
    }
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    if (!id || !label) {
        return null;
    }
    const toneRaw = value.tone;
    const tone: NotificationActionTone =
        toneRaw === 'primary' || toneRaw === 'destructive' ? toneRaw : 'default';
    const autoClose = value.autoClose !== false;
    return { id, label, tone, autoClose };
}

function normalizeRecord(value: RendererDataValue): NotificationRecord | null {
    if (!isObject(value)) {
        return null;
    }
    const message = typeof value.message === 'string' ? value.message.trim() : '';
    if (!message) {
        return null;
    }
    const idRaw = typeof value.id === 'string' ? value.id.trim() : '';
    const id = idRaw || createNotificationId('note');
    const createdAt =
        typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
            ? value.createdAt
            : nowMs();
    const readAt =
        typeof value.readAt === 'number' && Number.isFinite(value.readAt) ? value.readAt : undefined;
    const dismissedAt =
        typeof value.dismissedAt === 'number' && Number.isFinite(value.dismissedAt)
            ? value.dismissedAt
            : undefined;
    const title = typeof value.title === 'string' ? value.title.trim() || undefined : undefined;
    const source = typeof value.source === 'string'
        ? normalizeNotificationSource(value.source)
        : undefined;

    const actionsRaw = Array.isArray(value.actions) ? value.actions : [];
    const actions = actionsRaw
        .map(action => normalizeAction(action))
        .filter((action): action is PersistedNotificationAction => !!action);

    return {
        id,
        type: normalizeType(value.type),
        message,
        title,
        source,
        createdAt,
        readAt,
        dismissedAt,
        actions,
    };
}

function normalizePreferences(value: RendererDataValue): NotificationPreferences {
    if (!isObject(value)) {
        return defaultPreferences;
    }
    return {
        info: value.info !== false,
        success: value.success !== false,
        warning: value.warning !== false,
        error: value.error !== false,
    };
}

function normalizeAnalytics(value: RendererDataValue): NotificationAnalytics {
    if (!isObject(value)) {
        return defaultAnalytics;
    }
    const deliveredByTypeRaw = isObject(value.deliveredByType) ? value.deliveredByType : {};
    const deliveredByType: Record<NotificationType, number> = {
        info: toCount(deliveredByTypeRaw.info),
        success: toCount(deliveredByTypeRaw.success),
        warning: toCount(deliveredByTypeRaw.warning),
        error: toCount(deliveredByTypeRaw.error),
    };
    return {
        deliveredTotal: toCount(value.deliveredTotal),
        deliveredByType,
        suppressedTotal: toCount(value.suppressedTotal),
        dismissedTotal: toCount(value.dismissedTotal),
        actionClicksTotal: toCount(value.actionClicksTotal),
        scheduledTotal: toCount(value.scheduledTotal),
        deliveredFromScheduleTotal: toCount(value.deliveredFromScheduleTotal),
        lastDeliveredAt:
            typeof value.lastDeliveredAt === 'number' && Number.isFinite(value.lastDeliveredAt)
                ? value.lastDeliveredAt
                : undefined,
    };
}

function toCount(value: RendererDataValue): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}

function normalizeDurationMs(value: RendererDataValue): number | null {
    if (value === null) {
        return null;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return DEFAULT_NOTIFICATION_DURATION_MS;
    }
    if (value <= 0) {
        return null;
    }
    return Math.floor(value);
}

function normalizeScheduled(value: RendererDataValue): ScheduledNotification | null {
    if (!isObject(value)) {
        return null;
    }
    const idRaw = typeof value.id === 'string' ? value.id.trim() : '';
    const deliverAt =
        typeof value.deliverAt === 'number' && Number.isFinite(value.deliverAt)
            ? Math.floor(value.deliverAt)
            : NaN;
    if (!idRaw || !Number.isFinite(deliverAt)) {
        return null;
    }
    const payloadRaw = isObject(value.payload) ? value.payload : null;
    if (!payloadRaw) {
        return null;
    }
    const message =
        typeof payloadRaw.message === 'string' ? payloadRaw.message.trim() : '';
    if (!message) {
        return null;
    }
    const actionsRaw = Array.isArray(payloadRaw.actions) ? payloadRaw.actions : [];
    const actions = actionsRaw
        .map(action => normalizeAction(action))
        .filter((action): action is PersistedNotificationAction => !!action);

    return {
        id: idRaw,
        deliverAt,
        payload: {
            id: typeof payloadRaw.id === 'string' ? payloadRaw.id.trim() || undefined : undefined,
            type: normalizeType(payloadRaw.type),
            message,
            title:
                typeof payloadRaw.title === 'string' ? payloadRaw.title.trim() || undefined : undefined,
            source:
                typeof payloadRaw.source === 'string'
                    ? normalizeNotificationSource(payloadRaw.source)
                    : undefined,
            actions,
            durationMs: normalizeDurationMs(payloadRaw.durationMs),
        },
    };
}

function migrateLegacyToastArray(raw: RendererDataValue): NotificationCenterSnapshot | null {
    if (!Array.isArray(raw)) {
        return null;
    }
    const history = raw
        .map(item => normalizeRecord(item))
        .filter((item): item is NotificationRecord => !!item)
        .slice(0, MAX_NOTIFICATION_HISTORY);
    return {
        ...defaultSnapshot,
        history,
        active: [],
    };
}

export function sanitizeNotificationCenterSnapshot(raw: RendererDataValue): NotificationCenterSnapshot {
    const migratedArray = migrateLegacyToastArray(raw);
    if (migratedArray) {
        return migratedArray;
    }
    if (!isObject(raw)) {
        return defaultSnapshot;
    }

    const historyRaw = Array.isArray(raw.history) ? raw.history : [];
    const history = historyRaw
        .map(item => normalizeRecord(item))
        .filter((item): item is NotificationRecord => !!item)
        .slice(0, MAX_NOTIFICATION_HISTORY);

    const activeRaw = Array.isArray(raw.active) ? raw.active : [];
    const active = activeRaw
        .map(item => normalizeRecord(item))
        .filter((item): item is NotificationRecord => !!item)
        .slice(0, MAX_ACTIVE_NOTIFICATIONS);

    const scheduledRaw = Array.isArray(raw.scheduled) ? raw.scheduled : [];
    const scheduled = scheduledRaw
        .map(item => normalizeScheduled(item))
        .filter((item): item is ScheduledNotification => !!item)
        .slice(0, MAX_NOTIFICATION_HISTORY);

    return {
        version: NOTIFICATION_CENTER_VERSION,
        active,
        history,
        scheduled,
        preferences: normalizePreferences(raw.preferences),
        analytics: normalizeAnalytics(raw.analytics),
    };
}

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function persist(): void {
    try {
        const data: NotificationCenterSnapshot = {
            ...snapshot,
            version: NOTIFICATION_CENTER_VERSION,
        };
        window.localStorage.setItem(NOTIFICATION_CENTER_STORAGE_KEY, JSON.stringify(data));
    } catch {
        // Ignore persistence failures in restricted environments.
    }
}

function clearAllTimers(): void {
    dismissTimers.forEach(timer => window.clearTimeout(timer));
    dismissTimers.clear();
    scheduledTimers.forEach(timer => window.clearTimeout(timer));
    scheduledTimers.clear();
}

function clearActionHandlersForNotification(notificationId: string): void {
    for (const key of actionHandlers.keys()) {
        if (key.startsWith(`${notificationId}:`)) {
            actionHandlers.delete(key);
        }
    }
}

function armDismissTimer(notificationId: string, durationMs: number | null): void {
    const existing = dismissTimers.get(notificationId);
    if (existing !== undefined) {
        window.clearTimeout(existing);
        dismissTimers.delete(notificationId);
    }

    if (durationMs === null) {
        return;
    }

    const timer = window.setTimeout(() => {
        dismissNotification(notificationId);
    }, durationMs);
    dismissTimers.set(notificationId, timer);
}

function applyPersistedScheduledDelivery(entry: ScheduledNotification): void {
    const existing = scheduledTimers.get(entry.id);
    if (existing !== undefined) {
        window.clearTimeout(existing);
        scheduledTimers.delete(entry.id);
    }

    const delay = entry.deliverAt - nowMs();
    if (delay <= 0) {
        deliverScheduledNotification(entry.id);
        return;
    }

    const timeoutMs = Math.min(delay, SCHEDULED_NOTIFICATION_MAX_DELAY_MS);
    const timer = window.setTimeout(() => {
        deliverScheduledNotification(entry.id);
    }, timeoutMs);
    scheduledTimers.set(entry.id, timer);
}

function restoreRuntimeStateFromSnapshot(): void {
    clearAllTimers();
    actionHandlers.clear();

    for (const entry of snapshot.active) {
        for (const action of entry.actions) {
            const key = createActionKey(entry.id, action.id);
            actionHandlers.delete(key);
        }
        armDismissTimer(entry.id, DEFAULT_NOTIFICATION_DURATION_MS);
    }

    for (const entry of snapshot.scheduled) {
        applyPersistedScheduledDelivery(entry);
    }
}

function hydrate(): void {
    try {
        const raw = window.localStorage.getItem(NOTIFICATION_CENTER_STORAGE_KEY);
        if (!raw) {
            snapshot = defaultSnapshot;
            return;
        }
        snapshot = sanitizeNotificationCenterSnapshot(JSON.parse(raw));
        if (!NOTIFICATIONS_ENABLED) {
            snapshot = {
                ...snapshot,
                active: [],
                history: [],
                scheduled: [],
            };
        }
    } catch {
        snapshot = defaultSnapshot;
    }
    restoreRuntimeStateFromSnapshot();
}

hydrate();

export function subscribeNotificationCenter(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getNotificationCenterSnapshot(): NotificationCenterSnapshot {
    return snapshot;
}

export function useNotificationCenterStore<T>(
    selector: (state: NotificationCenterSnapshot) => T
): T {
    const state = useSyncExternalStore(subscribeNotificationCenter, getNotificationCenterSnapshot);
    return selector(state);
}

function updateHistoryRecord(
    notificationId: string,
    mutator: (record: NotificationRecord) => NotificationRecord
): NotificationRecord | null {
    let found: NotificationRecord | null = null;
    snapshot = {
        ...snapshot,
        history: snapshot.history.map(record => {
            if (record.id !== notificationId) {
                return record;
            }
            found = mutator(record);
            return found;
        }),
    };
    return found;
}

function registerActionHandlers(notificationId: string, actions: NotificationAction[]): void {
    clearActionHandlersForNotification(notificationId);
    for (const action of actions) {
        if (typeof action.onAction === 'function') {
            actionHandlers.set(createActionKey(notificationId, action.id), action.onAction);
        }
    }
}

export function pushNotification(input: NotificationInput): string | null {
    if (!NOTIFICATIONS_ENABLED) {
        return null;
    }
    const message = input.message.trim();
    if (!message) {
        return null;
    }

    const type = normalizeType(input.type);
    if (!snapshot.preferences[type]) {
        snapshot = {
            ...snapshot,
            analytics: {
                ...snapshot.analytics,
                suppressedTotal: snapshot.analytics.suppressedTotal + 1,
            },
        };
        persist();
        emit();
        return null;
    }

    const id = input.id?.trim() || createNotificationId('note');
    const createdAt = nowMs();
    const durationMs = normalizeDurationMs(input.durationMs);
    const actionsInput = Array.isArray(input.actions) ? input.actions : [];
    const actions = actionsInput
        .map(action => normalizeAction(action))
        .filter((action): action is PersistedNotificationAction => !!action);

    const record: NotificationRecord = {
        id,
        type,
        message,
        title: input.title?.trim() || undefined,
        source: normalizeNotificationSource(input.source),
        createdAt,
        actions,
    };

    registerActionHandlers(id, actionsInput);

    snapshot = {
        ...snapshot,
        active: [record, ...snapshot.active.filter(item => item.id !== id)].slice(
            0,
            MAX_ACTIVE_NOTIFICATIONS
        ),
        history: [record, ...snapshot.history.filter(item => item.id !== id)].slice(
            0,
            MAX_NOTIFICATION_HISTORY
        ),
        analytics: {
            ...snapshot.analytics,
            deliveredTotal: snapshot.analytics.deliveredTotal + 1,
            deliveredByType: {
                ...snapshot.analytics.deliveredByType,
                [type]: snapshot.analytics.deliveredByType[type] + 1,
            },
            lastDeliveredAt: createdAt,
        },
    };

    armDismissTimer(id, durationMs);
    persist();
    emit();
    return id;
}

export function dismissNotification(notificationId: string): void {
    const timer = dismissTimers.get(notificationId);
    if (timer !== undefined) {
        window.clearTimeout(timer);
        dismissTimers.delete(notificationId);
    }

    const dismissedAt = nowMs();
    clearActionHandlersForNotification(notificationId);

    snapshot = {
        ...snapshot,
        active: snapshot.active.filter(item => item.id !== notificationId),
        analytics: {
            ...snapshot.analytics,
            dismissedTotal: snapshot.analytics.dismissedTotal + 1,
        },
    };

    updateHistoryRecord(notificationId, record => ({
        ...record,
        dismissedAt,
        readAt: record.readAt ?? dismissedAt,
    }));

    persist();
    emit();
}

export function markNotificationRead(notificationId: string): void {
    const readAt = nowMs();
    snapshot = {
        ...snapshot,
        active: snapshot.active.map(item =>
            item.id === notificationId ? { ...item, readAt: item.readAt ?? readAt } : item
        ),
    };
    updateHistoryRecord(notificationId, record => ({
        ...record,
        readAt: record.readAt ?? readAt,
    }));
    persist();
    emit();
}

export function markAllNotificationsRead(): void {
    const readAt = nowMs();
    snapshot = {
        ...snapshot,
        active: snapshot.active.map(item => ({ ...item, readAt: item.readAt ?? readAt })),
        history: snapshot.history.map(item => ({ ...item, readAt: item.readAt ?? readAt })),
    };
    persist();
    emit();
}

export function runNotificationAction(notificationId: string, actionId: string): void {
    const action = snapshot.history
        .find(item => item.id === notificationId)
        ?.actions.find(item => item.id === actionId);
    if (!action) {
        return;
    }

    const handler = actionHandlers.get(createActionKey(notificationId, actionId));
    if (handler) {
        handler();
    }

    snapshot = {
        ...snapshot,
        analytics: {
            ...snapshot.analytics,
            actionClicksTotal: snapshot.analytics.actionClicksTotal + 1,
        },
    };
    persist();
    emit();

    if (action.autoClose !== false) {
        dismissNotification(notificationId);
    }
}

function deliverScheduledNotification(scheduleId: string): void {
    const scheduled = snapshot.scheduled.find(item => item.id === scheduleId);
    if (!scheduled) {
        return;
    }

    const timer = scheduledTimers.get(scheduleId);
    if (timer !== undefined) {
        window.clearTimeout(timer);
        scheduledTimers.delete(scheduleId);
    }

    snapshot = {
        ...snapshot,
        scheduled: snapshot.scheduled.filter(item => item.id !== scheduleId),
        analytics: {
            ...snapshot.analytics,
            deliveredFromScheduleTotal: snapshot.analytics.deliveredFromScheduleTotal + 1,
        },
    };
    persist();
    emit();

    pushNotification({
        ...scheduled.payload,
        actions: scheduled.payload.actions,
        durationMs: scheduled.payload.durationMs,
    });
}

export function scheduleNotification(
    input: NotificationInput,
    deliverAt: number
): string | null {
    if (!NOTIFICATIONS_ENABLED) {
        return null;
    }
    const scheduleAt = Number.isFinite(deliverAt) ? Math.floor(deliverAt) : NaN;
    if (!Number.isFinite(scheduleAt)) {
        return null;
    }

    const message = input.message.trim();
    if (!message) {
        return null;
    }

    const actionsInput = Array.isArray(input.actions) ? input.actions : [];
    const actions = actionsInput
        .map(action => normalizeAction(action))
        .filter((action): action is PersistedNotificationAction => !!action);

    if (scheduleAt <= nowMs()) {
        return pushNotification({ ...input, actions });
    }

    const scheduleId = createNotificationId('schedule');
    const scheduledItem: ScheduledNotification = {
        id: scheduleId,
        deliverAt: scheduleAt,
        payload: {
            id: input.id?.trim() || undefined,
            type: normalizeType(input.type),
            message,
            title: input.title?.trim() || undefined,
            source: normalizeNotificationSource(input.source),
            actions,
            durationMs: normalizeDurationMs(input.durationMs),
        },
    };

    snapshot = {
        ...snapshot,
        scheduled: [...snapshot.scheduled, scheduledItem].sort((a, b) => a.deliverAt - b.deliverAt),
        analytics: {
            ...snapshot.analytics,
            scheduledTotal: snapshot.analytics.scheduledTotal + 1,
        },
    };
    persist();
    emit();
    applyPersistedScheduledDelivery(scheduledItem);
    return scheduleId;
}

export function setNotificationPreferences(
    update: Partial<NotificationPreferences>
): void {
    snapshot = {
        ...snapshot,
        preferences: {
            ...snapshot.preferences,
            ...update,
        },
    };
    persist();
    emit();
}

export function clearNotificationHistory(): void {
    snapshot = {
        ...snapshot,
        history: [],
    };
    persist();
    emit();
}

export function toActiveToasts(records: NotificationRecord[]): Toast[] {
    return records.map(record => ({
        id: record.id,
        type: record.type,
        message: record.message,
    }));
}

export function exportNotificationCenterState(): {
    exportedAt: number;
    snapshot: NotificationCenterSnapshot;
} {
    return {
        exportedAt: nowMs(),
        snapshot,
    };
}

export function importNotificationCenterState(raw: RendererDataValue): NotificationCenterSnapshot {
    snapshot = sanitizeNotificationCenterSnapshot(raw);
    restoreRuntimeStateFromSnapshot();
    persist();
    emit();
    return snapshot;
}

export function getUnreadNotificationCount(state: NotificationCenterSnapshot): number {
    return state.history.filter(item => !item.readAt).length;
}

export function __resetNotificationCenterForTests(): void {
    clearAllTimers();
    actionHandlers.clear();
    snapshot = defaultSnapshot;
    try {
        window.localStorage.removeItem(NOTIFICATION_CENTER_STORAGE_KEY);
    } catch {
        // Ignore localStorage cleanup failures in tests.
    }
    emit();
}


