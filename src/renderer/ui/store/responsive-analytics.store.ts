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

import type { BreakpointId } from '@/lib/responsive';

import { createDeferredPersist } from './deferred-persist.util';

const STORAGE_KEY = 'tengra.responsive-analytics.v1';
const MAX_TRANSITIONS = 200;
const PERSIST_DELAY_MS = 120;

type Listener = () => void;

export interface BreakpointTransitionEvent {
    from: BreakpointId | 'unknown';
    to: BreakpointId;
    width: number;
    timestamp: number;
}

export interface ResponsiveAnalyticsSnapshot {
    current: BreakpointId | 'unknown';
    viewport: {
        width: number;
        height: number;
    };
    counters: Record<BreakpointId, number>;
    transitions: BreakpointTransitionEvent[];
}

const listeners = new Set<Listener>();

const defaultSnapshot: ResponsiveAnalyticsSnapshot = {
    current: 'unknown',
    viewport: {
        width: 0,
        height: 0,
    },
    counters: {
        mobile: 0,
        tablet: 0,
        desktop: 0,
        wide: 0,
    },
    transitions: [],
};

let snapshot: ResponsiveAnalyticsSnapshot = defaultSnapshot;
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

function sanitizeBreakpoint(value: RendererDataValue): BreakpointId | 'unknown' {
    if (value === 'mobile' || value === 'tablet' || value === 'desktop' || value === 'wide') {
        return value;
    }
    return 'unknown';
}

function sanitizeTransition(value: RendererDataValue): BreakpointTransitionEvent | null {
    if (!isObject(value)) {
        return null;
    }
    const from = sanitizeBreakpoint(value.from);
    const to = sanitizeBreakpoint(value.to);
    if (to === 'unknown') {
        return null;
    }
    return {
        from,
        to,
        width:
            typeof value.width === 'number' && Number.isFinite(value.width)
                ? Math.max(0, Math.floor(value.width))
                : 0,
        timestamp:
            typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)
                ? Math.floor(value.timestamp)
                : Date.now(),
    };
}

function sanitizeSnapshot(raw: RendererDataValue): ResponsiveAnalyticsSnapshot {
    if (!isObject(raw)) {
        return defaultSnapshot;
    }
    const countersRaw = isObject(raw.counters) ? raw.counters : {};
    const transitionsRaw = Array.isArray(raw.transitions) ? raw.transitions : [];
    return {
        current: sanitizeBreakpoint(raw.current),
        viewport: {
            width:
                typeof (raw.viewport as Record<string, RendererDataValue> | undefined)?.width === 'number'
                    ? Math.floor((raw.viewport as Record<string, number>).width)
                    : 0,
            height:
                typeof (raw.viewport as Record<string, RendererDataValue> | undefined)?.height === 'number'
                    ? Math.floor((raw.viewport as Record<string, number>).height)
                    : 0,
        },
        counters: {
            mobile: toCount(countersRaw.mobile),
            tablet: toCount(countersRaw.tablet),
            desktop: toCount(countersRaw.desktop),
            wide: toCount(countersRaw.wide),
        },
        transitions: transitionsRaw
            .map(item => sanitizeTransition(item))
            .filter((item): item is BreakpointTransitionEvent => !!item)
            .slice(0, MAX_TRANSITIONS),
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

export function trackResponsiveBreakpoint(next: {
    breakpoint: BreakpointId;
    width: number;
    height: number;
}): void {
    const previous = snapshot.current;
    const changed = previous !== next.breakpoint;

    const transitions = changed
        ? [
              {
                  from: previous,
                  to: next.breakpoint,
                  width: Math.max(0, Math.floor(next.width)),
                  timestamp: Date.now(),
              },
              ...snapshot.transitions,
          ].slice(0, MAX_TRANSITIONS)
        : snapshot.transitions;

    snapshot = {
        current: next.breakpoint,
        viewport: {
            width: Math.max(0, Math.floor(next.width)),
            height: Math.max(0, Math.floor(next.height)),
        },
        counters: {
            ...snapshot.counters,
            [next.breakpoint]: snapshot.counters[next.breakpoint] + 1,
        },
        transitions,
    };
    persist();
    emit();
}

export function subscribeResponsiveAnalytics(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getResponsiveAnalyticsSnapshot(): ResponsiveAnalyticsSnapshot {
    return snapshot;
}

export function useResponsiveAnalyticsStore<T>(
    selector: (state: ResponsiveAnalyticsSnapshot) => T
): T {
    const state = useSyncExternalStore(subscribeResponsiveAnalytics, getResponsiveAnalyticsSnapshot);
    return selector(state);
}

export function __resetResponsiveAnalyticsForTests(): void {
    persistController.cancel();
    snapshot = defaultSnapshot;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore cleanup errors.
    }
    emit();
}

