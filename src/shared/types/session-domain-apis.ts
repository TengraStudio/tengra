/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { IpcValue } from './common';
import type {
    WorkspaceStep,
} from './council';
import type { SessionCouncilQuotaInterruptEvent } from './session-engine';
import type {
    SessionCanvasEdgeRecord,
    SessionCanvasNodeRecord,
} from './session-workspace';
import type {
    WorkspaceAgentContextTelemetry,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSession,
    WorkspaceAgentSessionListResponse,
    WorkspaceAgentSessionModes,
    WorkspaceAgentSessionPersistence,
} from './workspace-agent-session';

export interface SessionWorkspaceApi {
    saveCanvasNodes: (nodes: SessionCanvasNodeRecord[]) => Promise<void>;
    getCanvasNodes: () => Promise<SessionCanvasNodeRecord[]>;
    deleteCanvasNode: (id: string) => Promise<void>;
    saveCanvasEdges: (edges: SessionCanvasEdgeRecord[]) => Promise<void>;
    getCanvasEdges: () => Promise<SessionCanvasEdgeRecord[]>;
    deleteCanvasEdge: (id: string) => Promise<void>;
}

export interface SessionCouncilApi {
    generatePlan: (taskId: string, task: string) => Promise<{ success: boolean; error?: string }>;
    getProposal: (taskId: string) => Promise<{ success: boolean; plan?: WorkspaceStep[]; error?: string }>;
    approveProposal: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    rejectProposal: (taskId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
    startExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    pauseExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    resumeExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    getTimeline: (taskId: string) => Promise<{ success: boolean; events?: Array<Record<string, IpcValue>>; error?: string }>;
    onQuotaInterrupt: (callback: (payload: SessionCouncilQuotaInterruptEvent) => void) => () => void;
}

export interface SessionWorkspaceAgentApi {
    listByWorkspace: (workspaceId: string) => Promise<WorkspaceAgentSessionListResponse>;
    create: (payload: {
        workspaceId: string;
        title: string;
        modes?: WorkspaceAgentSessionModes;
        strategy?: WorkspaceAgentSession['strategy'];
        permissionPolicy?: WorkspaceAgentPermissionPolicy;
    }) => Promise<WorkspaceAgentSession>;
    rename: (payload: {
        sessionId: string;
        title: string;
    }) => Promise<WorkspaceAgentSession>;
    select: (payload: {
        workspaceId: string;
        sessionId: string | null;
    }) => Promise<WorkspaceAgentSessionPersistence>;
    updatePersistence: (payload: {
        workspaceId: string;
        activeSessionId?: string | null;
        recentSessionIds?: string[];
        composerDraft?: string;
    }) => Promise<WorkspaceAgentSessionPersistence>;
    updateModes: (payload: {
        sessionId: string;
        modes: WorkspaceAgentSessionModes;
        status?: WorkspaceAgentSession['status'];
    }) => Promise<WorkspaceAgentSession>;
    updatePermissions: (payload: {
        sessionId: string;
        permissionPolicy: WorkspaceAgentPermissionPolicy;
    }) => Promise<WorkspaceAgentSession>;
    updateStrategy: (payload: {
        sessionId: string;
        strategy: WorkspaceAgentSession['strategy'];
    }) => Promise<WorkspaceAgentSession>;
    getContextTelemetry: (payload: {
        sessionId: string;
    }) => Promise<WorkspaceAgentContextTelemetry | null>;
    archive: (payload: {
        sessionId: string;
        archived: boolean;
    }) => Promise<WorkspaceAgentSession>;
    resumeBackgroundState: (payload: {
        workspaceId: string;
        activeSessionId: string | null;
    }) => Promise<WorkspaceAgentSessionPersistence>;
}
