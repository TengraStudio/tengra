/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { JsonValue } from '@shared/types/common';
import { z } from 'zod';

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

const timelineEventSchema = z.record(z.string(), jsonValueSchema.optional());

export const CouncilStepSchema = z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped', 'awaiting_step_approval']),
    type: z.enum(['task', 'fork', 'join']).optional(),
    dependsOn: z.array(z.string()).optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
    requiresApproval: z.boolean().optional(),
    modelConfig: z.object({
        provider: z.string(),
        model: z.string(),
        reason: z.string().optional()
    }).optional(),
    taskType: z.string().optional(),
    timing: z.object({
        startedAt: z.number().optional(),
        completedAt: z.number().optional(),
        durationMs: z.number().optional()
    }).optional()
});

export const sessionCouncilNoArgsRequestSchema = z.tuple([]);

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

export const sessionCouncilBooleanResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

export const sessionCouncilProposalResponseSchema = z.object({
    success: z.boolean(),
    plan: z.array(CouncilStepSchema).optional(),
    error: z.string().optional(),
});

export const sessionCouncilTimelineResponseSchema = z.object({
    success: z.boolean(),
    events: z.array(timelineEventSchema).optional(),
    error: z.string().optional(),
});
