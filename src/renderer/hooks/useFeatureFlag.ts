/**
 * React hook for consuming feature flags in the renderer process.
 * Provides loading, empty, and failure-state handling (BACKLOG-0447).
 * Uses useSyncExternalStore to follow project store conventions.
 *
 * @example
 * ```tsx
 * const { isEnabled, isLoading, error } = useFeatureFlag('council.planning');
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorBanner message={error} />;
 * if (!isEnabled) return null;
 * return <PlanningPanel />;
 * ```
 */
import { useSyncExternalStore } from 'react';

/** State returned by the useFeatureFlag hook */
export interface FeatureFlagState {
    /** Whether the flag is enabled (defaults to false during loading and on error) */
    isEnabled: boolean;
    /** True while the initial flag value is being fetched */
    isLoading: boolean;
    /** Non-null if the flag lookup failed */
    error: string | null;
}

type Listener = () => void;

const IPC_CHANNEL = 'feature-flag:is-enabled';
const listeners = new Set<Listener>();
const flagState = new Map<string, FeatureFlagState>();
const pending = new Set<string>();

const DEFAULT_STATE: FeatureFlagState = {
    isEnabled: false,
    isLoading: true,
    error: null,
};

function emit(): void {
    listeners.forEach(listener => listener());
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Safely invokes the IPC bridge if available */
function invokeIpc(featureId: string): Promise<boolean> {
    const api = (window as unknown as Record<string, unknown>).api as
        | { invoke?: (channel: string, ...args: string[]) => Promise<boolean> }
        | undefined;

    if (api?.invoke) {
        return api.invoke(IPC_CHANNEL, featureId);
    }
    return Promise.resolve(false);
}

/** Fetches a flag value and updates the store */
function fetchFlag(featureId: string): void {
    if (pending.has(featureId)) {
        return;
    }
    pending.add(featureId);

    invokeIpc(featureId)
        .then((enabled) => {
            flagState.set(featureId, { isEnabled: enabled, isLoading: false, error: null });
            emit();
        })
        .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            flagState.set(featureId, { isEnabled: false, isLoading: false, error: msg });
            emit();
        })
        .finally(() => {
            pending.delete(featureId);
        });
}

/**
 * Hook that resolves a feature flag value from the main process.
 * Returns a safe default (false) while loading or on error.
 *
 * @param featureId - The identifier of the feature flag to evaluate
 */
export function useFeatureFlag(featureId: string): FeatureFlagState {
    const state = useSyncExternalStore(
        subscribe,
        () => {
            const existing = flagState.get(featureId);
            if (existing) {
                return existing;
            }
            fetchFlag(featureId);
            return DEFAULT_STATE;
        },
        () => DEFAULT_STATE
    );
    return state;
}

/**
 * Invalidates the cached value for a feature flag so the next
 * render will re-fetch it from the main process.
 */
export function invalidateFeatureFlag(featureId: string): void {
    flagState.delete(featureId);
    emit();
}

/** Clears the entire feature flag cache */
export function clearFeatureFlagCache(): void {
    flagState.clear();
    emit();
}
