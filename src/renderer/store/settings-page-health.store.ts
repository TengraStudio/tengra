/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useSyncExternalStore } from 'react';

type SettingsPageHealthStatus = 'success' | 'failure' | 'validation-failure';
type SettingsPageHealthChannel =
    | 'settings.load'
    | 'settings.save'
    | 'settings.update'
    | 'settings.factoryReset';

interface SettingsPageHealthEvent {
    channel: SettingsPageHealthChannel;
    status: SettingsPageHealthStatus;
    timestamp: number;
    durationMs?: number;
    errorCode?: string;
}

interface SettingsPageChannelMetrics {
    calls: number;
    failures: number;
    validationFailures: number;
    budgetExceeded: number;
    lastDurationMs: number;
}

export interface SettingsPageHealthSnapshot {
    status: 'healthy' | 'degraded';
    uiState: 'ready' | 'failure';
    budgets: {
        loadMs: number;
        saveMs: number;
        updateMs: number;
        factoryResetMs: number;
    };
    metrics: {
        totalCalls: number;
        totalFailures: number;
        validationFailures: number;
        budgetExceeded: number;
        errorRate: number;
        lastErrorCode: string | null;
        channels: Record<SettingsPageHealthChannel, SettingsPageChannelMetrics>;
    };
    events: SettingsPageHealthEvent[];
}

type Listener = () => void;

const MAX_EVENTS = 220;
const settingsPageHealthBudgets = {
    loadMs: 700,
    saveMs: 1000,
    updateMs: 700,
    factoryResetMs: 1500,
} as const;

const listeners = new Set<Listener>();

const createChannelMetrics = (): SettingsPageChannelMetrics => ({
    calls: 0,
    failures: 0,
    validationFailures: 0,
    budgetExceeded: 0,
    lastDurationMs: 0,
});

const initialSnapshot: SettingsPageHealthSnapshot = {
    status: 'healthy',
    uiState: 'ready',
    budgets: {
        loadMs: settingsPageHealthBudgets.loadMs,
        saveMs: settingsPageHealthBudgets.saveMs,
        updateMs: settingsPageHealthBudgets.updateMs,
        factoryResetMs: settingsPageHealthBudgets.factoryResetMs,
    },
    metrics: {
        totalCalls: 0,
        totalFailures: 0,
        validationFailures: 0,
        budgetExceeded: 0,
        errorRate: 0,
        lastErrorCode: null,
        channels: {
            'settings.load': createChannelMetrics(),
            'settings.save': createChannelMetrics(),
            'settings.update': createChannelMetrics(),
            'settings.factoryReset': createChannelMetrics(),
        },
    },
    events: [],
};

let snapshot: SettingsPageHealthSnapshot = initialSnapshot;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function channelBudget(channel: SettingsPageHealthChannel): number {
    if (channel === 'settings.load') {
        return settingsPageHealthBudgets.loadMs;
    }
    if (channel === 'settings.save') {
        return settingsPageHealthBudgets.saveMs;
    }
    if (channel === 'settings.update') {
        return settingsPageHealthBudgets.updateMs;
    }
    return settingsPageHealthBudgets.factoryResetMs;
}

function computeStatus(errorRate: number, budgetExceeded: number): 'healthy' | 'degraded' {
    if (errorRate > 0.1 || budgetExceeded > 0) {
        return 'degraded';
    }
    return 'healthy';
}

export function recordSettingsPageHealthEvent(event: {
    channel: SettingsPageHealthChannel;
    status: SettingsPageHealthStatus;
    durationMs?: number;
    errorCode?: string;
}): void {
    const channelMetrics = snapshot.metrics.channels[event.channel];
    const nextChannel: SettingsPageChannelMetrics = {
        ...channelMetrics,
        calls: channelMetrics.calls + 1,
        lastDurationMs: event.durationMs ?? channelMetrics.lastDurationMs,
    };

    let totalFailures = snapshot.metrics.totalFailures;
    let validationFailures = snapshot.metrics.validationFailures;
    let budgetExceeded = snapshot.metrics.budgetExceeded;
    let lastErrorCode = snapshot.metrics.lastErrorCode;

    if (event.status === 'failure') {
        totalFailures += 1;
        nextChannel.failures += 1;
        lastErrorCode = event.errorCode ?? lastErrorCode;
    }
    if (event.status === 'validation-failure') {
        totalFailures += 1;
        validationFailures += 1;
        nextChannel.failures += 1;
        nextChannel.validationFailures += 1;
        lastErrorCode = event.errorCode ?? lastErrorCode;
    }
    if (typeof event.durationMs === 'number' && event.durationMs > channelBudget(event.channel)) {
        budgetExceeded += 1;
        nextChannel.budgetExceeded += 1;
    }

    const totalCalls = snapshot.metrics.totalCalls + 1;
    const errorRate = totalCalls === 0 ? 0 : totalFailures / totalCalls;
    const status = computeStatus(errorRate, budgetExceeded);

    snapshot = {
        ...snapshot,
        status,
        uiState: status === 'healthy' ? 'ready' : 'failure',
        metrics: {
            ...snapshot.metrics,
            totalCalls,
            totalFailures,
            validationFailures,
            budgetExceeded,
            errorRate,
            lastErrorCode,
            channels: {
                ...snapshot.metrics.channels,
                [event.channel]: nextChannel,
            },
        },
        events: [
            {
                channel: event.channel,
                status: event.status,
                timestamp: Date.now(),
                durationMs: event.durationMs,
                errorCode: event.errorCode,
            },
            ...snapshot.events,
        ].slice(0, MAX_EVENTS),
    };
    emit();
}

export function getSettingsPageHealthSnapshot(): SettingsPageHealthSnapshot {
    return snapshot;
}

export function subscribeSettingsPageHealth(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useSettingsPageHealthStore<T>(
    selector: (state: SettingsPageHealthSnapshot) => T
): T {
    const snapshotValue = useSyncExternalStore(
        subscribeSettingsPageHealth,
        getSettingsPageHealthSnapshot,
        getSettingsPageHealthSnapshot
    );
    return selector(snapshotValue);
}

export function __resetSettingsPageHealthForTests(): void {
    snapshot = {
        ...initialSnapshot,
        metrics: {
            ...initialSnapshot.metrics,
            channels: {
                'settings.load': createChannelMetrics(),
                'settings.save': createChannelMetrics(),
                'settings.update': createChannelMetrics(),
                'settings.factoryReset': createChannelMetrics(),
            },
        },
    };
    emit();
}
