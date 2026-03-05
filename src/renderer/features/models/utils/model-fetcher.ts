// Re-export shared types for backward compatibility
export type { GroupedModels, ModelInfo } from '@/types/model.types';

import type { GroupedModels, ModelInfo } from '@/types/model.types';

// Simple in-memory cache for model fetches
let modelCache: { data: ModelInfo[]; timestamp: number } | null = null;
const CACHE_DURATION_MS = 60000; // 1 minute cache

function normalizeProviderId(
    provider: string | undefined,
    ownedBy: string | undefined
): string {
    const raw = (provider ?? ownedBy ?? '').trim().toLowerCase();
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
            const ownedBy = (m as { owned_by?: string }).owned_by;
            const provider = normalizeProviderId(m.provider, ownedBy);
            return {
                ...m,
                provider,
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
        const provider = m.provider ?? 'other';
        if (!(provider in groups)) {
            groups[provider] = {
                label: m.label ?? provider,
                models: []
            };
        }
        groups[provider].models.push(m);
    });

    return groups;
}
