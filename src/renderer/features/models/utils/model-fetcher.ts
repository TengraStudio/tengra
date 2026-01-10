import { categorizeModel } from './model-categorization';
import type { JsonValue } from '@/types';

export interface ModelInfo {
    id?: string;
    name?: string;
    provider?: string;
    quotaInfo?: { remainingQuota?: number; totalQuota?: number; resetTime?: string; remainingFraction?: number };
    percentage?: number;
    reset?: string;
    label?: string;
    [key: string]: JsonValue | undefined;
}

type ModelResponse = ModelInfo[] | { models?: ModelInfo[]; data?: ModelInfo[]; antigravityError?: string };

export async function fetchModels() {
    try {
        const response = await window.electron.getModels() as ModelResponse;
        const models_list = Array.isArray(response) ? response : (response.models || response.data || []);

        return models_list.map(m => {
            const categorized = categorizeModel(m.id || m.name || '', m.provider);
            return {
                ...m,
                provider: categorized.provider,
                label: categorized.label
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
        const provider = m.provider || 'other';
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
