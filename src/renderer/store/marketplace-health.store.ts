import { useSyncExternalStore } from 'react';

type MarketplaceHealthStatus = 'success' | 'failure' | 'validation-failure';
type MarketplaceHealthChannel =
    | 'marketplace.load'
    | 'marketplace.install'
    | 'marketplace.search';

interface MarketplaceChannelMetrics {
    calls: number;
    failures: number;
    validationFailures: number;
    budgetExceeded: number;
    lastDurationMs: number;
}

export interface MarketplaceHealthSnapshot {
    status: 'healthy' | 'degraded';
    budgets: {
        loadMs: number;
        installMs: number;
        searchMs: number;
    };
    metrics: {
        totalCalls: number;
        totalFailures: number;
        validationFailures: number;
        budgetExceeded: number;
        channels: Record<MarketplaceHealthChannel, MarketplaceChannelMetrics>;
        lastErrorCode: string | null;
    };
}

type Listener = () => void;

const budgets = {
    loadMs: 1200,
    installMs: 3000,
    searchMs: 100,
} as const;

const listeners = new Set<Listener>();

const createChannelMetrics = (): MarketplaceChannelMetrics => ({
    calls: 0,
    failures: 0,
    validationFailures: 0,
    budgetExceeded: 0,
    lastDurationMs: 0,
});

const initialSnapshot: MarketplaceHealthSnapshot = {
    status: 'healthy',
    budgets,
    metrics: {
        totalCalls: 0,
        totalFailures: 0,
        validationFailures: 0,
        budgetExceeded: 0,
        lastErrorCode: null,
        channels: {
            'marketplace.load': createChannelMetrics(),
            'marketplace.install': createChannelMetrics(),
            'marketplace.search': createChannelMetrics(),
        },
    },
};

let snapshot: MarketplaceHealthSnapshot = initialSnapshot;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function getBudget(channel: MarketplaceHealthChannel): number {
    if (channel === 'marketplace.install') {
        return budgets.installMs;
    }
    if (channel === 'marketplace.search') {
        return budgets.searchMs;
    }
    return budgets.loadMs;
}

export function recordMarketplaceHealthEvent(event: {
    channel: MarketplaceHealthChannel;
    status: MarketplaceHealthStatus;
    durationMs?: number;
    errorCode?: string;
}): void {
    const currentChannel = snapshot.metrics.channels[event.channel];
    const nextChannel = {
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
    if (typeof event.durationMs === 'number' && event.durationMs > getBudget(event.channel)) {
        budgetExceeded += 1;
        nextChannel.budgetExceeded += 1;
    }

    const totalCalls = snapshot.metrics.totalCalls + 1;
    snapshot = {
        ...snapshot,
        status: totalFailures > 0 || budgetExceeded > 0 ? 'degraded' : 'healthy',
        metrics: {
            ...snapshot.metrics,
            totalCalls,
            totalFailures,
            validationFailures,
            budgetExceeded,
            lastErrorCode,
            channels: {
                ...snapshot.metrics.channels,
                [event.channel]: nextChannel,
            },
        },
    };
    emit();
}

export function getMarketplaceHealthSnapshot(): MarketplaceHealthSnapshot {
    return snapshot;
}

export function subscribeMarketplaceHealth(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useMarketplaceHealthStore<T>(
    selector: (state: MarketplaceHealthSnapshot) => T
): T {
    return useSyncExternalStore(
        subscribeMarketplaceHealth,
        () => selector(getMarketplaceHealthSnapshot()),
        () => selector(getMarketplaceHealthSnapshot())
    );
}

export function __resetMarketplaceHealthForTests(): void {
    snapshot = {
        ...initialSnapshot,
        metrics: {
            ...initialSnapshot.metrics,
            channels: {
                'marketplace.load': createChannelMetrics(),
                'marketplace.install': createChannelMetrics(),
                'marketplace.search': createChannelMetrics(),
            },
        },
    };
    emit();
}
