import { useSyncExternalStore } from 'react';

type ChatHealthEventStatus = 'success' | 'failure' | 'validation-failure';
type ChatHealthChannel = 'chat.input' | 'chat.send' | 'chat.enhance';

interface ChatHealthEvent {
    channel: ChatHealthChannel;
    status: ChatHealthEventStatus;
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

export interface ChatHealthSnapshot {
    status: 'healthy' | 'degraded';
    uiState: 'ready' | 'failure';
    budgets: {
        inputMs: number;
        sendMs: number;
        enhanceMs: number;
    };
    metrics: {
        totalCalls: number;
        totalFailures: number;
        validationFailures: number;
        budgetExceeded: number;
        errorRate: number;
        lastErrorCode: string | null;
        channels: Record<ChatHealthChannel, ChannelMetrics>;
    };
    events: ChatHealthEvent[];
}

type Listener = () => void;

const MAX_EVENTS = 160;
const CHAT_HEALTH_BUDGETS = {
    inputMs: 20,
    sendMs: 900,
    enhanceMs: 1200,
} as const;

const listeners = new Set<Listener>();

const createChannelMetrics = (): ChannelMetrics => ({
    calls: 0,
    failures: 0,
    validationFailures: 0,
    budgetExceeded: 0,
    lastDurationMs: 0,
});

const defaultSnapshot: ChatHealthSnapshot = {
    status: 'healthy',
    uiState: 'ready',
    budgets: {
        inputMs: CHAT_HEALTH_BUDGETS.inputMs,
        sendMs: CHAT_HEALTH_BUDGETS.sendMs,
        enhanceMs: CHAT_HEALTH_BUDGETS.enhanceMs,
    },
    metrics: {
        totalCalls: 0,
        totalFailures: 0,
        validationFailures: 0,
        budgetExceeded: 0,
        errorRate: 0,
        lastErrorCode: null,
        channels: {
            'chat.input': createChannelMetrics(),
            'chat.send': createChannelMetrics(),
            'chat.enhance': createChannelMetrics(),
        },
    },
    events: [],
};

let snapshot: ChatHealthSnapshot = defaultSnapshot;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function getChannelBudget(channel: ChatHealthChannel): number {
    if (channel === 'chat.input') {
        return CHAT_HEALTH_BUDGETS.inputMs;
    }
    if (channel === 'chat.send') {
        return CHAT_HEALTH_BUDGETS.sendMs;
    }
    return CHAT_HEALTH_BUDGETS.enhanceMs;
}

function computeStatus(errorRate: number, budgetExceeded: number): 'healthy' | 'degraded' {
    if (errorRate > 0.1 || budgetExceeded > 0) {
        return 'degraded';
    }
    return 'healthy';
}

export function recordChatHealthEvent(event: {
    channel: ChatHealthChannel;
    status: ChatHealthEventStatus;
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

    if (typeof event.durationMs === 'number' && event.durationMs > getChannelBudget(event.channel)) {
        nextChannel.budgetExceeded += 1;
        budgetExceeded += 1;
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

export function getChatHealthSnapshot(): ChatHealthSnapshot {
    return snapshot;
}

export function subscribeChatHealth(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useChatHealthStore<T>(selector: (state: ChatHealthSnapshot) => T): T {
    const snapshotValue = useSyncExternalStore(
        subscribeChatHealth,
        getChatHealthSnapshot,
        getChatHealthSnapshot
    );
    return selector(snapshotValue);
}

export function __resetChatHealthForTests(): void {
    snapshot = {
        ...defaultSnapshot,
        metrics: {
            ...defaultSnapshot.metrics,
            channels: {
                'chat.input': createChannelMetrics(),
                'chat.send': createChannelMetrics(),
                'chat.enhance': createChannelMetrics(),
            },
        },
    };
    emit();
}
