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

import { refreshStatsForSession } from '../utils/workspace-agent-session-utils';

interface UseWorkspaceAgentSessionusageStatsOptions {
    currentSessionId: string | null;
    currentSession: WorkspaceAgentSessionSummary | null;
    setSessions: Dispatch<SetStateAction<WorkspaceAgentSessionSummary[]>>;
}

export function useWorkspaceAgentSessionStats({
    currentSessionId,
    currentSession,
    setSessions,
}: UseWorkspaceAgentSessionusageStatsOptions) {
    const refreshStats = useCallback(async (sessionId: string) => {
        await refreshStatsForSession({
            sessionId,
            setSessions,
        });
    }, [setSessions]);

    useEffect(() => {
        if (!currentSessionId || currentSession?.usageStats) {
            return;
        }
        void Promise.resolve().then(() => refreshStats(currentSessionId));
    }, [currentSession?.usageStats, currentSessionId, refreshStats]);

    return {
        refreshStats,
    };
}

