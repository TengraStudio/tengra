// Re-export shared types for backward compatibility
export type { GroupedModels, ModelInfo } from '@/types/model.types';

import type { GroupedModels, ModelInfo } from '@/types/model.types';

// Simple in-memory cache for model fetches
let modelCache: { data: ModelInfo[]; timestamp: number } | null = null;
const CACHE_DURATION_MS = 60000; // 1 minute cache

function normalizeProviderId(provider: string | undefined): string {
    const raw = (provider ?? '').trim().toLowerCase();
    if (raw === '') {
        return 'custom';
    }
    if (raw === 'github') {
        return 'copilot';
    }
    if (raw === 'nvidia_key' || raw === 'nim' || raw === 'nim_openai') {
        return 'nvidia';
    }
    return raw;
}

function normalizeProviderCategoryId(
    providerCategory: string | undefined,
    provider: string
): string {
    const raw = (providerCategory ?? '').trim().toLowerCase();
    if (raw !== '') {
        return raw;
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

export async function fetchModels(bypassCache = false): Promise<ModelInfo[]> {
    try {
        // PERF-005-1: Return cached models if still fresh
        if (!bypassCache && modelCache && Date.now() - modelCache.timestamp < CACHE_DURATION_MS) {
            return modelCache.data;
        }

        // Fetch from unified source (Main Process aggregates Ollama, Copilot, Proxy/Antigravity, Llama)
        const models = await window.electron.modelRegistry.getAllModels().catch(() => []);

        const processedModels = models.map(m => {
            const provider = normalizeProviderId(m.provider);
            const providerCategory = normalizeProviderCategoryId(m.providerCategory, provider);
            return {
                ...m,
                provider,
                providerCategory,
                name: resolveDisplayName(m)
            };
        });

        // Update cache
        modelCache = {
            data: processedModels,
            timestamp: Date.now()
        };

        return processedModels;
    } catch (error) {
        window.electron.log.error('Failed to fetch models', error as Error);
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
