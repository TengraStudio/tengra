import type { JsonValue } from '@shared/types/common';
import { z } from 'zod';

import {
    AgentCollaborationIntentSchema,
    AgentCollaborationPrioritySchema,
    AutomationWorkflowStepSchema,
    DebateArgumentSchema,
    DebateCitationSchema,
    DebateSessionSchema,
    DebateSideSchema,
    VotingConfigurationSchema,
    VotingSessionSchema,
} from './automation-workflow-hardening.schema';

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(jsonValueSchema),
        z.record(z.string(), jsonValueSchema),
    ])
);

const collaborationPayloadSchema = z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()])
);

const providerModelSchema = z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
});

const conflictingPointSchema = z.object({
    topic: z.string().min(1),
    outputs: z.array(
        z.object({
            modelId: z.string().min(1),
            output: z.string().min(1),
        })
    ),
});

const agentTaskCompletionMetricSchema = z.object({
    agentId: z.string().min(1),
    completedTasks: z.number().int().nonnegative(),
    failedTasks: z.number().int().nonnegative(),
    inProgressTasks: z.number().int().nonnegative(),
    averageTaskDurationMs: z.number().nonnegative(),
    completionRate: z.number().nonnegative(),
});

const agentHealthSignalSchema = z.object({
    agentId: z.string().min(1),
    status: z.enum(['healthy', 'warning', 'critical']),
    failureRate: z.number().nonnegative(),
    averageConfidence: z.number().nonnegative(),
});

const timelineEventSchema = z.record(z.string(), jsonValueSchema.optional());

export const VotingAnalyticsSchema = z.object({
    totalSessions: z.number().int().nonnegative(),
    pendingSessions: z.number().int().nonnegative(),
    resolvedSessions: z.number().int().nonnegative(),
    deadlockedSessions: z.number().int().nonnegative(),
    averageVotesPerSession: z.number().nonnegative(),
    averageConfidence: z.number().nonnegative(),
    disagreementIndex: z.number().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
});

export const VotingTemplateSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    questionTemplate: z.string().min(1),
    options: z.array(z.string().min(1)).min(1),
    isBuiltIn: z.boolean(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
});

export const ConsensusResultSchema = z.object({
    agreed: z.boolean(),
    mergedOutput: z.string().optional(),
    conflictingPoints: z.array(conflictingPointSchema).optional(),
    resolutionMethod: z.enum(['unanimous', 'majority', 'arbitration', 'manual']),
});

export const DebateReplaySchema = z.object({
    session: DebateSessionSchema,
    timeline: z.array(DebateArgumentSchema),
});

export const AgentCollaborationMessageSchema = z.object({
    id: z.string().min(1),
    taskId: z.string().min(1),
    stageId: z.string().min(1),
    fromAgentId: z.string().min(1),
    toAgentId: z.string().min(1).optional(),
    channel: z.enum(['private', 'group']),
    intent: AgentCollaborationIntentSchema,
    priority: AgentCollaborationPrioritySchema,
    payload: collaborationPayloadSchema,
    createdAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().nonnegative().optional(),
});

export const WorkerAvailabilityRecordSchema = z.object({
    taskId: z.string().min(1),
    agentId: z.string().min(1),
    status: z.enum(['available', 'busy', 'offline']),
    availableAt: z.number().int().nonnegative().optional(),
    lastActiveAt: z.number().int().nonnegative(),
    reason: z.string().optional(),
    skills: z.array(z.string().min(1)),
    contextReadiness: z.number().nonnegative(),
    completedStages: z.number().int().nonnegative(),
    failedStages: z.number().int().nonnegative(),
});

export const HelperCandidateScoreSchema = z.object({
    taskId: z.string().min(1),
    stageId: z.string().min(1),
    agentId: z.string().min(1),
    score: z.number(),
    skillMatch: z.number(),
    contextReadiness: z.number(),
    idleBonus: z.number(),
    rationale: z.array(z.string().min(1)),
});

export const HelperHandoffPackageSchema = z.object({
    taskId: z.string().min(1),
    stageId: z.string().min(1),
    ownerAgentId: z.string().min(1),
    helperAgentId: z.string().min(1),
    contextSummary: z.string().min(1),
    acceptanceCriteria: z.array(z.string().min(1)),
    constraints: z.array(z.string().min(1)),
    generatedAt: z.number().int().nonnegative(),
});

export const HelperMergeGateDecisionSchema = z.object({
    accepted: z.boolean(),
    verdict: z.enum(['ACCEPT', 'REVISE', 'REJECT']),
    reasons: z.array(z.string().min(1)),
    requiredFixes: z.array(z.string().min(1)),
    reviewedAt: z.number().int().nonnegative(),
});

