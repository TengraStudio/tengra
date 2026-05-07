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

/** Health status of a monitored component. */
export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

/** Snapshot shape returned by every health store. */
export interface HealthStoreSnapshot {
    name: string;
    status: HealthStatus;
    lastChecked: Date | null;
    error: string | null;
}

type Listener = () => void;

/** Public API surface of a health store instance. */
export interface HealthStore {
    subscribe: (listener: Listener) => () => void;
    getSnapshot: () => HealthStoreSnapshot;
    setState: (patch: Partial<Omit<HealthStoreSnapshot, 'name'>>) => void;
    useSnapshot: <T>(selector: (state: HealthStoreSnapshot) => T) => T;
    resetForTests: () => void;
}

/**
 * Creates a lightweight health store following the `useSyncExternalStore` pattern.
 *
 * @param name - Unique identifier for the health store (e.g. 'database', 'ollama').
 * @returns A {@link HealthStore} with subscribe, getSnapshot, and setState helpers.
 *
 * @example
 * ```ts
 * const ollamaHealth = createHealthStore('ollama');
 * ollamaHealth.setState({ status: 'healthy', lastChecked: new Date() });
 * ```
 */
export function createHealthStore(name: string): HealthStore {
    const listeners = new Set<Listener>();

    const initial: HealthStoreSnapshot = {
        name,
        status: 'unknown',
        lastChecked: null,
        error: null,
    };

    let snapshot: HealthStoreSnapshot = { ...initial };

    function emit(): void {
        for (const listener of listeners) {
            listener();
        }
    }

    const subscribe = (listener: Listener): (() => void) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    };

    const getSnapshot = (): HealthStoreSnapshot => snapshot;

    return {
        subscribe,
        getSnapshot,
        setState(patch) {
            snapshot = { ...snapshot, ...patch };
            emit();
        },
        useSnapshot: <T>(selector: (state: HealthStoreSnapshot) => T): T => {
            const snapshotValue = useSyncExternalStore(subscribe, getSnapshot);
            return selector(snapshotValue);
        },
        resetForTests() {
            snapshot = { ...initial };
            emit();
        },
    };
}

