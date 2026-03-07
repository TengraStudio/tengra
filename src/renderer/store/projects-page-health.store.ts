import { useSyncExternalStore } from 'react';

type WorkspacesPageHealthStatus = 'success' | 'failure' | 'validation-failure';
type WorkspacesPageHealthChannel =
    | 'workspace.persistMounts'
    | 'workspace.addMount'
    | 'workspace.testConnection';

interface WorkspacesPageHealthEvent {
    channel: WorkspacesPageHealthChannel;
    status: WorkspacesPageHealthStatus;
    timestamp: number;
    durationMs?: number;
    errorCode?: string;
}

interface WorkspacesPageChannelMetrics {
    calls: number;
    failures: number;
    validationFailures: number;
    budgetExceeded: number;
    lastDurationMs: number;
}

export interface WorkspacesPageHealthSnapshot {
    status: 'healthy' | 'degraded';
    uiState: 'ready' | 'failure';
    budgets: {
        persistMountsMs: number;
        addMountMs: number;
        testConnectionMs: number;
    };
    metrics: {
        totalCalls: number;
        totalFailures: number;
        validationFailures: number;
        budgetExceeded: number;
        errorRate: number;
        lastErrorCode: string | null;
        channels: Record<WorkspacesPageHealthChannel, WorkspacesPageChannelMetrics>;
    };
    events: WorkspacesPageHealthEvent[];
}

type Listener = () => void;

const MAX_EVENTS = 200;
const workspacesPageHealthBudgets = {
    persistMountsMs: 300,
    addMountMs: 350,
    testConnectionMs: 1200,
} as const;

const listeners = new Set<Listener>();

const createChannelMetrics = (): WorkspacesPageChannelMetrics => ({
    calls: 0,
    failures: 0,
    validationFailures: 0,
    budgetExceeded: 0,
    lastDurationMs: 0,
});

const initialSnapshot: WorkspacesPageHealthSnapshot = {
    status: 'healthy',
    uiState: 'ready',
    budgets: {
        persistMountsMs: workspacesPageHealthBudgets.persistMountsMs,
        addMountMs: workspacesPageHealthBudgets.addMountMs,
        testConnectionMs: workspacesPageHealthBudgets.testConnectionMs,
    },
    metrics: {
        totalCalls: 0,
        totalFailures: 0,
        validationFailures: 0,
        budgetExceeded: 0,
        errorRate: 0,
        lastErrorCode: null,
        channels: {
            'workspace.persistMounts': createChannelMetrics(),
            'workspace.addMount': createChannelMetrics(),
            'workspace.testConnection': createChannelMetrics(),
        },
    },
    events: [],
};

let snapshot: WorkspacesPageHealthSnapshot = initialSnapshot;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function channelBudget(channel: WorkspacesPageHealthChannel): number {
    if (channel === 'workspace.persistMounts') {
        return workspacesPageHealthBudgets.persistMountsMs;
    }
    if (channel === 'workspace.addMount') {
        return workspacesPageHealthBudgets.addMountMs;
    }
    return workspacesPageHealthBudgets.testConnectionMs;
}

function computeStatus(errorRate: number, budgetExceeded: number): 'healthy' | 'degraded' {
    if (errorRate > 0.1 || budgetExceeded > 0) {
        return 'degraded';
    }
    return 'healthy';
}

export function recordWorkspacesPageHealthEvent(event: {
    channel: WorkspacesPageHealthChannel;
    status: WorkspacesPageHealthStatus;
    durationMs?: number;
    errorCode?: string;
}): void {
    const currentChannel = snapshot.metrics.channels[event.channel];
    const nextChannel: WorkspacesPageChannelMetrics = {
        ...currentChannel,
        calls: currentChannel.calls + 1,
        lastDurationMs: event.durationMs ?? currentChannel.lastDurationMs,
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

export function getWorkspacesPageHealthSnapshot(): WorkspacesPageHealthSnapshot {
    return snapshot;
}

export function subscribeWorkspacesPageHealth(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useWorkspacesPageHealthStore<T>(
    selector: (state: WorkspacesPageHealthSnapshot) => T
): T {
    return useSyncExternalStore(
        subscribeWorkspacesPageHealth,
        () => selector(getWorkspacesPageHealthSnapshot()),
        () => selector(getWorkspacesPageHealthSnapshot())
    );
}

export function __resetWorkspacesPageHealthForTests(): void {
    snapshot = {
        ...initialSnapshot,
        metrics: {
            ...initialSnapshot.metrics,
            channels: {
                'workspace.persistMounts': createChannelMetrics(),
                'workspace.addMount': createChannelMetrics(),
                'workspace.testConnection': createChannelMetrics(),
            },
        },
    };
    emit();
}
