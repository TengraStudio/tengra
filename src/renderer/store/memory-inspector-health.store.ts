import { useSyncExternalStore } from 'react';

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
    events: MemoryInspectorHealthEvent[];
}

type Listener = () => void;

const MAX_EVENTS = 180;
const memoryInspectorHealthBudgets = {
    loadDataMs: 1000,
    importMs: 1200,
    operationMs: 700,
} as const;

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

function computeStatus(errorRate: number, budgetExceeded: number): 'healthy' | 'degraded' {
    if (errorRate > 0.1 || budgetExceeded > 0) {
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
    };
    emit();
}
