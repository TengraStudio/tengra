import { categorizeModel } from '@renderer/features/models/utils/model-categorization';

// Re-export shared types for backward compatibility
export type { GroupedModels, ModelInfo } from '@/types/model.types';

import type { GroupedModels, ModelInfo } from '@/types/model.types';

// Simple in-memory cache for model fetches
let modelCache: { data: ModelInfo[]; timestamp: number } | null = null;
const CACHE_DURATION_MS = 60000; // 1 minute cache

export async function fetchModels(bypassCache = false): Promise<ModelInfo[]> {
    try {
        // PERF-005-1: Return cached models if still fresh
        if (!bypassCache && modelCache && Date.now() - modelCache.timestamp < CACHE_DURATION_MS) {
            return modelCache.data;
        }

        // Fetch from unified source (Main Process aggregates Ollama, Copilot, Proxy/Antigravity, Llama)
        const models = await window.electron.modelRegistry.getAllModels().catch(() => []);

        const processedModels = models.map(m => {
            // Fall back to owned_by if provider is not set (common in OpenAI-compat APIs)
            const providerHint = m.provider || (m as { owned_by?: string }).owned_by;
            const categorized = categorizeModel(m.id || m.name, providerHint);
            return {
                ...m,
                provider: categorized.provider,
                label: categorized.label,
                name: m.name || categorized.label  // Set name for ModelSelector display
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
