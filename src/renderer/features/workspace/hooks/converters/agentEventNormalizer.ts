import { z } from 'zod';

const agentEventDataSchema = z
    .object({
        taskId: z.string(),
        description: z.string().optional(),
        error: z.string().optional(),
        state: z.string().optional(),
        toolCallId: z.string().optional(),
        toolName: z.string().optional(),
        duration: z.number().optional(),
        tokensUsed: z.number().optional(),
        stepIndex: z.number().optional(),
        provider: z.string().optional(),
        fromProvider: z.string().optional(),
        toProvider: z.string().optional(),
        reason: z.string().optional(),
        message: z.string().optional(),
        content: z.string().optional(),
        thoughts: z.string().optional(),
        currentProvider: z.string().optional(),
        currentModel: z.string().optional(),
        errorType: z.string().optional(),
        metrics: z.record(z.string(), z.unknown()).optional(),
        plan: z
            .object({
                steps: z.array(
                    z.object({
                        id: z.string().optional(),
                        index: z.number().optional(),
                        description: z.string(),
                        thoughts: z.string().optional(),
                    })
                ),
                requiredTools: z.array(z.string()).optional(),
                dependencies: z.array(z.string()).optional(),
            })
            .optional(),
    })
    .passthrough();

const agentEventEnvelopeSchema = z.object({
    v: z.literal('v1').optional(),
    dedupeKey: z.string().optional(),
    emittedAt: z.number().optional(),
    type: z.string(),
    data: agentEventDataSchema,
});

export type NormalizedAgentEvent = z.infer<typeof agentEventEnvelopeSchema>;

export const normalizeAgentEventPayload = (payload: RendererDataValue): NormalizedAgentEvent | null => {
    const parsed = agentEventEnvelopeSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
};
