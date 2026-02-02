/**
 * Intelligent Model Router
 * Automatically routes requests to the best available provider
 */

import { getHealthCheckService } from '@main/services/system/health-check.service';
import { getRateLimiter } from '@main/utils/rate-limiter.util';

export interface ModelInfo {
    id: string
    provider: string
    aliases?: string[]
    capabilities?: string[]
    contextWindow?: number
    priority?: number // Higher = preferred
}

export interface RouteResult {
    provider: string
    model: string
    originalModel: string
    reason: string
}

export interface RouterOptions {
    preferredProvider?: string
    fallbackEnabled?: boolean
    checkHealth?: boolean
    checkQuota?: boolean
}

// Model registry with known models and their providers
const MODEL_REGISTRY: ModelInfo[] = [
    // OpenAI
    { id: 'gpt-4o', provider: 'openai', priority: 90, contextWindow: 128000 },
    { id: 'gpt-4o-mini', provider: 'openai', priority: 85, contextWindow: 128000 },
    { id: 'gpt-4-turbo', provider: 'openai', priority: 80, contextWindow: 128000 },
    { id: 'gpt-4', provider: 'openai', priority: 75, contextWindow: 8192 },
    { id: 'gpt-3.5-turbo', provider: 'openai', priority: 60, contextWindow: 16385 },
    { id: 'o1', provider: 'openai', priority: 95, contextWindow: 200000 },
    { id: 'o1-mini', provider: 'openai', priority: 88, contextWindow: 128000 },

    // Anthropic
    { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', priority: 92, contextWindow: 200000 },
    { id: 'claude-3-opus-20240229', provider: 'anthropic', priority: 90, contextWindow: 200000 },
    { id: 'claude-3-sonnet-20240229', provider: 'anthropic', priority: 85, contextWindow: 200000 },
    { id: 'claude-3-haiku-20240307', provider: 'anthropic', priority: 70, contextWindow: 200000 },



    // Groq (fast inference)
    { id: 'llama-3.3-70b-versatile', provider: 'groq', priority: 78, contextWindow: 128000 },
    { id: 'llama3-70b-8192', provider: 'groq', priority: 75, contextWindow: 8192 },
    { id: 'mixtral-8x7b-32768', provider: 'groq', priority: 70, contextWindow: 32768 },

    // Copilot
    { id: 'gpt-5.1-codex', provider: 'copilot', priority: 95, contextWindow: 128000 },
    { id: 'gpt-5.1-codex-mini', provider: 'copilot', priority: 90, contextWindow: 128000 },
];

// Provider fallback chains
const FALLBACK_CHAINS: Record<string, string[]> = {
    openai: ['anthropic', 'groq'],
    anthropic: ['openai', 'groq'],
    groq: ['openai', 'anthropic'],
    copilot: ['openai', 'anthropic'],
    ollama: [] // No fallback for local models
};

// Model equivalence mappings for fallback
const MODEL_EQUIVALENTS: Record<string, Record<string, string>> = {
    'gpt-4o': {
        anthropic: 'claude-3-5-sonnet-20241022',
        groq: 'llama-3.3-70b-versatile'
    },
    'gpt-4o-mini': {
        anthropic: 'claude-3-haiku-20240307',
        groq: 'llama3-70b-8192'
    },
    'claude-3-5-sonnet-20241022': {
        openai: 'gpt-4o',
        groq: 'llama-3.3-70b-versatile'
    }
};

export class ModelRouter {
    private customModels: ModelInfo[] = [];

    /**
     * Register a custom model
     */
    registerModel(model: ModelInfo) {
        this.customModels.push(model);
    }

    /**
     * Find the best provider for a model
     */
    /**
     * Find the best provider for a model
     */
    route(modelId: string, options: RouterOptions = {}): RouteResult {
        const allModels = [...MODEL_REGISTRY, ...this.customModels];

        // Direct match
        const directMatch = allModels.find(m => m.id === modelId);
        if (directMatch) {
            const routed = this.handleDirectMatch(directMatch, modelId, options);
            if (routed) { return routed; }

            return {
                provider: directMatch.provider,
                model: modelId,
                originalModel: modelId,
                reason: 'Direct match'
            };
        }

        // Try to infer provider from model name
        const inferred = this.inferProvider(modelId);
        if (inferred) {
            return {
                provider: inferred,
                model: modelId,
                originalModel: modelId,
                reason: 'Inferred from model name'
            };
        }

        // Default to OpenAI-compatible
        return {
            provider: 'openai',
            model: modelId,
            originalModel: modelId,
            reason: 'Default routing'
        };
    }

    private handleDirectMatch(directMatch: ModelInfo, modelId: string, options: RouterOptions): RouteResult | null {
        return this.checkPreferredProvider(directMatch, modelId, options)
            ?? this.checkHealthAndFallback(directMatch, modelId, options)
            ?? this.checkQuotaAndFallback(directMatch, modelId, options);
    }

    private checkPreferredProvider(directMatch: ModelInfo, modelId: string, options: RouterOptions): RouteResult | null {
        if (options.preferredProvider && directMatch.provider !== options.preferredProvider) {
            const equivalent = this.findEquivalent(modelId, options.preferredProvider);
            if (equivalent) {
                return {
                    provider: options.preferredProvider,
                    model: equivalent,
                    originalModel: modelId,
                    reason: 'Routed to preferred provider'
                };
            }
        }
        return null;
    }

    private checkHealthAndFallback(directMatch: ModelInfo, modelId: string, options: RouterOptions): RouteResult | null {
        if (options.checkHealth && options.fallbackEnabled && this.isProviderUnhealthy(directMatch.provider)) {
            const fallback = this.findFallback(modelId, directMatch.provider);
            if (fallback) {
                return {
                    provider: fallback.provider,
                    model: fallback.model,
                    originalModel: modelId,
                    reason: 'Primary provider unhealthy, using fallback'
                };
            }
        }
        return null;
    }

    private checkQuotaAndFallback(directMatch: ModelInfo, modelId: string, options: RouterOptions): RouteResult | null {
        if (options.checkQuota && options.fallbackEnabled && this.isProviderRateLimited(directMatch.provider)) {
            const fallback = this.findFallback(modelId, directMatch.provider);
            if (fallback) {
                return {
                    provider: fallback.provider,
                    model: fallback.model,
                    originalModel: modelId,
                    reason: 'Rate limited, using fallback'
                };
            }
        }
        return null;
    }

    private isProviderUnhealthy(provider: string): boolean {
        const health = getHealthCheckService();
        const status = health.getStatus();
        const providerHealth = status.services.find(s => s.name.toLowerCase() === provider.toLowerCase());
        return providerHealth?.status === 'unhealthy';
    }

    private isProviderRateLimited(provider: string): boolean {
        const limiter = getRateLimiter(provider);
        return limiter.getAvailableTokens() < 1;
    }

    /**
     * Find an equivalent model on a different provider
     */
    private findEquivalent(modelId: string, targetProvider: string): string | null {
        if (!(modelId in MODEL_EQUIVALENTS)) {
            return null;
        }
        const equivalents = MODEL_EQUIVALENTS[modelId];
        if (!(targetProvider in equivalents)) {
            return null;
        }
        return equivalents[targetProvider];
    }

    /**
     * Find a fallback model when primary provider is unavailable
     */
    private findFallback(modelId: string, currentProvider: string): { provider: string; model: string } | null {
        const fallbackProviders = FALLBACK_CHAINS[currentProvider] ?? [];

        for (const provider of fallbackProviders) {
            const equivalent = this.findEquivalent(modelId, provider);
            if (equivalent) {
                return { provider, model: equivalent };
            }
        }

        return null;
    }

    /**
     * Infer provider from model name
     */
    private inferProvider(modelId: string): string | null {
        const lower = modelId.toLowerCase();

        if (lower.includes('gpt') || lower.includes('o1')) { return 'openai'; }
        if (lower.includes('claude')) { return 'anthropic'; }

        if (lower.includes('llama') || lower.includes('mixtral')) { return 'groq'; }
        if (lower.includes('codex')) { return 'copilot'; }

        return null;
    }

    /**
     * Get all registered models
     */
    getAllModels(): ModelInfo[] {
        return [...MODEL_REGISTRY, ...this.customModels];
    }

    /**
     * Get models for a specific provider
     */
    getModelsForProvider(provider: string): ModelInfo[] {
        return this.getAllModels().filter(m => m.provider === provider);
    }
}

// Singleton
let instance: ModelRouter | null = null;

export function getModelRouter(): ModelRouter {
    instance ??= new ModelRouter();
    return instance;
}
