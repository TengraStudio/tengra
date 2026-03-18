import { RuntimeBootstrapExecutionResult } from '@shared/types/runtime-manifest';
import { useSyncExternalStore } from 'react';

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
        window.electron.log.error('Failed to load managed runtime status', normalizedError);
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
        window.electron.log.error('Failed to repair managed runtime', normalizedError);
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
    return useSyncExternalStore(
        subscribeRuntimeBootstrapStore,
        () => selector(getRuntimeBootstrapSnapshot()),
        () => selector(getRuntimeBootstrapSnapshot())
    );
}

export function hasBlockingRuntimeIssue(status: RuntimeBootstrapExecutionResult | null): boolean {
    if (!status) {
        return true;
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
