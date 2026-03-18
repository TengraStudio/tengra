import { SessionState } from '@shared/types/session-engine';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import {
    ensureSessionState,
    getSessionStateSnapshot,
    subscribeSessionRuntime,
} from '@/store/session-runtime.store';

export function useSessionState(sessionId: string | null): SessionState | null {
    const getSnapshot = useMemo(() => () => getSessionStateSnapshot(sessionId), [sessionId]);
    const state = useSyncExternalStore(
        subscribeSessionRuntime,
        getSnapshot,
        () => null
    );

    useEffect(() => {
        void ensureSessionState(sessionId);
    }, [sessionId]);

    return state;
}
