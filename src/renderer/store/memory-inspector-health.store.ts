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

import { AdvancedMemoryHealthSummary } from '@shared/types/advanced-memory';

type MemoryInspectorHealthStatus = 'success' | 'failure' | 'validation-failure';
type MemoryInspectorHealthChannel = 'memory.loadData' | 'memory.import' | 'memory.operation';

interface MemoryInspectorHealthEvent {
    channel: MemoryInspectorHealthChannel;
    status: MemoryInspectorHealthStatus;
    timestamp: number;
    durationMs?: number;
    errorCode?: string;
}

interface MemoryInspectorChannelMetrics {
    calls: number;
    failures: number;
    validationFailures: number;
    budgetExceeded: number;
    lastDurationMs: number;
}

export interface MemoryInspectorHealthSnapshot {
    status: 'healthy' | 'degraded';
    uiState: 'ready' | 'failure';
    budgets: {
        loadDataMs: number;
        importMs: number;
        operationMs: number;
    };
    metrics: {
        totalCalls: number;
        totalFailures: number;
        validationFailures: number;
        budgetExceeded: number;
        errorRate: number;
        lastErrorCode: string | null;
        channels: Record<MemoryInspectorHealthChannel, MemoryInspectorChannelMetrics>;
    };
    runtime: {
        status: 'healthy' | 'degraded' | 'unknown';
        cacheHitRate: number;
        averageLookupDurationMs: number;
        lookupTimeoutCount: number;
        lookupFailureCount: number;
        cacheSize: number;
        inflightSize: number;
        lastUpdatedAt: number | null;
    };
    events: MemoryInspectorHealthEvent[];
}

type Listener = () => void;

const MAX_EVENTS = 180;
const memoryInspectorHealthBudgets = {
    loadDataMs: 1000,
    importMs: 1200,
    operationMs: 700,
} as const;
const memoryLookupRuntimeBudgetMs = 300;

const listeners = new Set<Listener>();

const createChannelMetrics = (): MemoryInspectorChannelMetrics => ({
    calls: 0,
    failures: 0,
    validationFailures: 0,
    budgetExceeded: 0,
    lastDurationMs: 0,
});

const initialSnapshot: MemoryInspectorHealthSnapshot = {
    status: 'healthy',
    uiState: 'ready',
    budgets: {
        loadDataMs: memoryInspectorHealthBudgets.loadDataMs,
        importMs: memoryInspectorHealthBudgets.importMs,
        operationMs: memoryInspectorHealthBudgets.operationMs,
    },
    metrics: {
        totalCalls: 0,
        totalFailures: 0,
        validationFailures: 0,
        budgetExceeded: 0,
        errorRate: 0,
        lastErrorCode: null,
        channels: {
            'memory.loadData': createChannelMetrics(),
            'memory.import': createChannelMetrics(),
            'memory.operation': createChannelMetrics(),
        },
    },
    runtime: {
        status: 'unknown',
        cacheHitRate: 0,
        averageLookupDurationMs: 0,
        lookupTimeoutCount: 0,
        lookupFailureCount: 0,
        cacheSize: 0,
        inflightSize: 0,
        lastUpdatedAt: null,
    },
    events: [],
};

let snapshot: MemoryInspectorHealthSnapshot = initialSnapshot;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function channelBudget(channel: MemoryInspectorHealthChannel): number {
    if (channel === 'memory.loadData') {
        return memoryInspectorHealthBudgets.loadDataMs;
    }
    if (channel === 'memory.import') {
        return memoryInspectorHealthBudgets.importMs;
    }
    return memoryInspectorHealthBudgets.operationMs;
}

function computeStatus(
    errorRate: number,
    budgetExceeded: number,
    runtimeStatus: MemoryInspectorHealthSnapshot['runtime']['status']
): 'healthy' | 'degraded' {
    if (errorRate > 0.1 || budgetExceeded > 0 || runtimeStatus === 'degraded') {
        return 'degraded';
    }
    return 'healthy';
}

export function recordMemoryInspectorHealthEvent(event: {
    channel: MemoryInspectorHealthChannel;
    status: MemoryInspectorHealthStatus;
    durationMs?: number;
    errorCode?: string;
}): void {
    const channelMetrics = snapshot.metrics.channels[event.channel];
    const nextChannel: MemoryInspectorChannelMetrics = {
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
    const status = computeStatus(errorRate, budgetExceeded, snapshot.runtime.status);

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

export function recordMemoryInspectorRuntimeHealth(health?: AdvancedMemoryHealthSummary | null): void {
    if (!health?.memoryContext) {
        return;
    }

    const context = health.memoryContext;
    const cacheHitRate = context.lookupCount > 0
        ? (context.cacheHits / context.lookupCount) * 100
        : 0;
    const runtimeStatus: MemoryInspectorHealthSnapshot['runtime']['status'] =
        health.status === 'degraded'
            || context.lookupTimeoutCount > 0
            || context.lookupFailureCount > 0
            || context.averageLookupDurationMs > memoryLookupRuntimeBudgetMs
            ? 'degraded'
            : 'healthy';

    const nextRuntime: MemoryInspectorHealthSnapshot['runtime'] = {
        status: runtimeStatus,
        cacheHitRate: Number(cacheHitRate.toFixed(1)),
        averageLookupDurationMs: context.averageLookupDurationMs,
        lookupTimeoutCount: context.lookupTimeoutCount,
        lookupFailureCount: context.lookupFailureCount,
        cacheSize: context.cacheSize,
        inflightSize: context.inflightSize,
        lastUpdatedAt: Date.now(),
    };

    const status = computeStatus(
        snapshot.metrics.errorRate,
        snapshot.metrics.budgetExceeded,
        nextRuntime.status
    );

    snapshot = {
        ...snapshot,
        status,
        uiState: status === 'healthy' ? 'ready' : 'failure',
        runtime: nextRuntime,
    };
    emit();
}

export function getMemoryInspectorHealthSnapshot(): MemoryInspectorHealthSnapshot {
    return snapshot;
}

export function subscribeMemoryInspectorHealth(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useMemoryInspectorHealthStore<T>(
    selector: (state: MemoryInspectorHealthSnapshot) => T
): T {
    const snapshotValue = useSyncExternalStore(
        subscribeMemoryInspectorHealth,
        getMemoryInspectorHealthSnapshot,
        getMemoryInspectorHealthSnapshot
    );
    return selector(snapshotValue);
}

export function __resetMemoryInspectorHealthForTests(): void {
    snapshot = {
        ...initialSnapshot,
        metrics: {
            ...initialSnapshot.metrics,
            channels: {
                'memory.loadData': createChannelMetrics(),
                'memory.import': createChannelMetrics(),
                'memory.operation': createChannelMetrics(),
            },
        },
        runtime: {
            ...initialSnapshot.runtime,
        },
    };
    emit();
}
