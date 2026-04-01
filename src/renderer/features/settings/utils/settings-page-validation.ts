import { z } from 'zod';

import { AppSettings } from '@/types/settings';

const settingsSearchQuerySchema = z.string().max(120);

const settingsPayloadSchema = z.object({
    general: z.object({
        language: z.string().trim().min(2).max(8),
        theme: z.string().trim().min(1).max(32),
        resolution: z.string().trim().min(3).max(64),
        fontSize: z.number().int().min(10).max(48),

    }),
    embeddings: z.object({
        provider: z.enum(['ollama', 'openai', 'llama', 'none']),
        model: z.string().optional(),
    }),
    ollama: z.object({
        url: z.string().trim().min(1).max(2048),
    }).optional(),
    proxy: z.object({
        enabled: z.boolean(),
        url: z.string().trim().min(1).max(2048),
        key: z.string().optional(),
    }).optional(),
}).passthrough();

export const settingsPageErrorCodes = {
    validation: 'SETTINGS_PAGE_VALIDATION_ERROR',
    loadFailed: 'SETTINGS_PAGE_LOAD_FAILED',
    saveFailed: 'SETTINGS_PAGE_SAVE_FAILED',
    factoryResetFailed: 'SETTINGS_PAGE_FACTORY_RESET_FAILED',
} as const;

export function normalizeSettingsSearchQuery(query: string): string {
    const normalized = query.trim();
    if (settingsSearchQuerySchema.safeParse(normalized).success) {
        return normalized;
    }
    return '';
}

export function validateSettingsSearchQuery(query: string): boolean {
    return settingsSearchQuerySchema.safeParse(query.trim()).success;
}

export function validateSettingsPayload(settings: AppSettings | null): boolean {
    if (!settings) {
        return false;
    }
    return settingsPayloadSchema.safeParse(settings).success;
}
