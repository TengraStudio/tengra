import { categorizeModel } from '@renderer/features/models/utils/model-categorization';

import type { JsonValue } from '@/types';

export interface ModelInfo {
    id?: string;
    name?: string;
    provider?: string;
    quotaInfo?: { remainingQuota?: number; totalQuota?: number; resetTime?: string; remainingFraction?: number };
    percentage?: number;
    reset?: string;
    label?: string;
    contextWindow?: number;
    pricing?: {
        input?: number;
        output?: number;
    };
    [key: string]: JsonValue | undefined;
}

export async function fetchModels(): Promise<ModelInfo[]> {
    try {
        // Fetch from unified source (Main Process aggregates Ollama, Copilot, Proxy/Antigravity, Llama)
        // Fetch from unified source (Main Process aggregates Ollama, Copilot, Proxy/Antigravity, Llama)
        const models = await window.electron.modelRegistry.getAllModels().catch(() => []);

        return models.map(m => {
            // Fall back to owned_by if provider is not set (common in OpenAI-compat APIs)
            const providerHint = m.provider || (m as { owned_by?: string }).owned_by;
            const categorized = categorizeModel((m.id || m.name) ?? '', providerHint);
            return {
                ...m,
                provider: categorized.provider,
                label: categorized.label,
                name: m.name || categorized.label  // Set name for ModelSelector display
            };
        });
    } catch (error) {
        console.error('Failed to fetch models:', error);
        return [];
    }
}

export interface GroupedModels {
    [provider: string]: {
        label: string;
        models: ModelInfo[];
    }
}

export function groupModels(models: ModelInfo[]): GroupedModels {
    const groups: GroupedModels = {};

    models.forEach(m => {
        const provider = m.provider ?? 'other';
        if (!groups[provider]) {
            groups[provider] = {
                label: m.label || provider,
                models: []
            };
        }
        groups[provider].models.push(m);
    });

    return groups;
}
