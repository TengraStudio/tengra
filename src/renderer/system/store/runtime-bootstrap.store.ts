/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { RuntimeBootstrapExecutionResult } from '@shared/types/system/runtime-manifest';
import { useSyncExternalStore } from 'react';

import { appLogger } from '@/system/utils/renderer-logger';

interface RuntimeBootstrapStoreState {
    status: RuntimeBootstrapExecutionResult | null;
    isLoading: boolean;
    isRepairing: boolean;
    error: string | null;
}

type Listener = () => void;

const listeners = new Set<Listener>();

let state: RuntimeBootstrapStoreState = {
    status: null,
    isLoading: false,
    isRepairing: false,
    error: null,
};

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function setState(partial: Partial<RuntimeBootstrapStoreState>): void {
    state = {
        ...state,
        ...partial,
    };
    emit();
}

export async function loadRuntimeBootstrapStatus(forceRefresh: boolean = false): Promise<void> {
    setState({
        isLoading: true,
        error: null,
    });

    try {
        const status = forceRefresh
            ? await window.electron.runtime.refreshStatus()
            : await window.electron.runtime.getStatus();

        setState({
            status,
            error: null,
        });
    } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error('Runtime status request failed');
        appLogger.error('RuntimeBootstrapStore', 'Failed to load managed runtime status', normalizedError);
        setState({
            error: normalizedError.message,
        });
    } finally {
        setState({
            isLoading: false,
        });
    }
}

export async function repairManagedRuntime(manifestUrl?: string): Promise<void> {
    setState({
        isRepairing: true,
        error: null,
    });

    try {
        const status = await window.electron.runtime.repair(manifestUrl);
        setState({
            status,
            error: null,
        });
    } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error('Managed runtime repair failed');
        appLogger.error('RuntimeBootstrapStore', 'Failed to repair managed runtime', normalizedError);
        setState({
            error: normalizedError.message,
        });
    } finally {
        setState({
            isRepairing: false,
        });
    }
}

export function subscribeRuntimeBootstrapStore(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getRuntimeBootstrapSnapshot(): RuntimeBootstrapStoreState {
    return state;
}

export function __resetRuntimeBootstrapStoreForTests(): void {
    state = {
        status: null,
        isLoading: false,
        isRepairing: false,
        error: null,
    };
    emit();
}

export function useRuntimeBootstrapStore<T>(
    selector: (snapshot: RuntimeBootstrapStoreState) => T
): T {
    const snapshotValue = useSyncExternalStore(
        subscribeRuntimeBootstrapStore,
        getRuntimeBootstrapSnapshot,
        getRuntimeBootstrapSnapshot
    );
    return selector(snapshotValue);
}

export function hasBlockingRuntimeIssue(status: RuntimeBootstrapExecutionResult | null): boolean {
    if (!status) {
        return false;
    }

    if (status.summary.blockingFailures > 0) {
        return true;
    }

    for (const entry of status.entries) {
        if (entry.requirement !== 'required') {
            continue;
        }
        if (entry.status === 'install-required' || entry.status === 'failed') {
            return true;
        }
    }

    for (const healthEntry of status.health.entries) {
        if (healthEntry.requirement !== 'required' || healthEntry.source !== 'external') {
            continue;
        }
        if (healthEntry.action === 'install') {
            return true;
        }
    }

    return false;
}

export function getOptionalRuntimePrompts(
    status: RuntimeBootstrapExecutionResult | null,
    settings?: {
        dismissedRuntimeInstallPrompts?: string[];
        completedRuntimeInstalls?: string[];
    }
): RuntimeBootstrapExecutionResult['health']['entries'] {
    if (!status) {
        return [];
    }

    const dismissed = new Set(settings?.dismissedRuntimeInstallPrompts ?? []);
    const completed = new Set(settings?.completedRuntimeInstalls ?? []);

    return status.health.entries.filter(entry => {
        if (entry.requirement !== 'optional') {
            return false;
        }
        if (dismissed.has(entry.componentId) || completed.has(entry.componentId)) {
            return false;
        }
        if (entry.source === 'external') {
            return !entry.detected && entry.action === 'install';
        }
        return entry.status === 'missing';
    });
}
