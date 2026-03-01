import { useSyncExternalStore } from 'react';

/**
 * Status values for channel-based health events.
 */
export type ChannelEventStatus = 'success' | 'failure' | 'validation-failure';

/**
 * Per-channel metrics tracked by a channel health store.
 */
export interface ChannelMetrics {
    calls: number;
    failures: number;
    validationFailures: number;
    budgetExceeded: number;
    lastDurationMs: number;
}

/**
 * Snapshot shape returned by every channel health store.
 */
export interface ChannelHealthSnapshot<TChannel extends string> {
    status: 'healthy' | 'degraded';
    uiState: 'ready' | 'failure';
    budgets: Record<string, number>;
    metrics: {
        totalCalls: number;
        totalFailures: number;
        validationFailures: number;
        budgetExceeded: number;
        errorRate: number;
        lastErrorCode: string | null;
        channels: Record<TChannel, ChannelMetrics>;
    };
    events: Array<{
        channel: TChannel;
        status: ChannelEventStatus;
        timestamp: number;
        durationMs?: number;
        errorCode?: string;
    }>;
}

type Listener = () => void;

/** Configuration for a channel health store. */
export interface ChannelHealthStoreConfig<TChannel extends string> {
    channels: readonly TChannel[];
    budgets: Record<TChannel, number>;
    maxEvents?: number;
}

/** Public API surface of a channel health store instance. */
export interface ChannelHealthStore<TChannel extends string> {
    recordEvent: (event: {
        channel: TChannel;
        status: ChannelEventStatus;
        durationMs?: number;
        errorCode?: string;
    }) => void;
    getSnapshot: () => ChannelHealthSnapshot<TChannel>;
    subscribe: (listener: Listener) => () => void;
    useStore: <T>(selector: (s: ChannelHealthSnapshot<TChannel>) => T) => T;
    resetForTests: () => void;
}

/**
 * Creates a channel-based health store following the `useSyncExternalStore` pattern.
 *
 * @param name - Unique identifier for the health store.
 * @param config - Channel definitions and budget configuration.
 * @returns A {@link ChannelHealthStore} instance.
 */
export function createChannelHealthStore<TChannel extends string>(
    name: string,
    config: ChannelHealthStoreConfig<TChannel>
): ChannelHealthStore<TChannel> {
    const listeners = new Set<Listener>();
    const maxEvents = config.maxEvents ?? 200;

    function createMetrics(): ChannelMetrics {
        return { calls: 0, failures: 0, validationFailures: 0, budgetExceeded: 0, lastDurationMs: 0 };
    }

    function buildChannelMap(): Record<TChannel, ChannelMetrics> {
        const map = {} as Record<TChannel, ChannelMetrics>;
        for (const ch of config.channels) { map[ch] = createMetrics(); }
        return map;
    }

    const initial: ChannelHealthSnapshot<TChannel> = {
        status: 'healthy',
        uiState: 'ready',
        budgets: { ...config.budgets },
        metrics: {
            totalCalls: 0, totalFailures: 0, validationFailures: 0,
            budgetExceeded: 0, errorRate: 0, lastErrorCode: null,
            channels: buildChannelMap(),
        },
        events: [],
    };

    let snapshot: ChannelHealthSnapshot<TChannel> = { ...initial, metrics: { ...initial.metrics, channels: buildChannelMap() } };

    function emit(): void {
        for (const listener of listeners) { listener(); }
    }

    const subscribe = (listener: Listener): (() => void) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    };

    const getSnapshot = (): ChannelHealthSnapshot<TChannel> => snapshot;

    void name; // retained for debugging/logging if needed later

    return {
        subscribe,
        getSnapshot,
        recordEvent(event) {
            const cur = snapshot.metrics.channels[event.channel];
            const next: ChannelMetrics = { ...cur, calls: cur.calls + 1, lastDurationMs: event.durationMs ?? cur.lastDurationMs };

            let { totalFailures, validationFailures, budgetExceeded, lastErrorCode } = snapshot.metrics;

            if (event.status === 'failure') {
                next.failures += 1; totalFailures += 1;
                lastErrorCode = event.errorCode ?? lastErrorCode;
            }
            if (event.status === 'validation-failure') {
                next.failures += 1; next.validationFailures += 1;
                totalFailures += 1; validationFailures += 1;
                lastErrorCode = event.errorCode ?? lastErrorCode;
            }
            if (typeof event.durationMs === 'number' && event.durationMs > (config.budgets[event.channel] ?? Infinity)) {
                next.budgetExceeded += 1; budgetExceeded += 1;
            }

            const totalCalls = snapshot.metrics.totalCalls + 1;
            const errorRate = totalCalls === 0 ? 0 : totalFailures / totalCalls;
            const status = (errorRate > 0.1 || budgetExceeded > 0) ? 'degraded' : 'healthy';

            snapshot = {
                ...snapshot,
                status,
                uiState: status === 'healthy' ? 'ready' : 'failure',
                metrics: {
                    ...snapshot.metrics,
                    totalCalls, totalFailures, validationFailures, budgetExceeded, errorRate, lastErrorCode,
                    channels: { ...snapshot.metrics.channels, [event.channel]: next },
                },
                events: [
                    { channel: event.channel, status: event.status, timestamp: Date.now(), durationMs: event.durationMs, errorCode: event.errorCode },
                    ...snapshot.events,
                ].slice(0, maxEvents),
            };
            emit();
        },
        useStore: <T>(selector: (s: ChannelHealthSnapshot<TChannel>) => T): T =>
            useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getSnapshot())),
        resetForTests() {
            snapshot = { ...initial, metrics: { ...initial.metrics, channels: buildChannelMap() }, events: [] };
            emit();
        },
    };
}
