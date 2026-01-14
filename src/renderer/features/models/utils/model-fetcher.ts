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
    [key: string]: JsonValue | undefined;
}

type ModelResponse = ModelInfo[] | { models?: ModelInfo[]; data?: ModelInfo[]; antigravityError?: string };

// Hardcoded Anthropic models - always available (matches Go backend's GetClaudeModels)
const ANTHROPIC_MODELS: ModelInfo[] = [
    { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku', provider: 'anthropic', owned_by: 'anthropic' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', provider: 'anthropic', owned_by: 'anthropic' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus', provider: 'anthropic', owned_by: 'anthropic' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', provider: 'anthropic', owned_by: 'anthropic' },
    { id: 'claude-opus-4-20250514', name: 'Claude 4 Opus', provider: 'anthropic', owned_by: 'anthropic' },
    { id: 'claude-opus-4-1-20250805', name: 'Claude 4.1 Opus', provider: 'anthropic', owned_by: 'anthropic' },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'anthropic', owned_by: 'anthropic' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', owned_by: 'anthropic' },
];

// Expected providers that should be present when proxy is fully loaded
const EXPECTED_PROXY_PROVIDERS = ['anthropic', 'antigravity'];

async function fetchProxyModelsWithRetry(maxRetries = 3, delayMs = 1000): Promise<ModelInfo[]> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await window.electron.getProxyModels() as ModelResponse;
            const models = Array.isArray(response) ? response : (response.models || response.data || []);

            // Check if we have models from expected providers
            const providers = new Set(models.map(m =>
                m.provider || (m as { owned_by?: string }).owned_by
            ).filter(Boolean));

            const hasExpectedProviders = EXPECTED_PROXY_PROVIDERS.some(p => providers.has(p));

            // If we have models and expected providers, or this is the last attempt, return
            if ((models.length > 0 && hasExpectedProviders) || attempt === maxRetries) {
                if (attempt > 0) {
                    console.log(`[model-fetcher] Got ${models.length} models after ${attempt + 1} attempts`);
                }
                return models;
            }

            // Proxy not fully loaded yet, wait and retry
            console.log(`[model-fetcher] Proxy not fully loaded (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        } catch (error) {
            if (attempt === maxRetries) {
                console.error('[model-fetcher] Failed to fetch proxy models after retries:', error);
                return [];
            }
            await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        }
    }
    return [];
}

export async function fetchModels() {
    try {
        // Fetch from all sources - proxy with retry, Ollama, and auth status
        const [ollamaResponse, proxyModels, authStatus] = await Promise.all([
            window.electron.getModels().catch(() => []),
            fetchProxyModelsWithRetry(),
            window.electron.checkAuthStatus().catch(() => ({ files: [] }))
        ]) as [ModelResponse, ModelInfo[], { files: { name: string; provider: string }[] }];

        // Check if user is authenticated with Claude/Anthropic
        const hasClaudeAuth = authStatus.files?.some(f =>
            f.provider === 'claude' || f.provider === 'anthropic'
        ) ?? false;

        // Extract Ollama models
        const ollamaModels = Array.isArray(ollamaResponse) ? ollamaResponse : (ollamaResponse.models || ollamaResponse.data || []);

        // Merge and deduplicate by id
        const seenIds = new Set<string>();
        const allModels: ModelInfo[] = [];

        // Add proxy models first (they have priority - Anthropic, Antigravity, etc.)
        for (const m of proxyModels) {
            const id = m.id || m.name || '';
            if (id && !seenIds.has(id)) {
                seenIds.add(id);
                allModels.push(m);
            }
        }

        // Add hardcoded Anthropic models as fallback (only if authenticated with Claude)
        if (hasClaudeAuth) {
            for (const m of ANTHROPIC_MODELS) {
                const id = m.id || '';
                if (id && !seenIds.has(id)) {
                    seenIds.add(id);
                    allModels.push(m);
                }
            }
        }

        // Add Ollama models (local models)
        for (const m of ollamaModels) {
            const id = m.id || m.name || '';
            if (id && !seenIds.has(id)) {
                seenIds.add(id);
                allModels.push(m);
            }
        }

        return allModels.map(m => {
            // Fall back to owned_by if provider is not set (common in OpenAI-compat APIs)
            const providerHint = m.provider || (m as { owned_by?: string }).owned_by;
            const categorized = categorizeModel(m.id || m.name || '', providerHint);
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
