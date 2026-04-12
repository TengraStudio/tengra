import { useSyncExternalStore } from 'react';

type TelemetryHealthChannel = 'telemetry.track' | 'telemetry.flush' | 'telemetry.batch';
type TelemetryHealthEventStatus = 'success' | 'failure' | 'validation-failure';

interface TelemetryHealthEvent {
    channel: TelemetryHealthChannel;
    status: TelemetryHealthEventStatus;
    timestamp: number;
    durationMs?: number;
    errorCode?: string;
}

interface ChannelMetrics {
    calls: number;
    failures: number;
    validationFailures: number;
    budgetExceeded: number;
    lastDurationMs: number;
}

export interface TelemetryHealthSnapshot {
    status: 'healthy' | 'degraded';
    uiState: 'ready' | 'loading' | 'empty' | 'failure';
    budgets: {
        trackMs: number;
        flushMs: number;
        batchMs: number;
    };
    metrics: {
        totalCalls: number;
        totalFailures: number;
        validationFailures: number;
        budgetExceeded: number;
        errorRate: number;
        lastErrorCode: string | null;
        channels: Record<TelemetryHealthChannel, ChannelMetrics>;
    };
    events: TelemetryHealthEvent[];
}

type Listener = () => void;

const MAX_EVENTS = 160;
const TELEMETRY_HEALTH_BUDGETS = {
    trackMs: 10,
    flushMs: 5000,
    batchMs: 50,
} as const;

const listeners = new Set<Listener>();

const createChannelMetrics = (): ChannelMetrics => ({
    calls: 0,
    failures: 0,
    validationFailures: 0,
    budgetExceeded: 0,
    lastDurationMs: 0,
});

const defaultSnapshot: TelemetryHealthSnapshot = {
    status: 'healthy',
    uiState: 'ready',
    budgets: {
        trackMs: TELEMETRY_HEALTH_BUDGETS.trackMs,
        flushMs: TELEMETRY_HEALTH_BUDGETS.flushMs,
        batchMs: TELEMETRY_HEALTH_BUDGETS.batchMs,
    },
    metrics: {
        totalCalls: 0,
        totalFailures: 0,
        validationFailures: 0,
        budgetExceeded: 0,
        errorRate: 0,
        lastErrorCode: null,
        channels: {
            'telemetry.track': createChannelMetrics(),
            'telemetry.flush': createChannelMetrics(),
            'telemetry.batch': createChannelMetrics(),
        },
    },
    events: [],
};

let snapshot: TelemetryHealthSnapshot = defaultSnapshot;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function getChannelBudget(channel: TelemetryHealthChannel): number {
    if (channel === 'telemetry.track') {
        return TELEMETRY_HEALTH_BUDGETS.trackMs;
    }
    if (channel === 'telemetry.flush') {
        return TELEMETRY_HEALTH_BUDGETS.flushMs;
    }
    return TELEMETRY_HEALTH_BUDGETS.batchMs;
}

function computeStatus(
    errorRate: number,
    budgetExceeded: number
): 'healthy' | 'degraded' {
    if (errorRate > 0.1 || budgetExceeded > 0) {
        return 'degraded';
    }
    return 'healthy';
}

function computeUiState(
    status: 'healthy' | 'degraded',
    totalCalls: number
): 'ready' | 'loading' | 'empty' | 'failure' {
    if (totalCalls === 0) {
        return 'empty';
    }
    return status === 'healthy' ? 'ready' : 'failure';
}

/** Records a telemetry health event and updates the store snapshot */
export function recordTelemetryHealthEvent(event: {
    channel: TelemetryHealthChannel;
    status: TelemetryHealthEventStatus;
    durationMs?: number;
    errorCode?: string;
}): void {
    const currentChannel = snapshot.metrics.channels[event.channel];
    const nextChannel: ChannelMetrics = {
        ...currentChannel,
        calls: currentChannel.calls + 1,
        lastDurationMs: event.durationMs ?? currentChannel.lastDurationMs,
    };

    let totalFailures = snapshot.metrics.totalFailures;
    let validationFailures = snapshot.metrics.validationFailures;
    let budgetExceeded = snapshot.metrics.budgetExceeded;
    let lastErrorCode = snapshot.metrics.lastErrorCode;

    if (event.status === 'failure') {
        nextChannel.failures += 1;
        totalFailures += 1;
        lastErrorCode = event.errorCode ?? lastErrorCode;
    }

    if (event.status === 'validation-failure') {
        nextChannel.failures += 1;
        nextChannel.validationFailures += 1;
        totalFailures += 1;
        validationFailures += 1;
        lastErrorCode = event.errorCode ?? lastErrorCode;
    }

    const budget = getChannelBudget(event.channel);
    if (typeof event.durationMs === 'number' && event.durationMs > budget) {
        nextChannel.budgetExceeded += 1;
        budgetExceeded += 1;
    }

    const totalCalls = snapshot.metrics.totalCalls + 1;
    const errorRate = totalCalls === 0 ? 0 : totalFailures / totalCalls;
    const status = computeStatus(errorRate, budgetExceeded);

    snapshot = {
        ...snapshot,
        status,
        uiState: computeUiState(status, totalCalls),
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

/** Gets the current telemetry health snapshot */
export function getTelemetryHealthSnapshot(): TelemetryHealthSnapshot {
    return snapshot;
}

/** Subscribes to telemetry health store changes */
export function subscribeTelemetryHealth(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React hook for selecting from the telemetry health store */
export function useTelemetryHealthStore<T>(
    selector: (state: TelemetryHealthSnapshot) => T
): T {
    const snapshotValue = useSyncExternalStore(
        subscribeTelemetryHealth,
        getTelemetryHealthSnapshot,
        getTelemetryHealthSnapshot
    );
    return selector(snapshotValue);
}

/** Resets store state for testing */
export function __resetTelemetryHealthForTests(): void {
    snapshot = {
        ...defaultSnapshot,
        metrics: {
            ...defaultSnapshot.metrics,
            channels: {
                'telemetry.track': createChannelMetrics(),
                'telemetry.flush': createChannelMetrics(),
                'telemetry.batch': createChannelMetrics(),
            },
        },
    };
    emit();
}
