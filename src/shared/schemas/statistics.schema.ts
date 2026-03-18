import { z } from 'zod';

export const StatsPeriodSchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

export const TokenTimelineItemSchema = z.object({
    timestamp: z.number(),
    promptTokens: z.number(),
    completionTokens: z.number(),
    modelBreakdown: z.record(z.string(), z.object({
        prompt: z.number(),
        completion: z.number()
    })).optional()
});

export const DetailedStatsSchema = z.object({
    chatCount: z.number(),
    messageCount: z.number(),
    dbSize: z.number(),
    totalTokens: z.number(),
    promptTokens: z.number(),
    completionTokens: z.number(),
    tokenTimeline: z.array(TokenTimelineItemSchema),
    activity: z.array(z.number())
});

export const TimeTrackingStatsSchema = z.object({
    totalOnlineTime: z.number(),
    totalCodingTime: z.number(),
    workspaceCodingTime: z.record(z.string(), z.number())
});

export const TokenStatsSchema = z.object({
    totalSent: z.number(),
    totalReceived: z.number(),
    totalCost: z.number(),
    timeline: z.array(z.object({
        timestamp: z.number(),
        sent: z.number(),
        received: z.number()
    })),
    byProvider: z.record(z.string(), z.object({
        sent: z.number(),
        received: z.number(),
        cost: z.number()
    })),
    byModel: z.record(z.string(), z.object({
        sent: z.number(),
        received: z.number(),
        cost: z.number()
    }))
});
