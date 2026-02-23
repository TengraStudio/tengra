import { z } from 'zod';

export const CouncilGeneratePlanSchema = z.object({
    taskId: z.string().min(1),
    task: z.string().min(1),
});

export const CouncilGeneratePlanResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
});

export const CouncilGetProposalSchema = z.object({
    taskId: z.string().min(1)
});

// Since ProjectStep is complex, return the basic shape or use generic object array
export const CouncilGetProposalResponseSchema = z.object({
    success: z.boolean(),
    plan: z.array(z.record(z.string(), z.unknown())).optional(),
    error: z.string().optional()
});

export const CouncilApproveProposalSchema = z.object({
    taskId: z.string().min(1)
});

export const CouncilApproveProposalResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
});

export const CouncilRejectProposalSchema = z.object({
    taskId: z.string().min(1),
    reason: z.string().optional()
});

export const CouncilRejectProposalResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
});

export const CouncilStartExecutionSchema = z.object({
    taskId: z.string().min(1)
});

export const CouncilStartExecutionResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
});

export const CouncilPauseExecutionSchema = z.object({
    taskId: z.string().min(1)
});

export const CouncilPauseExecutionResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
});

export const CouncilResumeExecutionSchema = z.object({
    taskId: z.string().min(1)
});

export const CouncilResumeExecutionResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
});

export const CouncilGetTimelineSchema = z.object({
    taskId: z.string().min(1)
});

export const CouncilGetTimelineResponseSchema = z.object({
    success: z.boolean(),
    events: z.array(z.record(z.string(), z.unknown())).optional(),
    error: z.string().optional()
});

export const CouncilEventVersionSchema = z.literal('v1');

export const CouncilEventEnvelopeSchema = z.object({
    v: CouncilEventVersionSchema,
    dedupeKey: z.string().min(1),
    emittedAt: z.number().int().nonnegative(),
});

export const AgentStreamEventSchema = CouncilEventEnvelopeSchema.extend({
    type: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
});

export const QuotaInterruptEventSchema = CouncilEventEnvelopeSchema.extend({
    success: z.boolean(),
    interruptId: z.string().min(1),
    checkpointId: z.string().optional(),
    blockedByQuota: z.boolean(),
    switched: z.boolean(),
    selectedFallback: z
        .object({
            provider: z.string().min(1),
            model: z.string().min(1),
        })
        .optional(),
    availableFallbacks: z.array(
        z.object({
            provider: z.string().min(1),
            model: z.string().min(1),
        })
    ),
    message: z.string().min(1),
});
