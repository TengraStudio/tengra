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
        getSnapshot
    );

    useEffect(() => {
        void ensureSessionState(sessionId);
    }, [sessionId]);

    return state;
}

