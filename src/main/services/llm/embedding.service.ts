import { appLogger } from '@main/logging/logger';
import { LlamaService } from '@main/services/llm/llama.service';
import { LLMService } from '@main/services/llm/llm.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { SettingsService } from '@main/services/system/settings.service';
import { createHash } from 'node:crypto';

export type EmbeddingProvider = 'ollama' | 'openai' | 'llama' | 'none';

export interface EmbeddingAnalytics {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    providerRequests: Record<EmbeddingProvider, number>;
    providerFailures: Record<EmbeddingProvider, number>;
    dimensionMismatches: number;
    lastUpdatedAt: number;
}

interface CacheEntry {
    embedding: number[];
    createdAt: number;
}

export class EmbeddingService {
    private currentProvider: EmbeddingProvider = 'ollama';
    private model: string = 'all-minilm'; // Default for Ollama
    private readonly requiredDimension = 1536;
    private readonly maxCacheEntries = 500;
    private readonly cacheTtlMs = 10 * 60 * 1000;
    private embeddingCache = new Map<string, CacheEntry>();
    private analytics: EmbeddingAnalytics = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        providerRequests: { ollama: 0, openai: 0, llama: 0, none: 0 },
        providerFailures: { ollama: 0, openai: 0, llama: 0, none: 0 },
        dimensionMismatches: 0,
        lastUpdatedAt: Date.now()
    };

    constructor(
        private ollama: OllamaService,
        private llm: LLMService,
        private llama: LlamaService,
        private settingsService: SettingsService
    ) {
        this.initializeProvider();
    }

    private initializeProvider() {
        const settings = this.settingsService.getSettings();
        this.setProvider(settings.embeddings.provider, settings.embeddings.model);
    }

    setProvider(provider: EmbeddingProvider, model?: string) {
        this.currentProvider = provider;
        this.model = this.resolveModel(provider, model);
    }

    getCurrentProvider(): EmbeddingProvider {
        // Ensure settings are synced
        const settings = this.settingsService.getSettings();
        return settings.embeddings.provider;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        // Always check latest settings before generating
        const settings = this.settingsService.getSettings();
        this.currentProvider = settings.embeddings.provider;
        this.model = this.resolveModel(this.currentProvider, settings.embeddings.model);
        this.analytics.totalRequests++;
        this.analytics.providerRequests[this.currentProvider]++;

        const normalizedText = text.trim();
        if (!normalizedText) {
            this.analytics.lastUpdatedAt = Date.now();
            return this.createZeroVector();
        }

        const cacheKey = this.getCacheKey(this.currentProvider, this.model, normalizedText);
        const cached = this.getCachedEmbedding(cacheKey);
        if (cached) {
            this.analytics.cacheHits++;
            this.analytics.lastUpdatedAt = Date.now();
            return cached;
        }
        this.analytics.cacheMisses++;

        let vector: number[] | undefined = undefined;

        try {
            switch (this.currentProvider) {
                case 'ollama':
                    vector = await this.ollama.getEmbeddings(this.model, normalizedText);
                    break;
                case 'openai':
                    vector = await this.llm.getEmbeddings(normalizedText, this.model);
                    break;
                case 'llama':
                    vector = await this.llama.getEmbeddings(normalizedText);
                    break;
                case 'none':
                default:
                    // Return zero vector
                    break;
            }
        } catch (error) {
            appLogger.error('EmbeddingService', `Failed to generate embedding with ${this.currentProvider}`, error as Error);
            this.analytics.providerFailures[this.currentProvider]++;
        }

        if (!vector || vector.length === 0) {
            this.analytics.lastUpdatedAt = Date.now();
            return this.createZeroVector();
        }

        if (vector.length !== this.requiredDimension) {
            this.analytics.dimensionMismatches++;
            appLogger.warn('EmbeddingService', `Dimension mismatch: Got ${vector.length}, expected ${this.requiredDimension}. Applying normalize strategy.`);
            vector = this.normalizeEmbeddingDimension(vector);
        }

        this.setCachedEmbedding(cacheKey, vector);
        this.analytics.lastUpdatedAt = Date.now();
        return vector;
    }

    getAnalytics(): EmbeddingAnalytics {
        return {
            ...this.analytics,
            providerRequests: { ...this.analytics.providerRequests },
            providerFailures: { ...this.analytics.providerFailures }
        };
    }

    clearCache(): void {
        this.embeddingCache.clear();
    }

    private resolveModel(provider: EmbeddingProvider, model?: string): string {
        if (model?.trim()) {
            return model.trim();
        }

        const providerDefaults: Record<EmbeddingProvider, string> = {
            ollama: 'all-minilm',
            openai: 'text-embedding-3-small',
            llama: 'llama-embed',
            none: 'none'
        };
        return providerDefaults[provider];
    }

    private getCacheKey(provider: EmbeddingProvider, model: string, text: string): string {
        const hash = createHash('sha256').update(text).digest('hex');
        return `${provider}:${model}:${hash}`;
    }

    private getCachedEmbedding(cacheKey: string): number[] | null {
        const cached = this.embeddingCache.get(cacheKey);
        if (!cached) {
            return null;
        }

        if (Date.now() - cached.createdAt > this.cacheTtlMs) {
            this.embeddingCache.delete(cacheKey);
            return null;
        }

        this.embeddingCache.delete(cacheKey);
        this.embeddingCache.set(cacheKey, cached);
        return [...cached.embedding];
    }

    private setCachedEmbedding(cacheKey: string, embedding: number[]): void {
        if (this.embeddingCache.size >= this.maxCacheEntries) {
            const oldestKey = this.embeddingCache.keys().next().value as string | undefined;
            if (oldestKey) {
                this.embeddingCache.delete(oldestKey);
            }
        }

        this.embeddingCache.set(cacheKey, {
            embedding: [...embedding],
            createdAt: Date.now()
        });
    }

    private normalizeEmbeddingDimension(vector: number[]): number[] {
        if (vector.length === this.requiredDimension) {
            return vector;
        }

        if (vector.length > this.requiredDimension) {
            return vector.slice(0, this.requiredDimension);
        }

        const padded = new Array<number>(this.requiredDimension).fill(0);
        for (let index = 0; index < vector.length; index++) {
            padded[index] = vector[index];
        }
        return padded;
    }

    private createZeroVector(): number[] {
        return new Array<number>(this.requiredDimension).fill(0);
    }

    // Indexing and Search moved to CodeIntelligenceService / RAGService
}
