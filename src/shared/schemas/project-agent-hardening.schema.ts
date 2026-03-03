import { z } from 'zod';

/**
 * AGT-TPL: Agent profile schema
 */
export const AgentProfileSchema = z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    persona: z.string(),
    systemPrompt: z.string(),
    skills: z.array(z.string())
});

/**
 * Status for a single project step
 */
export const ProjectStepStatusSchema = z.enum([
    'pending',
    'running',
    'completed',
    'failed',
    'skipped',
    'awaiting_step_approval'
]);

/**
 * AGT-PLN: Individual project execution step
 */
/**
 * AGT-PLN: Individual project execution step
 */
export const ProjectStepSchema = z.object({
    id: z.string(),
    text: z.string(),
    status: ProjectStepStatusSchema,
    type: z.enum(['task', 'fork', 'join']).optional(),
    dependsOn: z.array(z.string()).optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
    parallelLane: z.number().optional(),
    branchId: z.string().optional(),
    groupId: z.string().optional(),
    groupName: z.string().optional(),
    timing: z.object({
        startedAt: z.number().optional(),
        completedAt: z.number().optional(),
        durationMs: z.number().optional()
    }).optional(),
    tokens: z.object({
        prompt: z.number(),
        completion: z.number()
    }).optional(),
    estimatedCost: z.object({
        inputTokens: z.number(),
        outputTokens: z.number(),
        totalTokens: z.number(),
        costUsd: z.number()
    }).optional(),
    actualCost: z.object({
        inputTokens: z.number(),
        outputTokens: z.number(),
        totalTokens: z.number(),
        costUsd: z.number()
    }).optional(),
    confidence: z.object({
        score: z.number(),
        factors: z.object({
            complexity: z.number(),
            specificity: z.number(),
            toolAvailability: z.number(),
            historicalSuccess: z.number()
        }),
        explanation: z.string().optional()
    }).optional(),
    requiresApproval: z.boolean().optional(),
    isSkippable: z.boolean().optional(),
    isInterventionPoint: z.boolean().optional()
});

/**
 * Options for starting an agent task
 */
export const AgentStartOptionsSchema = z.object({
    task: z.string().min(1).max(4000),
    nodeId: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
    model: z.object({
        provider: z.string(),
        model: z.string()
    }).optional(),
    projectId: z.string().optional(),
    agentProfileId: z.string().optional(),
    attachments: z.array(z.object({
        name: z.string(),
        path: z.string(),
        size: z.number()
    })).optional(),
    systemMode: z.enum(['fast', 'thinking', 'architect']).optional(),
    budgetLimitUsd: z.number().optional(),
    locale: z.string().optional(),
    executionMode: z.enum(['sequential', 'parallel']).optional()
});

/**
 * MARCH1-IPC-001: Project state for UI synchronization
 */
/**
 * MARCH1-IPC-001: Project state for UI synchronization
 */
export const ProjectStateSchema = z.object({
    status: z.enum([
        'idle',
        'planning',
        'waiting_for_approval',
        'running',
        'paused',
        'failed',
        'completed',
        'error'
    ]),
    currentTask: z.string(),
    taskId: z.string().optional(),
    plan: z.array(ProjectStepSchema),
    history: z.array(z.any()),
    lastError: z.string().optional(),
    config: AgentStartOptionsSchema.optional(),
    nodeId: z.string().optional(),
    totalTokens: z.object({
        prompt: z.number(),
        completion: z.number()
    }).optional(),
    timing: z.object({
        startedAt: z.number().optional(),
        completedAt: z.number().optional()
    }).optional(),
    estimatedPlanCost: z.any().optional(),
    actualPlanCost: z.any().optional(),
    performanceMetrics: z.any().optional()
});

/**
 * Intent for agent collaboration
 */
export const AgentCollaborationIntentSchema = z.enum([
    'REQUEST_HELP',
    'SHARE_CONTEXT',
    'PROPOSE_CHANGE',
    'BLOCKER_REPORT'
]);

/**
 * Priority for agent collaboration
 */
export const AgentCollaborationPrioritySchema = z.enum([
    'low',
    'normal',
    'high',
    'urgent'
]);

/**
 * AGT-COL: Model routing rule
 */
export const ModelRoutingRuleSchema = z.object({
    taskType: z.enum([
        'code_generation',
        'code_review',
        'research',
        'documentation',
        'debugging',
        'testing',
        'refactoring',
        'planning',
        'general'
    ]),
    provider: z.string(),
    model: z.string(),
    priority: z.number()
});

/**
 * Member vote recorded in a session
 */
export const ModelVoteSchema = z.object({
    modelId: z.string(),
    provider: z.string(),
    decision: z.string(),
    confidence: z.number().min(0).max(100),
    reasoning: z.string().optional(),
    timestamp: z.number()
});

/**
 * AGT-COL: Multi-model voting session
 */
export const VotingSessionSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    stepIndex: z.number().int().nonnegative(),
    question: z.string(),
    options: z.array(z.string()),
    votes: z.array(ModelVoteSchema),
    status: z.enum(['pending', 'voting', 'resolved', 'deadlocked']),
    finalDecision: z.string().optional(),
    resolutionSource: z.enum(['automatic', 'manual_override']).optional(),
    overrideReason: z.string().optional(),
    createdAt: z.number()
});

/**
 * Global voting configuration
 */
export const VotingConfigurationSchema = z.object({
    minimumVotes: z.number().int().positive(),
    deadlockThreshold: z.number().min(0).max(1),
    autoResolve: z.boolean(),
    autoResolveTimeoutMs: z.number().int().positive()
});

/**
 * AGENT-13: Dispute side for debate
 */
export const DebateSideSchema = z.enum(['pro', 'con']);

/**
 * AGENT-13: Debate citation
 */
export const DebateCitationSchema = z.object({
    sourceId: z.string(),
    title: z.string().optional(),
    url: z.string().url().optional(),
    excerpt: z.string().optional()
});

/**
 * Agent argument for a debate
 */
export const DebateArgumentSchema = z.object({
    id: z.string(),
    agentId: z.string(),
    provider: z.string(),
    side: DebateSideSchema,
    content: z.string(),
    confidence: z.number().min(0).max(100),
    qualityScore: z.number().min(0).max(100),
    citations: z.array(DebateCitationSchema),
    timestamp: z.number()
});

/**
 * Multi-model debate consensus result
 */
export const DebateConsensusSchema = z.object({
    detected: z.boolean(),
    winningSide: z.union([DebateSideSchema, z.literal('balanced')]).optional(),
    confidence: z.number().min(0).max(100),
    rationale: z.string()
});

/**
 * Multi-model debate session
 */
export const DebateSessionSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    stepIndex: z.number().int().nonnegative(),
    topic: z.string(),
    status: z.enum(['open', 'resolved']),
    arguments: z.array(DebateArgumentSchema),
    consensus: DebateConsensusSchema,
    summary: z.string().optional(),
    createdAt: z.number(),
    resolvedAt: z.number().optional()
});
