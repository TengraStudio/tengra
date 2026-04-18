/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    CouncilAssistEvent,
    CouncilChairmanSelection,
    CouncilInterAgentMessage,
    CouncilReviewDecision,
    CouncilRunConfig,
    CouncilSubagentRuntime,
    CouncilSubagentWorkspaceDraft,
    ModelCostProfile,
    NormalizedQuotaSnapshot,
    ProviderFallbackCandidate,
    QuotaBucket,
    QuotaWindow,
    WORKSPACE_AGENT_SESSION_STATUSES,
    WorkspaceAgentContextTelemetry,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSessionModes,
    WorkspaceAgentSessionStatus,
} from '@shared/types/workspace-agent-session';
import { z } from 'zod';

const workspaceAgentSessionModesSchema: z.ZodType<WorkspaceAgentSessionModes> =
    z.object({
        ask: z.boolean(),
        plan: z.boolean(),
        agent: z.boolean(),
        council: z.boolean(),
    });

const workspaceAgentPermissionPolicySchema: z.ZodType<WorkspaceAgentPermissionPolicy> =
    z.object({
        commandPolicy: z.enum([
            'blocked',
            'ask-every-time',
            'allowlist',
            'full-access',
        ]),
        pathPolicy: z.enum([
            'workspace-root-only',
            'allowlist',
            'restricted-off-dangerous',
            'full-access',
        ]),
        allowedCommands: z.array(z.string().trim().min(1)).max(200),
        disallowedCommands: z.array(z.string().trim().min(1)).max(200),
        allowedPaths: z.array(z.string().trim().min(1)).max(200),
    });

const workspaceAgentContextTelemetrySchema: z.ZodType<WorkspaceAgentContextTelemetry> =
    z.object({
        model: z.string().trim().min(1),
        provider: z.string().trim().min(1),
        strategy: z.enum(['reasoning-first', 'balanced', 'local-first-simple']),
        contextWindow: z.number().int().positive(),
        usedTokens: z.number().int().nonnegative(),
        remainingTokens: z.number().int().nonnegative(),
        usagePercent: z.number().min(0).max(100),
        pressureState: z.enum(['low', 'medium', 'high']),
        handoffCount: z.number().int().nonnegative(),
        lastHandoffAt: z.number().int().nonnegative().optional(),
        lastHandoffLabel: z.string().trim().max(200).optional(),
    });

const councilChairmanSelectionSchema: z.ZodType<CouncilChairmanSelection> = z.object({
    mode: z.enum(['auto', 'manual']),
    provider: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    agentId: z.string().trim().min(1).optional(),
});

const councilRunConfigSchema: z.ZodType<CouncilRunConfig> = z.object({
    enabled: z.boolean(),
    chairman: councilChairmanSelectionSchema,
    strategy: z.enum(['reasoning-first', 'balanced', 'local-first-simple']),
    requestedSubagentCount: z.union([
        z.literal('auto'),
        z.number().int().min(2).max(30),
    ]),
    activeView: z.enum(['board', 'map']),
});

const councilSubagentRuntimeSchema: z.ZodType<CouncilSubagentRuntime> = z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    provider: z.string().trim().min(1),
    model: z.string().trim().min(1),
    workspaceId: z.string().trim().min(1),
    status: z.enum(['idle', 'working', 'assisting', 'reviewing', 'completed']),
    stageGoal: z.string().trim().min(1),
    progressPercent: z.number().min(0).max(100),
    helpAvailable: z.boolean(),
    ownerStageId: z.string().trim().min(1).optional(),
});

const councilSubagentWorkspaceDraftSchema: z.ZodType<CouncilSubagentWorkspaceDraft> =
    z.object({
        id: z.string().trim().min(1),
        agentId: z.string().trim().min(1),
        workspaceId: z.string().trim().min(1),
        baseRevision: z.string().trim().min(1),
        changedFiles: z.array(z.string().trim().min(1)).max(500),
        patchSummary: z.string().trim().min(1),
        riskFlags: z.array(z.string().trim().min(1)).max(100),
        submittedAt: z.number().int().nonnegative(),
    });

