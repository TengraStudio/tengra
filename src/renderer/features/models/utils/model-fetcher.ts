/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Re-export shared types for backward compatibility
export type { GroupedModels, ModelInfo } from '@/types/model.types';

import type { GroupedModels, ModelInfo } from '@/types/model.types';
import { appLogger } from '@/utils/renderer-logger';

// Simple in-memory cache for model fetches
let modelCache: { data: ModelInfo[]; timestamp: number } | null = null;
let inFlightModelRequest: Promise<ModelInfo[]> | null = null;
const CACHE_DURATION_MS = 60000; // 1 minute cache

function normalizeProviderId(provider: string | undefined): string {
    const raw = (provider ?? '').trim().toLowerCase();
    if (raw === '') {
        return 'custom';
    }
    if (raw === 'github' || raw === 'github_token' || raw === 'copilot_token') {
        return 'copilot';
    }
    if (raw === 'nvidia_key' || raw === 'nim' || raw === 'nim_openai') {
        return 'nvidia';
    }
    return raw;
}

function normalizeProviderCategoryId(
    providerCategory: string | undefined,
    provider: string,
    sourceProvider?: string
): string {
    const raw = (providerCategory ?? '').trim().toLowerCase();
    if (raw !== '') {
        return normalizeProviderId(raw);
    }
    const source = (sourceProvider ?? '').trim().toLowerCase();
    if (source !== '') {
        if (source === 'github' || source === 'copilot' || source === 'github_token' || source === 'copilot_token') {
            return 'copilot';
        }
        if (source === 'anthropic' || source === 'claude') {
            return 'claude';
        }
        return source;
    }
    if (provider === 'github' || provider === 'copilot') {
        return 'copilot';
    }
    if (provider === 'anthropic' || provider === 'claude') {
        return 'claude';
    }
    return provider;
}

function resolveDisplayName(model: ModelInfo): string {
    const id = typeof model.id === 'string' ? model.id : '';
    const label = typeof model.label === 'string' ? model.label : '';
    const name = typeof model.name === 'string' ? model.name : '';
    return name || label || id;
}

export function getSelectableProviderId(model: Pick<ModelInfo, 'provider' | 'providerCategory'>): string {
    const categoryProvider = normalizeProviderId(model.providerCategory);
    if (categoryProvider !== 'custom' || (model.providerCategory ?? '').trim() !== '') {
        return categoryProvider;
    }
    return normalizeProviderId(model.provider);
}

function processFetchedModels(models: ModelInfo[]): ModelInfo[] {
    return models.map(m => {
        const provider = normalizeProviderId(m.provider);
        const providerCategory = normalizeProviderCategoryId(m.providerCategory, provider, m.sourceProvider);
        return {
            ...m,
            provider,
            providerCategory,
            name: resolveDisplayName(m)
        };
    });
}

function isCacheFresh(): boolean {
    return modelCache !== null && Date.now() - modelCache.timestamp < CACHE_DURATION_MS;
}

export function primeModelCache(): Promise<ModelInfo[]> {
    return fetchModels(false);
}

export async function fetchModels(bypassCache = false): Promise<ModelInfo[]> {
    try {
        // PERF-005-1: Return cached models if still fresh
        if (!bypassCache && isCacheFresh() && modelCache) {
            return modelCache.data;
        }

        if (inFlightModelRequest) {
            return inFlightModelRequest;
        }

        inFlightModelRequest = window.electron.modelRegistry
            .getAllModels()
            .catch(() => [])
            .then(models => {
                const processedModels = processFetchedModels(models);
                modelCache = {
                    data: processedModels,
                    timestamp: Date.now()
                };
                return processedModels;
            })
            .finally(() => {
                inFlightModelRequest = null;
            });

        return await inFlightModelRequest;
    } catch (error) {
        appLogger.error('ModelFetcher', 'Failed to fetch models', error as Error);
        return [];
    }
}

export function groupModels(models: ModelInfo[]): GroupedModels {
    const groups: GroupedModels = {};

    models.forEach(m => {
        const providerCategory = m.providerCategory ?? m.provider ?? 'custom';
        if (!(providerCategory in groups)) {
            groups[providerCategory] = {
                label: m.label ?? providerCategory,
                models: []
            };
        }
        groups[providerCategory].models.push(m);
    });

    return groups;
}