export const QuotaInterruptResultSchema = z.object({
    success: z.boolean(),
    interruptId: z.string().min(1),
    checkpointId: z.string().min(1).optional(),
    blockedByQuota: z.boolean(),
    switched: z.boolean(),
    selectedFallback: providerModelSchema.optional(),
    availableFallbacks: z.array(providerModelSchema),
    message: z.string().min(1),
});

export const AgentTeamworkAnalyticsSchema = z.object({
    perAgentMetrics: z.array(agentTaskCompletionMetricSchema),
    collaborationPatterns: z.object({
        votingParticipationRate: z.number().nonnegative(),
        debateParticipationRate: z.number().nonnegative(),
        consensusAlignmentRate: z.number().nonnegative(),
    }),
    efficiencyScores: z.record(z.string(), z.number()),
    resourceAllocationInsights: z.array(z.string().min(1)),
    healthSignals: z.array(agentHealthSignalSchema),
    comparisonReport: z.string().min(1),
    productivityRecommendations: z.array(z.string().min(1)),
    updatedAt: z.number().int().nonnegative(),
});

export const sessionCouncilNoArgsRequestSchema = z.tuple([]);

export const sessionCouncilSessionIdRequestSchema = z.tuple([z.string().min(1)]);

export const sessionCouncilOptionalTaskRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1).optional(),
    }).optional(),
]);

export const sessionCouncilGeneratePlanRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        task: z.string().min(1),
    }),
]);

export const sessionCouncilGetProposalRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
    }),
]);

export const sessionCouncilApproveProposalRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
    }),
]);

export const sessionCouncilRejectProposalRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        reason: z.string().optional(),
    }),
]);

export const sessionCouncilTimelineRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
    }),
]);

export const sessionCouncilCreateVotingSessionRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        stepIndex: z.number().int().nonnegative(),
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
    }),
]);

export const sessionCouncilSubmitVoteRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().min(1),
        modelId: z.string().min(1),
        provider: z.string().min(1),
        decision: z.string().min(1),
        confidence: z.number().min(0).max(100),
        reasoning: z.string().optional(),
    }),
]);

export const sessionCouncilRequestVotesRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().min(1),
        models: z.array(providerModelSchema).min(1),
    }),
]);

export const sessionCouncilUpdateVotingConfigurationRequestSchema = z.tuple([
    VotingConfigurationSchema.partial(),
]);

export const sessionCouncilOverrideVotingDecisionRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().min(1),
        finalDecision: z.string().min(1),
        reason: z.string().optional(),
    }),
]);

export const sessionCouncilBuildConsensusRequestSchema = z.tuple([
    z.array(
        z.object({
            modelId: z.string().min(1),
            provider: z.string().min(1),
            output: z.string().min(1),
        })
    ),
]);

export const sessionCouncilCreateDebateSessionRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        stepIndex: z.number().int().nonnegative(),
        topic: z.string().min(1),
    }),
]);

export const sessionCouncilSubmitDebateArgumentRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().min(1),
        agentId: z.string().min(1),
        provider: z.string().min(1),
        side: DebateSideSchema,
        content: z.string().min(1),
        confidence: z.number().min(0).max(100),
        citations: z.array(DebateCitationSchema).optional(),
    }),
]);

export const sessionCouncilOverrideDebateSessionRequestSchema = z.tuple([
    z.object({
        sessionId: z.string().min(1),
        moderatorId: z.string().min(1),
        decision: z.union([DebateSideSchema, z.literal('balanced')]),
        reason: z.string().optional(),
    }),
]);

export const sessionCouncilSendMessageRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        stageId: z.string().min(1),
        fromAgentId: z.string().min(1),
        toAgentId: z.string().min(1).optional(),
        intent: AgentCollaborationIntentSchema,
        priority: AgentCollaborationPrioritySchema.optional(),
        payload: collaborationPayloadSchema,
        expiresAt: z.number().int().nonnegative().optional(),
    }),
]);

export const sessionCouncilGetMessagesRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        stageId: z.string().min(1).optional(),
        agentId: z.string().min(1).optional(),
        includeExpired: z.boolean().optional(),
    }),
]);

export const sessionCouncilQuotaInterruptRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        stageId: z.string().min(1).optional(),
        provider: z.string().min(1),
        model: z.string().min(1),
        reason: z.string().optional(),
        autoSwitch: z.boolean().optional(),
    }),
]);

export const sessionCouncilRegisterWorkerAvailabilityRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        agentId: z.string().min(1),
        status: z.enum(['available', 'busy', 'offline']),
        reason: z.string().optional(),
        skills: z.array(z.string().min(1)).optional(),
        contextReadiness: z.number().nonnegative().optional(),
    }),
]);

export const sessionCouncilListAvailableWorkersRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
    }),
]);

export const sessionCouncilScoreHelperCandidatesRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        stageId: z.string().min(1),
        requiredSkills: z.array(z.string().min(1)),
        blockedAgentIds: z.array(z.string().min(1)).optional(),
        contextReadinessOverrides: z.record(z.string(), z.number()).optional(),
    }),
]);

export const sessionCouncilGenerateHelperHandoffRequestSchema = z.tuple([
    z.object({
        taskId: z.string().min(1),
        stageId: z.string().min(1),
        ownerAgentId: z.string().min(1),
        helperAgentId: z.string().min(1),
        stageGoal: z.string().min(1),
        acceptanceCriteria: z.array(z.string().min(1)),
        constraints: z.array(z.string().min(1)),
        contextNotes: z.string().optional(),
    }),
]);

export const sessionCouncilReviewHelperMergeRequestSchema = z.tuple([
    z.object({
        acceptanceCriteria: z.array(z.string().min(1)),
        constraints: z.array(z.string().min(1)),
        helperOutput: z.string().min(1),
        reviewerNotes: z.string().optional(),
    }),
]);

export const sessionCouncilBooleanResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

export const sessionCouncilProposalResponseSchema = z.object({
    success: z.boolean(),
    plan: z.array(AutomationWorkflowStepSchema).optional(),
    error: z.string().optional(),
});

export const sessionCouncilTimelineResponseSchema = z.object({
    success: z.boolean(),
    events: z.array(timelineEventSchema).optional(),
    error: z.string().optional(),
});

export const sessionCouncilVotingSessionsResponseSchema = z.array(VotingSessionSchema);
export const sessionCouncilVotingAnalyticsResponseSchema = VotingAnalyticsSchema;
export const sessionCouncilVotingConfigurationResponseSchema = VotingConfigurationSchema;
export const sessionCouncilVotingTemplatesResponseSchema = z.array(VotingTemplateSchema);
export const sessionCouncilCreateVotingSessionResponseSchema = VotingSessionSchema.nullable();
export const sessionCouncilSubmitVoteResponseSchema = VotingSessionSchema.nullable();
export const sessionCouncilRequestVotesResponseSchema = VotingSessionSchema.nullable();
export const sessionCouncilResolveVotingResponseSchema = VotingSessionSchema.nullable();
export const sessionCouncilGetVotingSessionResponseSchema = VotingSessionSchema.nullable();
export const sessionCouncilUpdateVotingConfigurationResponseSchema = VotingConfigurationSchema;
export const sessionCouncilOverrideVotingDecisionResponseSchema = VotingSessionSchema.nullable();
export const sessionCouncilBuildConsensusResponseSchema = ConsensusResultSchema.nullable();

export const sessionCouncilCreateDebateSessionResponseSchema = DebateSessionSchema.nullable();
export const sessionCouncilSubmitDebateArgumentResponseSchema = DebateSessionSchema.nullable();
export const sessionCouncilResolveDebateSessionResponseSchema = DebateSessionSchema.nullable();
export const sessionCouncilOverrideDebateSessionResponseSchema = DebateSessionSchema.nullable();
export const sessionCouncilGetDebateSessionResponseSchema = DebateSessionSchema.nullable();
export const sessionCouncilListDebateHistoryResponseSchema = z.array(DebateSessionSchema);
export const sessionCouncilGetDebateReplayResponseSchema = DebateReplaySchema.nullable();
export const sessionCouncilGenerateDebateSummaryResponseSchema = z.string().nullable();
export const sessionCouncilTeamworkAnalyticsResponseSchema = AgentTeamworkAnalyticsSchema.nullable();

export const sessionCouncilSendMessageResponseSchema = AgentCollaborationMessageSchema.nullable();
export const sessionCouncilGetMessagesResponseSchema = z.array(AgentCollaborationMessageSchema);
export const sessionCouncilCleanupExpiredMessagesResponseSchema = z.object({
    success: z.literal(true),
    removed: z.number().int().nonnegative(),
});
export const sessionCouncilQuotaInterruptResponseSchema = QuotaInterruptResultSchema.nullable();
export const sessionCouncilRegisterWorkerAvailabilityResponseSchema =
    WorkerAvailabilityRecordSchema.nullable();
export const sessionCouncilListAvailableWorkersResponseSchema = z.array(
    WorkerAvailabilityRecordSchema
);
export const sessionCouncilScoreHelperCandidatesResponseSchema = z.array(
    HelperCandidateScoreSchema
);
export const sessionCouncilGenerateHelperHandoffResponseSchema =
    HelperHandoffPackageSchema.nullable();
export const sessionCouncilReviewHelperMergeResponseSchema = HelperMergeGateDecisionSchema;