const councilReviewDecisionSchema: z.ZodType<CouncilReviewDecision> = z.object({
    draftId: z.string().trim().min(1),
    decision: z.enum(['approve', 'reject', 'revise', 'reassign-model']),
    chairmanAgentId: z.string().trim().min(1).optional(),
    note: z.string().trim().max(2000).optional(),
    decidedAt: z.number().int().nonnegative(),
});

const councilAssistEventSchema: z.ZodType<CouncilAssistEvent> = z.object({
    id: z.string().trim().min(1),
    taskId: z.string().trim().min(1),
    stageId: z.string().trim().min(1),
    ownerAgentId: z.string().trim().min(1),
    helperAgentId: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    createdAt: z.number().int().nonnegative(),
});

const councilInterAgentMessageSchema: z.ZodType<CouncilInterAgentMessage> = z.object({
    id: z.string().trim().min(1),
    taskId: z.string().trim().min(1),
    stageId: z.string().trim().min(1).optional(),
    fromAgentId: z.string().trim().min(1),
    toAgentId: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1),
    createdAt: z.number().int().nonnegative(),
    channel: z.enum(['private', 'group']),
});

export const workspaceAgentSessionSummarySchema = z.object({
    id: z.string().trim().min(1),
    workspaceId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    status: z.enum(WORKSPACE_AGENT_SESSION_STATUSES),
    updatedAt: z.number().int().nonnegative(),
    createdAt: z.number().int().nonnegative(),
    messageCount: z.number().int().nonnegative(),
    lastMessagePreview: z.string().trim().max(280).optional(),
    modes: workspaceAgentSessionModesSchema,
    strategy: z.enum(['reasoning-first', 'balanced', 'local-first-simple']),
    permissionPolicy: workspaceAgentPermissionPolicySchema,
    contextTelemetry: workspaceAgentContextTelemetrySchema.optional(),
    councilConfig: councilRunConfigSchema.optional(),
    background: z.boolean(),
    archived: z.boolean(),
});

export const workspaceAgentSessionSchema = workspaceAgentSessionSummarySchema.extend({
    chatId: z.string().trim().min(1),
    metadata: z.record(z.string(), z.unknown()),
    council: z.object({
        chairman: councilSubagentRuntimeSchema.optional(),
        subagents: z.array(councilSubagentRuntimeSchema),
        drafts: z.array(councilSubagentWorkspaceDraftSchema),
        reviewQueue: z.array(councilSubagentWorkspaceDraftSchema),
        decisions: z.array(councilReviewDecisionSchema),
        assistEvents: z.array(councilAssistEventSchema),
        messages: z.array(councilInterAgentMessageSchema),
    }),
});

export const workspaceAgentSessionPersistenceSchema = z.object({
    activeSessionId: z.string().trim().min(1).nullable(),
    recentSessionIds: z.array(z.string().trim().min(1)).max(200),
    composerDraft: z.string().max(20000),
    updatedAt: z.number().int().nonnegative(),
});

const quotaWindowSchema: z.ZodType<QuotaWindow> = z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    remaining: z.number().nonnegative(),
    total: z.number().positive(),
    resetAt: z.string().trim().min(1).optional(),
});

const quotaBucketSchema: z.ZodType<QuotaBucket> = z.object({
    id: z.string().trim().min(1),
    provider: z.string().trim().min(1),
    accountId: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1),
    models: z.array(z.string().trim().min(1)).max(300),
    windows: z.array(quotaWindowSchema).max(20),
});

const modelCostProfileSchema: z.ZodType<ModelCostProfile> = z.object({
    provider: z.string().trim().min(1),
    model: z.string().trim().min(1),
    reasoningWeight: z.number(),
    speedWeight: z.number(),
    local: z.boolean(),
    creditMultiplier: z.number().positive().optional(),
    requestLimited: z.boolean().optional(),
});

