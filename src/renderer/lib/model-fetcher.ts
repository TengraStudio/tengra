import { categorizeModel } from './model-categorization';

export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
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

/**
 * Fetches all models and groups them by provider.
 * Codex models are grouped under OpenAI.
 */
export async function fetchModels(): Promise<GroupedModels> {
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
        console.log({ rawModels, models })
        console.log('[fetchModels] Raw models:', models.length);

        for (const m of models) {
            const def = categorizeModel(m.id || m.name, m.provider);
            const modelInfo: ModelInfo = {
                id: m.id || m.name,
                name: m.name || m.id,
                provider: m.provider || 'custom',
                type: def.type,
                quota: m.quotaInfo ? {
                    remaining: m.quotaInfo.remainingQuota,
                    limit: m.quotaInfo.totalQuota,
                    percentage: m.percentage,
                    reset: m.reset
                } : undefined,
                raw: m
            };

            const provider = (m.provider || '').toLowerCase();
            const nameLower = modelInfo.name.toLowerCase();
            const idLower = modelInfo.id.toLowerCase();

            // Filter out unwanted Copilot/internal models
            if (
                nameLower.includes('embedding') ||
                nameLower.includes('raptor') ||
                nameLower.includes('grok') ||
                idLower.includes('embedding') ||
                idLower.includes('raptor') ||
                idLower.includes('grok')
            ) {
                continue;
            }

            // Pure Provider-Based Categorization
            // Use categorized provider from def if available, otherwise fallback to raw provider
            let targetCategory = def.provider || provider || 'ollama';

            // Special case: 'codex' provider maps to 'openai' category
            // (since 'codex' is not a separate UI category)
            if (provider === 'codex') {
                targetCategory = 'openai';
            }



            // Override provider to match category for consistency in UI selectors
            // Exception: Keep 'copilot' as provider for Anthropic/OpenAI/Gemini if that's the true source,
            // BUT ModelSelector uses category.id to group. 
            // We need to set the provider field in ModelInfo such that ModelSelector logic works.
            // ModelSelector logic: onSelect(model.provider, model.id).
            // If we classify Claude as 'anthropic' but provider is 'copilot', onSelect sends 'copilot'.
            // This is correct for backend routing.
            // However, the Visual Bug (Label mismatch) in ModelSelector uses:
            // categories.find(c => c.models.some(m => m.id === selectedModel))
            // So as long as we put the model in the right *list* (result.anthropic), the label should fix itself.

            if (targetCategory === 'anthropic') {
                if (m.provider !== 'antigravity' && m.provider !== 'copilot') {
                    modelInfo.provider = 'anthropic';
                }
                result.anthropic.push(modelInfo);
            }
            else if (targetCategory === 'gemini') {
                if (m.provider !== 'antigravity' && m.provider !== 'copilot') {
                    modelInfo.provider = 'gemini';
                }
                result.gemini.push(modelInfo);
            }
            else if (targetCategory === 'antigravity') {
                modelInfo.provider = 'antigravity';
                result.antigravity.push(modelInfo);
            }
            else if (targetCategory === 'openai') {
                // Keep original provider if it's codex/openai, or normalize? 
                // Mostly fine, usually 'openai' or 'codex'.
                result.openai.push(modelInfo);
            }
            else if (targetCategory === 'copilot') {
                modelInfo.provider = 'copilot';
                result.copilot.push(modelInfo);
            }
            else if (targetCategory === 'ollama') {
                modelInfo.provider = 'ollama';
                result.ollama.push(modelInfo);
            }
            else result.custom.push(modelInfo);
        }

        console.log('[fetchModels] Final Groups:', {
            copilot: result.copilot,
            openai: result.openai,
            gemini: result.gemini,
            antigravity: result.antigravity,
            anthropic: result.anthropic,
            ollama: result.ollama
        });

        // Debug Antigravity contents
        if (result.antigravity.length === 0) {
            console.log('[fetchModels] Warning: Antigravity group is empty. Checking raw models for antigravity keyword...');
            console.log('Raw matches:', models.filter((m: any) => (m.id || '').toLowerCase().includes('antigravity')).map((m: any) => m.id));
        }

    } catch (error) {
        console.error('[fetchModels] Error:', error);
    }

    return result;
}
