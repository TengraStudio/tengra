import { useSyncExternalStore } from 'react';

import type { BreakpointId } from '@/lib/responsive';

const STORAGE_KEY = 'tandem.responsive-analytics.v1';
const MAX_TRANSITIONS = 200;

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

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function persist(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
        // Ignore localStorage failures.
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

function sanitizeBreakpoint(value: unknown): BreakpointId | 'unknown' {
    if (value === 'mobile' || value === 'tablet' || value === 'desktop' || value === 'wide') {
        return value;
    }
    return 'unknown';
}

function sanitizeTransition(value: unknown): BreakpointTransitionEvent | null {
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

function sanitizeSnapshot(raw: unknown): ResponsiveAnalyticsSnapshot {
    if (!isObject(raw)) {
        return defaultSnapshot;
    }
    const countersRaw = isObject(raw.counters) ? raw.counters : {};
    const transitionsRaw = Array.isArray(raw.transitions) ? raw.transitions : [];
    return {
        current: sanitizeBreakpoint(raw.current),
        viewport: {
            width:
                typeof (raw.viewport as Record<string, unknown> | undefined)?.width === 'number'
                    ? Math.floor((raw.viewport as Record<string, number>).width)
                    : 0,
            height:
                typeof (raw.viewport as Record<string, unknown> | undefined)?.height === 'number'
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
    return useSyncExternalStore(
        subscribeResponsiveAnalytics,
        () => selector(getResponsiveAnalyticsSnapshot()),
        () => selector(getResponsiveAnalyticsSnapshot())
    );
}

export function __resetResponsiveAnalyticsForTests(): void {
    snapshot = defaultSnapshot;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore cleanup errors.
    }
    emit();
}
