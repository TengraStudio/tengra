import { useSyncExternalStore } from 'react';

type SSHManagerHealthStatus = 'success' | 'failure' | 'validation-failure';
type SSHManagerHealthChannel =
    | 'ssh.loadConnections'
    | 'ssh.connect'
    | 'ssh.testProfile'
    | 'ssh.deleteProfile';

interface SSHManagerHealthEvent {
    channel: SSHManagerHealthChannel;
    status: SSHManagerHealthStatus;
    timestamp: number;
    durationMs?: number;
    errorCode?: string;
}

interface SSHManagerChannelMetrics {
    calls: number;
    failures: number;
    validationFailures: number;
    budgetExceeded: number;
    lastDurationMs: number;
}

export interface SSHManagerHealthSnapshot {
    status: 'healthy' | 'degraded';
    uiState: 'ready' | 'failure';
    budgets: {
        loadConnectionsMs: number;
        connectMs: number;
        testProfileMs: number;
        deleteProfileMs: number;
    };
    metrics: {
        totalCalls: number;
        totalFailures: number;
        validationFailures: number;
        budgetExceeded: number;
        errorRate: number;
        lastErrorCode: string | null;
        channels: Record<SSHManagerHealthChannel, SSHManagerChannelMetrics>;
    };
    events: SSHManagerHealthEvent[];
}

type Listener = () => void;

const MAX_EVENTS = 220;
const sshManagerHealthBudgets = {
    loadConnectionsMs: 450,
    connectMs: 1600,
    testProfileMs: 1200,
    deleteProfileMs: 450,
} as const;

const listeners = new Set<Listener>();

const createChannelMetrics = (): SSHManagerChannelMetrics => ({
    calls: 0,
    failures: 0,
    validationFailures: 0,
    budgetExceeded: 0,
    lastDurationMs: 0,
});

const initialSnapshot: SSHManagerHealthSnapshot = {
    status: 'healthy',
    uiState: 'ready',
    budgets: {
        loadConnectionsMs: sshManagerHealthBudgets.loadConnectionsMs,
        connectMs: sshManagerHealthBudgets.connectMs,
        testProfileMs: sshManagerHealthBudgets.testProfileMs,
        deleteProfileMs: sshManagerHealthBudgets.deleteProfileMs,
    },
    metrics: {
        totalCalls: 0,
        totalFailures: 0,
        validationFailures: 0,
        budgetExceeded: 0,
        errorRate: 0,
        lastErrorCode: null,
        channels: {
            'ssh.loadConnections': createChannelMetrics(),
            'ssh.connect': createChannelMetrics(),
            'ssh.testProfile': createChannelMetrics(),
            'ssh.deleteProfile': createChannelMetrics(),
        },
    },
    events: [],
};

let snapshot: SSHManagerHealthSnapshot = initialSnapshot;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function getChannelBudget(channel: SSHManagerHealthChannel): number {
    if (channel === 'ssh.loadConnections') {
        return sshManagerHealthBudgets.loadConnectionsMs;
    }
    if (channel === 'ssh.connect') {
        return sshManagerHealthBudgets.connectMs;
    }
    if (channel === 'ssh.testProfile') {
        return sshManagerHealthBudgets.testProfileMs;
    }
    return sshManagerHealthBudgets.deleteProfileMs;
}

function computeStatus(errorRate: number, budgetExceeded: number): 'healthy' | 'degraded' {
    if (errorRate > 0.1 || budgetExceeded > 0) {
        return 'degraded';
    }
    return 'healthy';
}

export function recordSSHManagerHealthEvent(event: {
    channel: SSHManagerHealthChannel;
    status: SSHManagerHealthStatus;
    durationMs?: number;
    errorCode?: string;
}): void {
    const channelMetrics = snapshot.metrics.channels[event.channel];
    const nextChannel: SSHManagerChannelMetrics = {
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
    if (
        typeof event.durationMs === 'number' &&
        event.durationMs > getChannelBudget(event.channel)
    ) {
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

export function getSSHManagerHealthSnapshot(): SSHManagerHealthSnapshot {
    return snapshot;
}

export function subscribeSSHManagerHealth(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useSSHManagerHealthStore<T>(
    selector: (state: SSHManagerHealthSnapshot) => T
): T {
    const snapshotValue = useSyncExternalStore(
        subscribeSSHManagerHealth,
        getSSHManagerHealthSnapshot,
        getSSHManagerHealthSnapshot
    );
    return selector(snapshotValue);
}

export function __resetSSHManagerHealthForTests(): void {
    snapshot = {
        ...initialSnapshot,
        metrics: {
            ...initialSnapshot.metrics,
            channels: {
                'ssh.loadConnections': createChannelMetrics(),
                'ssh.connect': createChannelMetrics(),
                'ssh.testProfile': createChannelMetrics(),
                'ssh.deleteProfile': createChannelMetrics(),
            },
        },
    };
    emit();
}
