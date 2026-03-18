import { SessionState } from '@shared/types/session-engine';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

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

    const lastResultRef = useRef<SessionState[]>([]);

    const states = useSyncExternalStore(
        subscribeSessionRuntime,
        useMemo(() => () => {
            const next = normalizedSessionIds
                .map(sessionId => getSessionStateSnapshot(sessionId))
                .filter((state): state is SessionState => state !== null);

            // Maintain stable array reference if contents are shallowly equal
            const last = lastResultRef.current;
            if (next.length !== last.length) {
                lastResultRef.current = next;
                return next;
            }

            for (let i = 0; i < next.length; i++) {
                if (next[i] !== last[i]) {
                    lastResultRef.current = next;
                    return next;
                }
            }

            return last;
        }, [normalizedSessionIds]),
        () => []
    );
    const stateKey = normalizedSessionIds.join('|');

    useEffect(() => {
        for (const sessionId of normalizedSessionIds) {
            void ensureSessionState(sessionId);
        }
    }, [stateKey, normalizedSessionIds]);

    return states;
}
