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
import React from 'react';

import type { WorkspaceAnalysis, WorkspaceMount } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import {
    buildWorkspaceExplorerDiagnosticsSnapshot,
    WorkspaceExplorerDiagnosticsSnapshot,
} from '../utils/workspace-explorer-diagnostics';

interface UseWorkspaceExplorerDiagnosticsOptions {
    workspaceId: string;
    workspaceRootPath?: string;
    mounts: WorkspaceMount[];
    refreshSignal: number;
}

const EMPTY_SNAPSHOT: WorkspaceExplorerDiagnosticsSnapshot = {
    mountSummary: {},
    byPath: {},
};

const FILE_CHANGE_REFRESH_DEBOUNCE_MS = 900;
const SUMMARY_REQUEST_CACHE_TTL_MS = 5_000;

interface SummaryRequestCacheEntry {
    startedAt: number;
    request: Promise<WorkspaceAnalysis | null>;
}

const summaryRequestCache = new Map<string, SummaryRequestCacheEntry>();

async function loadWorkspaceAgentSessions(
    workspaceId: string
): Promise<WorkspaceAgentSessionSummary[]> {
    try {
        const response = await window.electron.session.workspaceAgent.listByWorkspace(workspaceId);
        return response.sessions;
    } catch (error) {
        appLogger.warn('WorkspaceExplorerDiagnostics', 'Failed to load workspace agent sessions', {
            workspaceId,
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}

async function loadWorkspaceAnalysis(
    workspaceId: string,
    workspaceRootPath: string
): Promise<WorkspaceAnalysis | null> {
    const cacheKey = `${workspaceId}:${workspaceRootPath}`;
    const cachedRequest = summaryRequestCache.get(cacheKey);
    if (cachedRequest && Date.now() - cachedRequest.startedAt < SUMMARY_REQUEST_CACHE_TTL_MS) {
        return cachedRequest.request;
    }

    const request = (async () => {
    try {
        return await window.electron.workspace.analyzeSummary(workspaceRootPath, workspaceId);
    } catch (error) {
        appLogger.warn('WorkspaceExplorerDiagnostics', 'Failed to load workspace analysis', {
            workspaceId,
            workspaceRootPath,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
    })();
    summaryRequestCache.set(cacheKey, {
        startedAt: Date.now(),
        request,
    });
    return request;
}

export function useWorkspaceExplorerDiagnostics({
    workspaceId,
    workspaceRootPath,
    mounts,
    refreshSignal,
}: UseWorkspaceExplorerDiagnosticsOptions): WorkspaceExplorerDiagnosticsSnapshot {
    const [snapshot, setSnapshot] =
        React.useState<WorkspaceExplorerDiagnosticsSnapshot>(EMPTY_SNAPSHOT);
    const refreshTokenRef = React.useRef(refreshSignal);

    const reloadDiagnostics = React.useCallback(async () => {
        if (!workspaceRootPath) {
            setSnapshot(EMPTY_SNAPSHOT);
            return;
        }

        const [analysis, sessions] = await Promise.all([
            loadWorkspaceAnalysis(workspaceId, workspaceRootPath),
            loadWorkspaceAgentSessions(workspaceId),
        ]);
        setSnapshot(
            buildWorkspaceExplorerDiagnosticsSnapshot({
                analysis,
                mounts,
                sessions,
                workspaceRootPath,
            })
        );
    }, [mounts, workspaceId, workspaceRootPath]);

    React.useEffect(() => {
        void reloadDiagnostics();
    }, [reloadDiagnostics]);

    React.useEffect(() => {
        if (refreshSignal === refreshTokenRef.current) {
            return;
        }
        refreshTokenRef.current = refreshSignal;
        void reloadDiagnostics();
    }, [refreshSignal, reloadDiagnostics]);

    React.useEffect(() => {
        if (!workspaceRootPath) {
            return undefined;
        }

        let timeoutId: number | null = null;
        const unsubscribe = window.electron.workspace.onFileChange(
            (_event, _path, rootPath) => {
                if (rootPath !== workspaceRootPath) {
                    return;
                }
                if (timeoutId !== null) {
                    window.clearTimeout(timeoutId);
                }
                timeoutId = window.setTimeout(() => {
                    timeoutId = null;
                    void reloadDiagnostics();
                }, FILE_CHANGE_REFRESH_DEBOUNCE_MS);
            }
        );

        return () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
            unsubscribe();
        };
    }, [reloadDiagnostics, workspaceRootPath]);

    return snapshot;
}
