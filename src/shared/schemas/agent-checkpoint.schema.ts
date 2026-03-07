import { z } from 'zod';

/**
 * Zod schemas for Agent Checkpoint Service
 * 
 * NASA Power of Ten Compliance:
 * - Rule #8: Simple type definitions
 */

export const AgentCheckpointTriggerSchema = z.enum([
    'manual_snapshot',
    'auto_step_completion',
    'auto_state_sync',
    'pre_rollback',
    'rollback_resume',
    'resume_restore'
]);

export const ProviderStatusSchema = z.enum(['active', 'quota_exceeded', 'error', 'unavailable']);

export const ProviderConfigSchema = z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    accountIndex: z.number().int().min(0),
    status: ProviderStatusSchema
});

export const PlanStepSchema = z.object({
    index: z.number().int().min(0),
    description: z.string().min(1),
    type: z.enum(['analysis', 'code_generation', 'refactoring', 'testing', 'documentation', 'deployment']),
    status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'skipped']),
    toolsUsed: z.array(z.string()),
    thoughts: z.string().optional(),
    startedAt: z.union([z.date(), z.string().datetime(), z.number()]).optional(),
    completedAt: z.union([z.date(), z.string().datetime(), z.number()]).optional()
});

export const ExecutionPlanSchema = z.object({
    steps: z.array(PlanStepSchema),
    estimatedDuration: z.number().optional(),
    requiredTools: z.array(z.string()),
    dependencies: z.array(z.string())
});

export const TaskMetricsSchema = z.object({
    duration: z.number().min(0),
    llmCalls: z.number().int().min(0),
    toolCalls: z.number().int().min(0),
    tokensUsed: z.number().int().min(0),
    providersUsed: z.array(z.string()),
    errorCount: z.number().int().min(0),
    recoveryCount: z.number().int().min(0),
    estimatedCost: z.number().optional()
});

export const AgentTaskStateSchema = z.object({
    taskId: z.string().min(1),
    workspaceId: z.string().min(1),
    description: z.string().min(1),
    state: z.string(), // Extensible enum from agent-state.ts
    currentStep: z.number().int().min(0),
    totalSteps: z.number().int().min(0),
    plan: ExecutionPlanSchema.nullable(),
    context: z.any(), // Deep nested context, for now any to avoid over-engineering if not critical
    messageHistory: z.array(z.any()),
    eventHistory: z.array(z.any()),
    currentProvider: ProviderConfigSchema,
    providerHistory: z.array(z.any()),
    errors: z.array(z.any()),
    recoveryAttempts: z.number().int().min(0),
    createdAt: z.union([z.date(), z.string().datetime(), z.number()]),
    updatedAt: z.union([z.date(), z.string().datetime(), z.number()]),
    startedAt: z.union([z.date(), z.string().datetime(), z.number()]).nullable(),
    completedAt: z.union([z.date(), z.string().datetime(), z.number()]).nullable(),
    metrics: TaskMetricsSchema,
    result: z.any().nullable()
});

export const AgentCheckpointSnapshotV1Schema = z.object({
    schemaVersion: z.literal(1),
    trigger: AgentCheckpointTriggerSchema,
    createdAt: z.number().int().positive(),
    state: AgentTaskStateSchema
});
