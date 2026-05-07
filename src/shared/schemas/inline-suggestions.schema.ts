/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { z } from 'zod';

export const inlineSuggestionSourceSchema = z.enum(['copilot', 'custom']);
export const inlineSuggestionStatsEventSchema = z.enum([
    'request',
    'show',
    'accept',
    'reject',
    'cache_hit',
    'error',
]);

export const inlineSuggestionRequestSchema = z.object({
    prefix: z.string().min(1).max(16000),
    suffix: z.string().max(8000).optional(),
    language: z.string().min(1).max(64),
    cursorLine: z.number().int().positive(),
    cursorColumn: z.number().int().positive(),
    source: inlineSuggestionSourceSchema,
    model: z.string().min(1).max(200).optional(),
    provider: z.string().min(1).max(64).optional(),
    accountId: z.string().min(1).max(128).optional(),
    maxTokens: z.number().int().min(16).max(512).optional(),
});

export const inlineSuggestionResponseSchema = z.object({
    suggestion: z.string().nullable(),
    source: inlineSuggestionSourceSchema,
    model: z.string().min(1).max(200).optional(),
    provider: z.string().min(1).max(64).optional(),
});

export const inlineSuggestionStatsSchema = z.object({
    event: inlineSuggestionStatsEventSchema,
    source: inlineSuggestionSourceSchema,
    provider: z.string().min(1).max(64).optional(),
    model: z.string().min(1).max(200).optional(),
    language: z.string().min(1).max(64).optional(),
    cacheKey: z.string().min(1).max(256).optional(),
    latencyMs: z.number().int().min(0).max(60000).optional(),
    acceptedChars: z.number().int().min(0).max(16000).optional(),
    reason: z.string().min(1).max(256).optional(),
});

export type InlineSuggestionSource = z.infer<typeof inlineSuggestionSourceSchema>;
export type InlineSuggestionUsageStatsEvent = z.infer<
    typeof inlineSuggestionStatsEventSchema
>;
export type InlineSuggestionUsageStats = z.infer<typeof inlineSuggestionStatsSchema>;
export type InlineSuggestionRequest = z.infer<typeof inlineSuggestionRequestSchema>;
export type InlineSuggestionResponse = z.infer<typeof inlineSuggestionResponseSchema>;

