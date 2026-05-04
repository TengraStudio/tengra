/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { GroupedModels, ModelInfo } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

let cachedModels: ModelInfo[] | null = null;

/**
 * Normalizes a provider ID string to a standard set of known IDs.
 */
function normalizeProviderId(rawId: string): string {
    const id = rawId.trim().toLowerCase();

    // NVIDIA aliases
    if (
        id === 'nvidia' ||
        id === 'nvapi' ||
        id === 'nim' ||
        id === 'nim_openai' ||
        id === 'nvidia_nim' ||
        id === 'nvidia-nim' ||
        id === 'nvidia_key' ||
        id === 'nvidia-key' ||
        id === 'tensorrt'
    ) {
        return 'nvidia';
    }

    // GitHub / Copilot aliases
    if (id === 'github' || id === 'copilot' || id === 'github-copilot' || id === 'github_copilot') {
        return 'copilot';
    }

    // Anthropic / Claude aliases
    if (id === 'anthropic' || id === 'claude') {
        return 'claude';
    }

    // Local / Ollama aliases
    if (
        id === 'ollama' ||
        id === 'local' ||
        id === 'local-ai' ||
        id === 'local_ai' ||
        id === 'lm_studio' ||
        id === 'lm-studio'
    ) {
        return 'ollama';
    }

    if (id === 'openai') { return 'openai'; }
    if (id === 'antigravity') { return 'antigravity'; }
    if (id === 'opencode') { return 'opencode'; }
    if (id === 'codex') { return 'codex'; }
    if (id === 'huggingface') { return 'huggingface'; }

    return id || 'custom';
}

/**
 * Returns a user-friendly label for a normalized provider ID.
 */
function getProviderLabel(provider: string): string {
    const labels: Record<string, string> = {
        copilot: 'GitHub Copilot',
        openai: 'OpenAI',
        claude: 'Anthropic',
        antigravity: 'Antigravity',
        ollama: 'Ollama',
        codex: 'Codex',
        opencode: 'OpenCode',
        huggingface: 'HuggingFace',
        nvidia: 'NVIDIA',
        custom: 'Custom Proxy'
    };
    return labels[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Extracts and normalizes the provider ID for a specific model.
 */
export function getSelectableProviderId(model: ModelInfo): string {
    const rawId = (model.providerCategory || model.sourceProvider || model.provider || '').toLowerCase();
    return normalizeProviderId(rawId);
}

/**
 * Clears the local models cache.
 */
export function clearModelsInfoCache() {
    cachedModels = null;
}

/**
 * Fetches models from the backend, optionally bypassing the local cache.
 * Aggregates results from multiple IPC sources to ensure all providers are covered.
 */
export async function fetchModels(bypassCache = false): Promise<ModelInfo[]> {
    if (!bypassCache && cachedModels) {
        return cachedModels;
    }

    const aggregatedModelsMap = new Map<string, ModelInfo>();

    const addModels = (rawList: unknown[], _source: string) => {
        if (!Array.isArray(rawList)) {
            return;
        }

        const foundProviders = new Set<string>();
        rawList.forEach((item: unknown) => {
            const m = item as Record<string, unknown>;
            if (!m?.id) {
                return;
            }
            const rawProvider = (m.providerCategory || m.sourceProvider || m.provider || '') as string;
            const normalizedProvider = normalizeProviderId(rawProvider);

            foundProviders.add(`${rawProvider} -> ${normalizedProvider}`);

            const modelInfo: ModelInfo = {
                ...(m as unknown as ModelInfo),
                provider: normalizedProvider,
                providerCategory: normalizedProvider
            };

            // Use ID and provider as key for deduplication
            const key = `${modelInfo.id}:${modelInfo.provider}`;
            aggregatedModelsMap.set(key, modelInfo);
        });
    };

    try {
        // 1. Primary source: The aggregated model registry which handles local (Ollama), 
        // remote (Proxy, NVIDIA, OpenCode, HuggingFace), and installed models.
        try {
            const registryModels = await window.electron.invoke('model-registry:getAllModels') as ModelInfo[];
            if (Array.isArray(registryModels)) {
                addModels(registryModels, 'registry');
            }
        } catch (e) {
            appLogger.warn('ModelFetcher', 'model-registry:getAllModels failed', { error: e });
        }

        // 2. Secondary/Legacy fallback: only hit proxy directly when the registry returned nothing.
        if (aggregatedModelsMap.size === 0) {
            try {
                const proxyResponse = (await window.electron.getProxyModels()) as unknown as Record<string, unknown> | unknown[];
                if (proxyResponse && !Array.isArray(proxyResponse) && Array.isArray(proxyResponse.data)) {
                    addModels(proxyResponse.data as unknown[], 'proxy-data');
                } else if (Array.isArray(proxyResponse)) {
                    addModels(proxyResponse, 'proxy-root');
                }
            } catch (_e) {
                // Error ignored as this is a fallback source
            }
        }
    } catch (error) {
        appLogger.error('ModelFetcher', 'Aggregation failed', error as Error);
    }

    const allModels = Array.from(aggregatedModelsMap.values());
    if (allModels.length > 0) {
        cachedModels = allModels;
    }
    return allModels;
}

/**
 * Groups models by their normalized provider ID.
 */
export function groupModels(models: ModelInfo[]): GroupedModels {
    const grouped: GroupedModels = {};

    for (const model of models) {
        const providerId = getSelectableProviderId(model);
        if (!providerId) { continue; }

        if (!grouped[providerId]) {
            grouped[providerId] = {
                label: getProviderLabel(providerId),
                models: []
            };
        }
        grouped[providerId].models.push(model);
    }

    return grouped;
}
