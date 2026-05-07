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

import type { AnimationPresetId } from '@/lib/animation-system';

import { createDeferredPersist } from './deferred-persist.util';

const STORAGE_KEY = 'tengra.animation-analytics.v1';
const MAX_RECENT_EVENTS = 300;
const PERSIST_DELAY_MS = 120;

type Listener = () => void;

type AnimationEvent = {
    name: string;
    preset: AnimationPresetId;
    durationMs: number;
    timestamp: number;
};

export interface AnimationAnalyticsSnapshot {
    debugEnabled: boolean;
    totals: {
        played: number;
        reducedMotionPlays: number;
    };
    byPreset: Record<AnimationPresetId, number>;
    recent: AnimationEvent[];
}

const listeners = new Set<Listener>();

const defaultSnapshot: AnimationAnalyticsSnapshot = {
    debugEnabled: false,
    totals: {
        played: 0,
        reducedMotionPlays: 0,
    },
    byPreset: {
        micro: 0,
        default: 0,
        emphasized: 0,
        page: 0,
        tooltip: 0,
    },
    recent: [],
};

let snapshot: AnimationAnalyticsSnapshot = defaultSnapshot;
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

function sanitizePreset(value: RendererDataValue): AnimationPresetId {
    if (
        value === 'micro' ||
        value === 'default' ||
        value === 'emphasized' ||
        value === 'page' ||
        value === 'tooltip'
    ) {
        return value;
    }
    return 'default';
}

function sanitizeRecentEvent(value: RendererDataValue): AnimationEvent | null {
    if (!isObject(value)) {
        return null;
    }
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    if (!name) {
        return null;
    }
    return {
        name,
        preset: sanitizePreset(value.preset),
        durationMs:
            typeof value.durationMs === 'number' && Number.isFinite(value.durationMs)
                ? Math.max(0, Math.floor(value.durationMs))
                : 0,
        timestamp:
            typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)
                ? Math.floor(value.timestamp)
                : Date.now(),
    };
}

function sanitizeSnapshot(raw: RendererDataValue): AnimationAnalyticsSnapshot {
    if (!isObject(raw)) {
        return defaultSnapshot;
    }
    const byPreset = isObject(raw.byPreset) ? raw.byPreset : {};
    const totals = isObject(raw.totals) ? raw.totals : {};
    const recentRaw = Array.isArray(raw.recent) ? raw.recent : [];
    return {
        debugEnabled: raw.debugEnabled === true,
        totals: {
            played: toCount(totals.played),
            reducedMotionPlays: toCount(totals.reducedMotionPlays),
        },
        byPreset: {
            micro: toCount(byPreset.micro),
            default: toCount(byPreset.default),
            emphasized: toCount(byPreset.emphasized),
            page: toCount(byPreset.page),
            tooltip: toCount(byPreset.tooltip),
        },
        recent: recentRaw
            .map(item => sanitizeRecentEvent(item))
            .filter((item): item is AnimationEvent => !!item)
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

export function setAnimationDebugEnabled(enabled: boolean): void {
    snapshot = {
        ...snapshot,
        debugEnabled: enabled,
    };
    persist();
    emit();
}

export function trackAnimationEvent(input: {
    name: string;
    preset: AnimationPresetId;
    durationMs: number;
    reducedMotion?: boolean;
}): void {
    const event: AnimationEvent = {
        name: input.name,
        preset: input.preset,
        durationMs: Math.max(0, Math.floor(input.durationMs)),
        timestamp: Date.now(),
    };
    snapshot = {
        ...snapshot,
        totals: {
            played: snapshot.totals.played + 1,
            reducedMotionPlays:
                snapshot.totals.reducedMotionPlays + (input.reducedMotion ? 1 : 0),
        },
        byPreset: {
            ...snapshot.byPreset,
            [input.preset]: snapshot.byPreset[input.preset] + 1,
        },
        recent: [event, ...snapshot.recent].slice(0, MAX_RECENT_EVENTS),
    };
    persist();
    emit();
}

export function getAnimationAnalyticsSnapshot(): AnimationAnalyticsSnapshot {
    return snapshot;
}

export function subscribeAnimationAnalytics(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useAnimationAnalyticsStore<T>(
    selector: (state: AnimationAnalyticsSnapshot) => T
): T {
    const snapshot = useSyncExternalStore(
        subscribeAnimationAnalytics,
        getAnimationAnalyticsSnapshot,
        getAnimationAnalyticsSnapshot
    );
    return selector(snapshot);
}

export function __resetAnimationAnalyticsForTests(): void {
    persistController.cancel();
    snapshot = defaultSnapshot;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore cleanup errors.
    }
    emit();
}


