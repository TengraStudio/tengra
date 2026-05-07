/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

    const getSnapshot = useMemo(() => () => {
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
    }, [normalizedSessionIds]);

    const states = useSyncExternalStore(
        subscribeSessionRuntime,
        getSnapshot,
        getSnapshot
    );
    const stateKey = normalizedSessionIds.join('|');

    useEffect(() => {
        for (const sessionId of normalizedSessionIds) {
            void ensureSessionState(sessionId);
        }
    }, [stateKey, normalizedSessionIds]);

    return states;
}

