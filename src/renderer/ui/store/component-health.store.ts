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

export type ComponentUiState = 'ready' | 'loading' | 'empty' | 'failure';

export interface ComponentHealthSnapshot {
    name: string;
    uiState: ComponentUiState;
    successCount: number;
    failureCount: number;
    retryCount: number;
    fallbackCount: number;
    lastDurationMs: number;
    avgDurationMs: number;
    budgetMs: number;
    budgetExceededCount: number;
    lastErrorCode: string | null;
    lastUpdatedAt: number | null;
}

type Listener = () => void;

export interface ComponentHealthStore {
    subscribe: (listener: Listener) => () => void;
    getSnapshot: () => ComponentHealthSnapshot;
    useSnapshot: <T>(selector: (snapshot: ComponentHealthSnapshot) => T) => T;
    setUiState: (next: ComponentUiState) => void;
    recordSuccess: (durationMs: number) => void;
    recordFailure: (errorCode: string, durationMs?: number) => void;
    recordRetry: () => void;
    recordFallback: () => void;
    resetForTests: () => void;
}

function nowMs(): number {
    return Date.now();
}

function toDurationMs(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return 0;
    }
    return Math.floor(value);
}

export function createComponentHealthStore(
    name: string,
    budgetMs: number
): ComponentHealthStore {
    const listeners = new Set<Listener>();
    const normalizedBudgetMs = Math.max(1, Math.floor(budgetMs));
    const initialSnapshot: ComponentHealthSnapshot = {
        name,
        uiState: 'ready',
        successCount: 0,
        failureCount: 0,
        retryCount: 0,
        fallbackCount: 0,
        lastDurationMs: 0,
        avgDurationMs: 0,
        budgetMs: normalizedBudgetMs,
        budgetExceededCount: 0,
        lastErrorCode: null,
        lastUpdatedAt: null,
    };

    let snapshot: ComponentHealthSnapshot = initialSnapshot;

    function emit(): void {
        for (const listener of listeners) {
            listener();
        }
    }

    function updateDuration(nextDurationMs: number): {
        avgDurationMs: number;
        budgetExceededCount: number;
    } {
        const count = snapshot.successCount + 1;
        const avgDurationMs = Math.round(
            (snapshot.avgDurationMs * snapshot.successCount + nextDurationMs) / count
        );
        const budgetExceededCount =
            snapshot.budgetExceededCount + (nextDurationMs > snapshot.budgetMs ? 1 : 0);
        return { avgDurationMs, budgetExceededCount };
    }

    const subscribe = (listener: Listener): (() => void) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    };

    const getSnapshot = (): ComponentHealthSnapshot => snapshot;

    return {
        subscribe,
        getSnapshot,
        useSnapshot: <T>(selector: (state: ComponentHealthSnapshot) => T): T => {
            const snapshotValue = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
            return selector(snapshotValue);
        },
        setUiState(next) {
            snapshot = {
                ...snapshot,
                uiState: next,
                lastUpdatedAt: nowMs(),
            };
            emit();
        },
        recordSuccess(durationMs: number) {
            const nextDurationMs = toDurationMs(durationMs);
            const durationStats = updateDuration(nextDurationMs);
            snapshot = {
                ...snapshot,
                uiState: 'ready',
                successCount: snapshot.successCount + 1,
                lastDurationMs: nextDurationMs,
                avgDurationMs: durationStats.avgDurationMs,
                budgetExceededCount: durationStats.budgetExceededCount,
                lastErrorCode: null,
                lastUpdatedAt: nowMs(),
            };
            emit();
        },
        recordFailure(errorCode: string, durationMs?: number) {
            snapshot = {
                ...snapshot,
                uiState: 'failure',
                failureCount: snapshot.failureCount + 1,
                lastDurationMs: toDurationMs(durationMs),
                lastErrorCode: errorCode || 'UNKNOWN_COMPONENT_ERROR',
                lastUpdatedAt: nowMs(),
            };
            emit();
        },
        recordRetry() {
            snapshot = {
                ...snapshot,
                retryCount: snapshot.retryCount + 1,
                lastUpdatedAt: nowMs(),
            };
            emit();
        },
        recordFallback() {
            snapshot = {
                ...snapshot,
                fallbackCount: snapshot.fallbackCount + 1,
                lastUpdatedAt: nowMs(),
            };
            emit();
        },
        resetForTests() {
            snapshot = initialSnapshot;
            emit();
        },
    };
}

