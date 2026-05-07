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

import { AppSettings } from '@/types/settings';

const settingsSearchQuerySchema = z.string().max(120);

const settingsPayloadSchema = z.object({
    general: z.object({
        language: z.string().trim().min(2).max(8),
        theme: z.string().trim().min(1).max(32),
        resolution: z.string().trim().min(3).max(64),
        fontSize: z.number().int().min(10).max(48),
        chatMode: z.enum(['instant', 'thinking', 'agent']).optional(),

    }),
    embeddings: z.object({
        provider: z.enum(['ollama', 'openai', 'llama', 'none']),
        model: z.string().optional(),
    }),
    ollama: z.object({
        url: z.string().trim().min(1).max(2048),
    }).optional(),
    llama: z.object({
        host: z.string().trim().min(1).max(255).optional(),
        port: z.number().int().min(1).max(65535).optional(),
        backend: z.enum(['auto', 'cpu', 'cuda', 'vulkan', 'metal']).optional(),
        gpuLayers: z.number().int().min(-1).max(999).optional(),
        contextSize: z.number().int().min(256).max(1048576).optional(),
        batchSize: z.number().int().min(1).max(1048576).optional(),
        ubatchSize: z.number().int().min(1).max(1048576).optional(),
        parallel: z.number().int().min(1).max(128).optional(),
        threads: z.number().int().min(1).max(512).optional(),
        threadsBatch: z.number().int().min(1).max(512).optional(),
        flashAttn: z.boolean().optional(),
        continuousBatching: z.boolean().optional(),
        mlock: z.boolean().optional(),
        mmap: z.boolean().optional(),
        defragThold: z.number().min(0).max(1).optional(),
        metrics: z.boolean().optional(),
        mainGpu: z.number().int().min(0).max(32).optional(),
        tensorSplit: z.string().trim().max(255).optional(),
        sleepIdleSeconds: z.number().int().min(0).max(86400).optional(),
        extraArgs: z.string().max(2048).optional(),
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

