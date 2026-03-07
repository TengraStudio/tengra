import { ProjectStep } from '@shared/types/project-agent';
import { useCallback, useEffect, useRef, useState } from 'react';

import { OrchestratorStateView } from '../electron';

/**
 * Hook that wires the orchestrator IPC surface into React components.
 * Subscribes to real-time state updates and exposes action methods.
 */
export function useOrchestrator() {
    const [state, setState] = useState<OrchestratorStateView | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        const unsubscribe = window.electron.orchestrator.onUpdate(
            (updated: OrchestratorStateView) => {
                if (mountedRef.current) {
                    setState(updated);
                }
            }
        );

        void window.electron.orchestrator.getState().then((initial) => {
            if (mountedRef.current) {
                setState(initial);
            }
        });

        return () => {
            mountedRef.current = false;
            unsubscribe();
        };
    }, []);

    const start = useCallback(async (task: string, workspaceId?: string) => {
        setLoading(true);
        setError(null);
        try {
            await window.electron.orchestrator.start(task, workspaceId);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    const approve = useCallback(async (plan: ProjectStep[]) => {
        setError(null);
        try {
            await window.electron.orchestrator.approve(plan);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        }
    }, []);

    const stop = useCallback(async () => {
        setError(null);
        try {
            await window.electron.orchestrator.stop();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        }
    }, []);

    const refresh = useCallback(async () => {
        try {
            const current = await window.electron.orchestrator.getState();
            if (mountedRef.current) {
                setState(current);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        }
    }, []);

    return { state, loading, error, start, approve, stop, refresh };
}
