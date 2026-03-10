import { SessionState } from '@shared/types/session-engine';
import { useEffect, useSyncExternalStore } from 'react';

import {
    ensureSessionState,
    getSessionStateSnapshot,
    subscribeSessionRuntime,
} from '@/store/session-runtime.store';

export function useSessionState(sessionId: string | null): SessionState | null {
    const state = useSyncExternalStore(
        subscribeSessionRuntime,
        () => getSessionStateSnapshot(sessionId),
        () => null
    );

    useEffect(() => {
        void ensureSessionState(sessionId);
    }, [sessionId]);

    return state;
}
