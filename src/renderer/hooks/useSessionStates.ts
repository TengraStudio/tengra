import { SessionState } from '@shared/types/session-engine';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import {
    ensureSessionState,
    getSessionStateSnapshot,
    subscribeSessionRuntime,
} from '@/store/session-runtime.store';

export function useSessionStates(sessionIds: string[]): SessionState[] {
    const normalizedSessionIds = useMemo(() => {
        return Array.from(
            new Set(
                sessionIds.filter((sessionId): sessionId is string => {
                    return typeof sessionId === 'string' && sessionId.trim().length > 0;
                })
            )
        );
    }, [sessionIds]);

    const stateKey = normalizedSessionIds.join('|');
    const states = useSyncExternalStore(
        subscribeSessionRuntime,
        () =>
            normalizedSessionIds
                .map(sessionId => getSessionStateSnapshot(sessionId))
                .filter((state): state is SessionState => state !== null),
        () => []
    );

    useEffect(() => {
        for (const sessionId of normalizedSessionIds) {
            void ensureSessionState(sessionId);
        }
    }, [stateKey, normalizedSessionIds]);

    return states;
}
