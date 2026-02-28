import { z } from 'zod';

export const inlineSuggestionSourceSchema = z.enum(['copilot', 'custom']);

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

export type InlineSuggestionSource = z.infer<typeof inlineSuggestionSourceSchema>;
export type InlineSuggestionRequest = z.infer<typeof inlineSuggestionRequestSchema>;
export type InlineSuggestionResponse = z.infer<typeof inlineSuggestionResponseSchema>;