const providerFallbackCandidateSchema: z.ZodType<ProviderFallbackCandidate> =
    z.object({
        provider: z.string().trim().min(1),
        model: z.string().trim().min(1),
        accountId: z.string().trim().min(1).optional(),
        bucketId: z.string().trim().min(1).optional(),
        score: z.number(),
        reason: z.string().trim().min(1),
    });

export const normalizedQuotaSnapshotSchema: z.ZodType<NormalizedQuotaSnapshot> = z.object({
    generatedAt: z.number().int().nonnegative(),
    buckets: z.array(quotaBucketSchema).max(500),
    models: z.array(modelCostProfileSchema).max(1000),
    fallbackCandidates: z.array(providerFallbackCandidateSchema).max(1000),
});

export const workspaceAgentSessionListRequestSchema = z.tuple([z.string().trim().min(1)]);
export const workspaceAgentSessionCreateRequestSchema = z.tuple([
    z.object({
        workspaceId: z.string().trim().min(1),
        title: z.string().trim().min(1).max(120),
        modes: workspaceAgentSessionModesSchema.optional(),
        strategy: z
            .enum(['reasoning-first', 'balanced', 'local-first-simple'])
            .optional(),
        permissionPolicy: workspaceAgentPermissionPolicySchema.optional(),
    }),
]);
export const workspaceAgentSessionRenameRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().trim().min(1),
        title: z.string().trim().min(1).max(120),
    }),
]);
export const workspaceAgentSessionSelectRequestSchema = z.tuple([
    z.object({
        workspaceId: z.string().trim().min(1),
        sessionId: z.string().trim().min(1).nullable(),
    }),
]);
export const workspaceAgentSessionPersistenceUpdateRequestSchema = z.tuple([
    z.object({
        workspaceId: z.string().trim().min(1),
        activeSessionId: z.string().trim().min(1).nullable().optional(),
        recentSessionIds: z.array(z.string().trim().min(1)).max(200).optional(),
        composerDraft: z.string().max(20000).optional(),
    }),
]);
export const workspaceAgentSessionUpdateModesRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().trim().min(1),
        modes: workspaceAgentSessionModesSchema,
        status: z.enum(WORKSPACE_AGENT_SESSION_STATUSES).optional(),
    }),
]);
export const workspaceAgentSessionUpdatePermissionsRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().trim().min(1),
        permissionPolicy: workspaceAgentPermissionPolicySchema,
    }),
]);
export const workspaceAgentSessionUpdateStrategyRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().trim().min(1),
        strategy: z.enum(['reasoning-first', 'balanced', 'local-first-simple']),
    }),
]);
export const workspaceAgentSessionArchiveRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().trim().min(1),
        archived: z.boolean(),
    }),
]);
export const workspaceAgentSessionResumeRequestSchema = z.tuple([
    z.object({
        workspaceId: z.string().trim().min(1),
        activeSessionId: z.string().trim().min(1).nullable(),
    }),
]);
export const workspaceAgentSessionTelemetryRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().trim().min(1),
    }),
]);

export const workspaceAgentSessionListResponseSchema = z.object({
    sessions: z.array(workspaceAgentSessionSummarySchema),
    persistence: workspaceAgentSessionPersistenceSchema,
});
export const workspaceAgentSessionResponseSchema = workspaceAgentSessionSchema;
export const workspaceAgentContextTelemetryResponseSchema =
    workspaceAgentContextTelemetrySchema.nullable();
export const workspaceAgentSessionPersistenceResponseSchema =
    workspaceAgentSessionPersistenceSchema;
export const workspaceAgentSessionStatusResponseSchema: z.ZodType<WorkspaceAgentSessionStatus> =
    z.enum(WORKSPACE_AGENT_SESSION_STATUSES);
