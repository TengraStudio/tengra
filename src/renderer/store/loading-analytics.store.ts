import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'tengra.loading-analytics.v1';
const STORE_VERSION = 1;
const MAX_HISTORY = 300;

export type LoadingOperationStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface LoadingOperationRecord {
    id: string;
    context: string;
    startedAt: number;
    endedAt?: number;
    estimatedMs?: number;
    progress: number;
    status: LoadingOperationStatus;
    cancellable: boolean;
}

export interface LoadingAnalyticsSnapshot {
    version: number;
    active: Record<string, LoadingOperationRecord>;
    history: LoadingOperationRecord[];
    stats: {
        started: number;
        completed: number;
        cancelled: number;
        failed: number;
        avgDurationMs: number;
    };
}

type Listener = () => void;

const listeners = new Set<Listener>();

const defaultSnapshot: LoadingAnalyticsSnapshot = {
    version: STORE_VERSION,
    active: {},
    history: [],
    stats: {
        started: 0,
        completed: 0,
        cancelled: 0,
        failed: 0,
        avgDurationMs: 0,
    },
};

let snapshot: LoadingAnalyticsSnapshot = defaultSnapshot;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function persist(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
        // Ignore localStorage write failures.
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toCount(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}

function toProgress(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(100, value));
}

function sanitizeStatus(value: unknown): LoadingOperationStatus {
    if (value === 'completed' || value === 'cancelled' || value === 'failed') {
        return value;
    }
    return 'running';
}

function sanitizeRecord(raw: unknown): LoadingOperationRecord | null {
    if (!isObject(raw)) {
        return null;
    }
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const context = typeof raw.context === 'string' ? raw.context.trim() : '';
    const startedAt =
        typeof raw.startedAt === 'number' && Number.isFinite(raw.startedAt)
            ? raw.startedAt
            : Date.now();
    if (!id || !context) {
        return null;
    }
    return {
        id,
        context,
        startedAt,
        endedAt:
            typeof raw.endedAt === 'number' && Number.isFinite(raw.endedAt)
                ? raw.endedAt
                : undefined,
        estimatedMs:
            typeof raw.estimatedMs === 'number' && Number.isFinite(raw.estimatedMs)
                ? Math.max(0, Math.floor(raw.estimatedMs))
                : undefined,
        progress: toProgress(raw.progress),
        status: sanitizeStatus(raw.status),
        cancellable: raw.cancellable !== false,
    };
}

function sanitizeSnapshot(raw: unknown): LoadingAnalyticsSnapshot {
    if (!isObject(raw)) {
        return defaultSnapshot;
    }
    const activeRaw = isObject(raw.active) ? raw.active : {};
    const active: Record<string, LoadingOperationRecord> = {};
    for (const [id, value] of Object.entries(activeRaw)) {
        const record = sanitizeRecord(value);
        if (!record) {
            continue;
        }
        active[id] = { ...record, status: 'running', endedAt: undefined };
    }

    const historyRaw = Array.isArray(raw.history) ? raw.history : [];
    const history = historyRaw
        .map(value => sanitizeRecord(value))
        .filter((value): value is LoadingOperationRecord => !!value)
        .slice(0, MAX_HISTORY);

    const statsRaw = isObject(raw.stats) ? raw.stats : {};

    return {
        version: STORE_VERSION,
        active,
        history,
        stats: {
            started: toCount(statsRaw.started),
            completed: toCount(statsRaw.completed),
            cancelled: toCount(statsRaw.cancelled),
            failed: toCount(statsRaw.failed),
            avgDurationMs: toCount(statsRaw.avgDurationMs),
        },
    };
}

function hydrate(): void {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            snapshot = defaultSnapshot;
            return;
        }
        snapshot = sanitizeSnapshot(JSON.parse(raw));
    } catch {
        snapshot = defaultSnapshot;
    }
}

hydrate();

function recalculateAverageDuration(history: LoadingOperationRecord[]): number {
    const completed = history.filter(entry => entry.endedAt && entry.status !== 'running');
    if (completed.length === 0) {
        return 0;
    }
    const total = completed.reduce((sum, entry) => {
        const endedAt = entry.endedAt ?? entry.startedAt;
        return sum + Math.max(0, endedAt - entry.startedAt);
    }, 0);
    return Math.round(total / completed.length);
}

export function createLoadingOperationId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function beginLoadingOperation(options: {
    id: string;
    context: string;
    estimatedMs?: number;
    progress?: number;
    cancellable?: boolean;
}): void {
    const now = Date.now();
    const record: LoadingOperationRecord = {
        id: options.id,
        context: options.context,
        startedAt: now,
        estimatedMs: options.estimatedMs,
        progress: toProgress(options.progress ?? 0),
        status: 'running',
        cancellable: options.cancellable !== false,
    };

    snapshot = {
        ...snapshot,
        active: {
            ...snapshot.active,
            [record.id]: record,
        },
        stats: {
            ...snapshot.stats,
            started: snapshot.stats.started + 1,
        },
    };
    persist();
    emit();
}

export function updateLoadingOperationProgress(id: string, progress: number): void {
    const existing = snapshot.active[id];
    if (!existing) {
        return;
    }
    snapshot = {
        ...snapshot,
        active: {
            ...snapshot.active,
            [id]: {
                ...existing,
                progress: toProgress(progress),
            },
        },
    };
    persist();
    emit();
}

export function completeLoadingOperation(
    id: string,
    status: Exclude<LoadingOperationStatus, 'running'> = 'completed'
): void {
    const existing = snapshot.active[id];
    if (!existing) {
        return;
    }
    const endedAt = Date.now();
    const completed: LoadingOperationRecord = {
        ...existing,
        endedAt,
        progress: status === 'completed' ? 100 : existing.progress,
        status,
    };

    const nextHistory = [completed, ...snapshot.history].slice(0, MAX_HISTORY);
    const nextStats = {
        ...snapshot.stats,
        completed: snapshot.stats.completed + (status === 'completed' ? 1 : 0),
        cancelled: snapshot.stats.cancelled + (status === 'cancelled' ? 1 : 0),
        failed: snapshot.stats.failed + (status === 'failed' ? 1 : 0),
        avgDurationMs: recalculateAverageDuration(nextHistory),
    };

    const nextActive = { ...snapshot.active };
    delete nextActive[id];

    snapshot = {
        ...snapshot,
        active: nextActive,
        history: nextHistory,
        stats: nextStats,
    };
    persist();
    emit();
}

export function subscribeLoadingAnalytics(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getLoadingAnalyticsSnapshot(): LoadingAnalyticsSnapshot {
    return snapshot;
}

export function useLoadingAnalyticsStore<T>(
    selector: (state: LoadingAnalyticsSnapshot) => T
): T {
    return useSyncExternalStore(
        subscribeLoadingAnalytics,
        () => selector(getLoadingAnalyticsSnapshot()),
        () => selector(getLoadingAnalyticsSnapshot())
    );
}

export function __resetLoadingAnalyticsForTests(): void {
    snapshot = defaultSnapshot;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore localStorage cleanup errors in tests.
    }
    emit();
}

