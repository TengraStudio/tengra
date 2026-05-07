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

import { createDeferredPersist } from './deferred-persist.util';

const STORAGE_KEY = 'tengra.tooltip-analytics.v1';
const MAX_RECENT_EVENTS = 300;
const PERSIST_DELAY_MS = 120;

type Listener = () => void;

type TooltipEvent = {
    id: string;
    action: 'show' | 'hide';
    side: 'top' | 'bottom' | 'left' | 'right';
    timestamp: number;
};

export interface TooltipAnalyticsSnapshot {
    totals: {
        shown: number;
        hidden: number;
    };
    byId: Record<string, number>;
    recent: TooltipEvent[];
}

const listeners = new Set<Listener>();

const defaultSnapshot: TooltipAnalyticsSnapshot = {
    totals: {
        shown: 0,
        hidden: 0,
    },
    byId: {},
    recent: [],
};

let snapshot: TooltipAnalyticsSnapshot = defaultSnapshot;
const persistController = createDeferredPersist({
    delayMs: PERSIST_DELAY_MS,
    persist: () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } catch {
            // Ignore localStorage failures.
        }
    },
});

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function persist(): void {
    persistController.schedule();
}

function isObject(value: RendererDataValue): value is Record<string, RendererDataValue> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toCount(value: RendererDataValue): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}

function sanitizeSide(value: RendererDataValue): 'top' | 'bottom' | 'left' | 'right' {
    if (value === 'bottom' || value === 'left' || value === 'right') {
        return value;
    }
    return 'top';
}

function sanitizeSnapshot(raw: RendererDataValue): TooltipAnalyticsSnapshot {
    if (!isObject(raw)) {
        return defaultSnapshot;
    }
    const totalsRaw = isObject(raw.totals) ? raw.totals : {};
    const byIdRaw = isObject(raw.byId) ? raw.byId : {};
    const recentRaw = Array.isArray(raw.recent) ? raw.recent : [];
    const byId: Record<string, number> = {};
    for (const [id, count] of Object.entries(byIdRaw)) {
        if (!id.trim()) {
            continue;
        }
        byId[id] = toCount(count);
    }
    return {
        totals: {
            shown: toCount(totalsRaw.shown),
            hidden: toCount(totalsRaw.hidden),
        },
        byId,
        recent: recentRaw
            .map(item => {
                if (!isObject(item)) {
                    return null;
                }
                const id = typeof item.id === 'string' ? item.id.trim() : '';
                if (!id) {
                    return null;
                }
                return {
                    id,
                    action: item.action === 'hide' ? 'hide' : 'show',
                    side: sanitizeSide(item.side),
                    timestamp:
                        typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)
                            ? Math.floor(item.timestamp)
                            : Date.now(),
                } satisfies TooltipEvent;
            })
            .filter((item): item is TooltipEvent => !!item)
            .slice(0, MAX_RECENT_EVENTS),
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

function trackTooltipEvent(event: TooltipEvent): void {
    snapshot = {
        totals: {
            shown: snapshot.totals.shown + (event.action === 'show' ? 1 : 0),
            hidden: snapshot.totals.hidden + (event.action === 'hide' ? 1 : 0),
        },
        byId: {
            ...snapshot.byId,
            [event.id]: (snapshot.byId[event.id] ?? 0) + 1,
        },
        recent: [event, ...snapshot.recent].slice(0, MAX_RECENT_EVENTS),
    };
    persist();
    emit();
}

export function trackTooltipShown(
    id: string,
    side: 'top' | 'bottom' | 'left' | 'right'
): void {
    if (!id.trim()) {
        return;
    }
    trackTooltipEvent({
        id: id.trim(),
        action: 'show',
        side,
        timestamp: Date.now(),
    });
}

export function trackTooltipHidden(
    id: string,
    side: 'top' | 'bottom' | 'left' | 'right'
): void {
    if (!id.trim()) {
        return;
    }
    trackTooltipEvent({
        id: id.trim(),
        action: 'hide',
        side,
        timestamp: Date.now(),
    });
}

export function subscribeTooltipAnalytics(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getTooltipAnalyticsSnapshot(): TooltipAnalyticsSnapshot {
    return snapshot;
}

export function useTooltipAnalyticsStore<T>(
    selector: (state: TooltipAnalyticsSnapshot) => T
): T {
    const snapshotValue = useSyncExternalStore(
        subscribeTooltipAnalytics,
        getTooltipAnalyticsSnapshot,
        getTooltipAnalyticsSnapshot
    );
    return selector(snapshotValue);
}

export function __resetTooltipAnalyticsForTests(): void {
    persistController.cancel();
    snapshot = defaultSnapshot;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore cleanup errors.
    }
    emit();
}


