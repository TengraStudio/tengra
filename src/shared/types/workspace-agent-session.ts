/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { JsonObject } from './common';

export const WORKSPACE_AGENT_CHAT_TYPE = 'workspace-agent';

export const WORKSPACE_AGENT_SESSION_STATUSES = [
    'idle',
    'active',
    'waiting_input',
    'planning',
    'executing',
    'reviewing',
    'completed',
    'failed',
    'background',
] as const;

export type WorkspaceAgentSessionStatus =
    typeof WORKSPACE_AGENT_SESSION_STATUSES[number];

export type WorkspaceAgentExecutionStrategy =
    | 'reasoning-first'
    | 'balanced'
    | 'local-first-simple';

export interface WorkspaceAgentSessionModes extends JsonObject {
    ask: boolean;
    plan: boolean;
    agent: boolean;
    council: boolean;
}

export type WorkspaceAgentCommandPolicy =
    | 'blocked'
    | 'ask-every-time'
    | 'allowlist'
    | 'full-access';

export type WorkspaceAgentPathPolicy =
    | 'workspace-root-only'
    | 'allowlist'
    | 'restricted-off-dangerous'
    | 'full-access';

export interface WorkspaceAgentPermissionPolicy extends JsonObject {
    commandPolicy: WorkspaceAgentCommandPolicy;
    pathPolicy: WorkspaceAgentPathPolicy;
    allowedCommands: string[];
    disallowedCommands: string[];
    allowedPaths: string[];
}

export interface WorkspaceAgentContextTelemetry extends JsonObject {
    model: string;
    provider: string;
    strategy: WorkspaceAgentExecutionStrategy;
    contextWindow: number;
    usedTokens: number;
    remainingTokens: number;
    usagePercent: number;
    pressureState: 'low' | 'medium' | 'high';
    handoffCount: number;
    lastHandoffAt?: number;
    lastHandoffLabel?: string;
}

export interface CouncilChairmanSelection extends JsonObject {
    mode: 'auto' | 'manual';
    provider?: string;
    model?: string;
    agentId?: string;
}

export interface CouncilRunConfig extends JsonObject {
    enabled: boolean;
    chairman: CouncilChairmanSelection;
    strategy: WorkspaceAgentExecutionStrategy;
    requestedSubagentCount: 'auto' | number;
    activeView: 'board' | 'map';
}

export interface CouncilSubagentRuntime extends JsonObject {
    id: string;
    name: string;
    provider: string;
    model: string;
    workspaceId: string;
    status: 'idle' | 'working' | 'assisting' | 'reviewing' | 'completed';
    stageGoal: string;
    progressPercent: number;
    helpAvailable: boolean;
    ownerStageId?: string;
}

export interface CouncilSubagentWorkspaceDraft extends JsonObject {
    id: string;
    agentId: string;
    workspaceId: string;
    baseRevision: string;
    changedFiles: string[];
    patchSummary: string;
    riskFlags: string[];
    submittedAt: number;
}

export interface CouncilReviewDecision extends JsonObject {
    draftId: string;
    decision: 'approve' | 'reject' | 'revise' | 'reassign-model';
    chairmanAgentId?: string;
    note?: string;
    decidedAt: number;
}

export interface CouncilAssistEvent extends JsonObject {
    id: string;
    taskId: string;
    stageId: string;
    ownerAgentId: string;
    helperAgentId: string;
    summary: string;
    createdAt: number;
}

export interface CouncilInterAgentMessage extends JsonObject {
    id: string;
    taskId: string;
    stageId?: string;
    fromAgentId: string;
    toAgentId?: string;
    content: string;
    createdAt: number;
    channel: 'private' | 'group';
}

export interface WorkspaceAgentSessionSummary {
    id: string;
    workspaceId: string;
    title: string;
    status: WorkspaceAgentSessionStatus;
    updatedAt: number;
    createdAt: number;
    messageCount: number;
    lastMessagePreview?: string;
    modes: WorkspaceAgentSessionModes;
    strategy: WorkspaceAgentExecutionStrategy;
    permissionPolicy: WorkspaceAgentPermissionPolicy;
    contextTelemetry?: WorkspaceAgentContextTelemetry;
    councilConfig?: CouncilRunConfig;
    background: boolean;
    archived: boolean;
}

export interface WorkspaceAgentSession extends WorkspaceAgentSessionSummary {
    chatId: string;
    metadata: JsonObject;
    council: {
        chairman?: CouncilSubagentRuntime;
        subagents: CouncilSubagentRuntime[];
        drafts: CouncilSubagentWorkspaceDraft[];
        reviewQueue: CouncilSubagentWorkspaceDraft[];
        decisions: CouncilReviewDecision[];
        assistEvents: CouncilAssistEvent[];
        messages: CouncilInterAgentMessage[];
    };
}

export interface WorkspaceAgentSessionPersistence extends JsonObject {
    activeSessionId: string | null;
    recentSessionIds: string[];
    composerDraft: string;
    updatedAt: number;
}

export interface WorkspaceAgentSessionListResponse {
    sessions: WorkspaceAgentSessionSummary[];
    persistence: WorkspaceAgentSessionPersistence;
}

export interface QuotaWindow extends JsonObject {
    id: string;
    label: string;
    remaining: number;
    total: number;
    resetAt?: string;
}

export interface QuotaBucket extends JsonObject {
    id: string;
    provider: string;
    accountId?: string;
    label: string;
    models: string[];
    windows: QuotaWindow[];
}

export interface ModelCostProfile extends JsonObject {
    provider: string;
    model: string;
    reasoningWeight: number;
    speedWeight: number;
    local: boolean;
    creditMultiplier?: number;
    requestLimited?: boolean;
}

export interface ProviderFallbackCandidate extends JsonObject {
    provider: string;
    model: string;
    accountId?: string;
    bucketId?: string;
    score: number;
    reason: string;
}

export interface NormalizedQuotaSnapshot extends JsonObject {
    generatedAt: number;
    buckets: QuotaBucket[];
    models: ModelCostProfile[];
    fallbackCandidates: ProviderFallbackCandidate[];
}
