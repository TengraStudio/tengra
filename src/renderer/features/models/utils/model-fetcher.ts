import { categorizeModel } from './model-categorization';

export interface ModelInfo {
    id: string;
    name: string;
    provider: string; // The service that HANDLES the model (routing)
    quota?: {
        remaining?: number;
        limit?: number;
        percentage?: number;
        reset?: string;
    };
    raw?: any;
    type?: 'chat' | 'image' | 'video';
}

export interface GroupedModels {
    copilot: ModelInfo[];
    openai: ModelInfo[];
    anthropic: ModelInfo[];
    gemini: ModelInfo[];
    antigravity: ModelInfo[];
    ollama: ModelInfo[];
    custom: ModelInfo[];
}

let modelCache: GroupedModels | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000;

export function invalidateModelCache() {
    modelCache = null;
    cacheTimestamp = 0;
}

export async function fetchModels(forceRefresh = false): Promise<GroupedModels> {
    const now = Date.now();
    if (!forceRefresh && modelCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return modelCache;
    }

    const result: GroupedModels = {
        copilot: [],
        openai: [],
        anthropic: [],
        gemini: [],
        antigravity: [],
        ollama: [],
        custom: []
    };

    try {
        const rawModels = await window.electron.getModels();
        const models = Array.isArray(rawModels) ? rawModels : ((rawModels as any)?.models || (rawModels as any)?.data || []);

        for (const m of models) {
            const def = categorizeModel(m.id || m.name, m.provider);

            const modelInfo: ModelInfo = {
                id: m.id || m.name,
                name: m.name || m.id,
                provider: def.provider || m.provider || 'custom',
                type: def.type,
                quota: m.quotaInfo ? {
                    remaining: m.quotaInfo.remainingQuota,
                    limit: m.quotaInfo.totalQuota,
                    percentage: m.percentage,
                    reset: m.reset
                } : undefined,
                raw: m
            };

            const nameLower = modelInfo.name.toLowerCase();
            const idLower = modelInfo.id.toLowerCase();

            // Filter out unwanted internal models
            if (
                nameLower.includes('embedding') || nameLower.includes('raptor') || nameLower.includes('grok') ||
                idLower.includes('embedding') || idLower.includes('raptor') || idLower.includes('grok')
            ) {
                continue;
            }

            // STRICT GROUPING based on provider
            const target = modelInfo.provider.toLowerCase();

            if (target === 'copilot') result.copilot.push(modelInfo);
            else if (target === 'openai' || target === 'codex') result.openai.push(modelInfo);
            else if (target === 'anthropic' || target === 'claude') result.anthropic.push(modelInfo);
            else if (target === 'gemini' || target === 'google') result.gemini.push(modelInfo);
            else if (target === 'antigravity') result.antigravity.push(modelInfo);
            else if (target === 'ollama') result.ollama.push(modelInfo);
            else result.custom.push(modelInfo);
        }
    } catch (error) {
        console.error('[fetchModels] Error:', error);
    }

    modelCache = result;
    cacheTimestamp = Date.now();
    return result;
}
