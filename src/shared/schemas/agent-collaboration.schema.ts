import { z } from 'zod';

/**
 * Zod schemas for Agent Collaboration Service
 * 
 * NASA Power of Ten Compliance:
 * - Rule #8: Simple type definitions (reflected in schemas)
 */

export const TaskTypeSchema = z.enum([
    'code_generation',
    'code_review',
    'research',
    'documentation',
    'debugging',
    'testing',
    'refactoring',
    'planning',
    'general'
]);

export const ModelRoutingRuleSchema = z.object({
    taskType: TaskTypeSchema,
    provider: z.string().min(1),
    model: z.string().min(1),
    priority: z.number().int().min(0)
});

export const ModelVoteSchema = z.object({
    modelId: z.string().min(1),
    provider: z.string().min(1),
    decision: z.string().min(1),
    confidence: z.number().min(0).max(100),
    reasoning: z.string().optional(),
    timestamp: z.number().int().positive()
});

export const VotingSessionSchema = z.object({
    id: z.string().uuid(),
    taskId: z.string().min(1),
    stepIndex: z.number().int().min(0),
    question: z.string().min(1),
    options: z.array(z.string()).min(1),
    votes: z.array(ModelVoteSchema),
    status: z.enum(['pending', 'voting', 'resolved', 'deadlocked']),
    finalDecision: z.string().optional(),
    resolutionSource: z.enum(['automatic', 'manual_override']).optional(),
    overrideReason: z.string().optional(),
    createdAt: z.number().int().positive(),
    resolvedAt: z.number().int().positive().optional()
});

export const VotingConfigurationSchema = z.object({
    minimumVotes: z.number().int().min(1),
    deadlockThreshold: z.number().min(0).max(1),
    autoResolve: z.boolean(),
    autoResolveTimeoutMs: z.number().int().min(0)
});

export const DebateSideSchema = z.enum(['pro', 'con']);

export const DebateCitationSchema = z.object({
    sourceId: z.string().min(1),
    title: z.string().optional(),
    url: z.string().url().optional(),
    excerpt: z.string().optional()
});

export const DebateArgumentSchema = z.object({
    id: z.string().uuid(),
    agentId: z.string().min(1),
    provider: z.string().min(1),
    side: DebateSideSchema,
    content: z.string().min(1),
    confidence: z.number().min(0).max(100),
    qualityScore: z.number().min(0).max(100),
    citations: z.array(DebateCitationSchema),
    timestamp: z.number().int().positive()
});

export const DebateConsensusSchema = z.object({
    detected: z.boolean(),
    winningSide: z.enum(['pro', 'con', 'balanced']).optional(),
    confidence: z.number().min(0).max(100),
    rationale: z.string().min(1)
});

export const DebateSessionSchema = z.object({
    id: z.string().uuid(),
    taskId: z.string().min(1),
    stepIndex: z.number().int().min(0),
    topic: z.string().min(1),
    status: z.enum(['open', 'resolved']),
    arguments: z.array(DebateArgumentSchema),
    consensus: DebateConsensusSchema,
    summary: z.string().optional(),
    createdAt: z.number().int().positive(),
    resolvedAt: z.number().int().positive().optional()
});
