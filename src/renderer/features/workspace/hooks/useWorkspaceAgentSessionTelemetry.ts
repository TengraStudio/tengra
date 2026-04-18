/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect } from 'react';

import { refreshTelemetryForSession } from '../utils/workspace-agent-session-utils';

interface UseWorkspaceAgentSessionTelemetryOptions {
    currentSessionId: string | null;
    currentSession: WorkspaceAgentSessionSummary | null;
    setSessions: Dispatch<SetStateAction<WorkspaceAgentSessionSummary[]>>;
}

export function useWorkspaceAgentSessionTelemetry({
    currentSessionId,
    currentSession,
    setSessions,
}: UseWorkspaceAgentSessionTelemetryOptions) {
    const refreshTelemetry = useCallback(async (sessionId: string) => {
        await refreshTelemetryForSession({
            sessionId,
            setSessions,
        });
    }, [setSessions]);

    useEffect(() => {
        if (!currentSessionId || currentSession?.contextTelemetry) {
            return;
        }
        void Promise.resolve().then(() => refreshTelemetry(currentSessionId));
    }, [currentSession?.contextTelemetry, currentSessionId, refreshTelemetry]);

    return {
        refreshTelemetry,
    };
}
