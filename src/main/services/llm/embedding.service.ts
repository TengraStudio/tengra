import { appLogger } from '@main/logging/logger';
import { LlamaService } from '@main/services/llm/llama.service';
import { LLMService } from '@main/services/llm/llm.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { SettingsService } from '@main/services/system/settings.service';
import { withRetry } from '@main/utils/retry.util';
import { EmbeddingTextInputSchema } from '@shared/schemas/service-hardening.schema';
import { createHash } from 'node:crypto';

export type EmbeddingProvider = 'ollama' | 'openai' | 'llama' | 'none';

export interface EmbeddingAnalytics {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    providerRequests: Record<EmbeddingProvider, number>;
    providerFailures: Record<EmbeddingProvider, number>;
    dimensionMismatches: number;
    validationFailures: number;
    retries: number;
    fallbackResponses: number;
    budgetExceededCount: number;
    lastDurationMs: number;
    lastErrorCode?: EmbeddingErrorCode;
    lastUpdatedAt: number;
}

const EMBEDDING_SERVICE_NAME = 'EmbeddingService';
const EMBEDDING_RETRY_ATTEMPTS = 2;
const EMBEDDING_RETRY_DELAY_MS = 35;
const EMBEDDING_BUDGET_MS = 250;

const EMBEDDING_ERROR_CODE = {
    validation: 'EMBEDDING_VALIDATION',
    operationFailed: 'EMBEDDING_OPERATION_FAILED',
    transient: 'EMBEDDING_TRANSIENT'
} as const;

const EMBEDDING_UI_MESSAGE_KEYS = {
    ready: 'embedding.health.ready',
    empty: 'embedding.health.empty',
    failure: 'embedding.health.failure'
} as const;

type EmbeddingErrorCode = typeof EMBEDDING_ERROR_CODE[keyof typeof EMBEDDING_ERROR_CODE];

export interface EmbeddingHealthSnapshot {
    status: 'healthy' | 'degraded';
    uiState: 'ready' | 'empty' | 'failure';
    messageKey: string;
    budgets: {
        standardMs: number;
    };
    metrics: {
        totalRequests: number;
        failedRequests: number;
        validationFailures: number;
        retries: number;
        fallbackResponses: number;
        budgetExceededCount: number;
        lastDurationMs: number;
        lastErrorCode?: EmbeddingErrorCode;
        lastUpdatedAt: number;
        errorRate: number;
    };
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
        validationFailures: 0,
        retries: 0,
        fallbackResponses: 0,
        budgetExceededCount: 0,
        lastDurationMs: 0,
        lastErrorCode: undefined,
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
        const startedAt = Date.now();
        // Always check latest settings before generating
        const settings = this.settingsService.getSettings();
        this.currentProvider = settings.embeddings.provider;
        this.model = this.resolveModel(this.currentProvider, settings.embeddings.model);
        this.analytics.totalRequests++;
        this.analytics.providerRequests[this.currentProvider]++;
        this.analytics.lastErrorCode = undefined;

        const parsedInput = EmbeddingTextInputSchema.safeParse({ text });
        if (!parsedInput.success) {
            this.analytics.validationFailures++;
            this.analytics.fallbackResponses++;
            this.analytics.lastErrorCode = EMBEDDING_ERROR_CODE.validation;
            this.finalizeDurationMetric(startedAt);
            appLogger.warn(EMBEDDING_SERVICE_NAME, `Validation failed: ${parsedInput.error.issues[0]?.message ?? 'Unknown validation issue'}`);
            return this.createZeroVector();
        }

        const normalizedText = parsedInput.data.text.trim();
        if (!normalizedText) {
            this.analytics.fallbackResponses++;
            this.finalizeDurationMetric(startedAt);
            return this.createZeroVector();
        }

        const cacheKey = this.getCacheKey(this.currentProvider, this.model, normalizedText);
        const cached = this.getCachedEmbedding(cacheKey);
        if (cached) {
            this.analytics.cacheHits++;
            this.finalizeDurationMetric(startedAt);
            return cached;
        }
        this.analytics.cacheMisses++;

        let vector: number[] | undefined = undefined;

        try {
            vector = await this.generateWithRetry(normalizedText);
        } catch (error) {
            appLogger.error(EMBEDDING_SERVICE_NAME, `Failed to generate embedding with ${this.currentProvider}`, error as Error);
            this.analytics.providerFailures[this.currentProvider]++;
            this.analytics.fallbackResponses++;
            this.analytics.lastErrorCode = EMBEDDING_ERROR_CODE.operationFailed;
        }

        if (!vector || vector.length === 0) {
            this.finalizeDurationMetric(startedAt);
            return this.createZeroVector();
        }

        if (vector.length !== this.requiredDimension) {
            this.analytics.dimensionMismatches++;
            appLogger.warn(EMBEDDING_SERVICE_NAME, `Dimension mismatch: Got ${vector.length}, expected ${this.requiredDimension}. Applying normalize strategy.`);
            vector = this.normalizeEmbeddingDimension(vector);
        }

        this.setCachedEmbedding(cacheKey, vector);
        this.finalizeDurationMetric(startedAt);
        return vector;
    }

    getAnalytics(): EmbeddingAnalytics {
        return {
            ...this.analytics,
            providerRequests: { ...this.analytics.providerRequests },
            providerFailures: { ...this.analytics.providerFailures }
        };
    }

    getHealthStatus(): EmbeddingHealthSnapshot {
        const totalRequests = this.analytics.totalRequests;
        const failedRequests = Object.values(this.analytics.providerFailures)
            .reduce((sum, value) => sum + value, 0) + this.analytics.validationFailures;
        const errorRate = totalRequests === 0 ? 0 : failedRequests / totalRequests;
        const hasFailures = failedRequests > 0;
        const uiState = totalRequests === 0
            ? 'empty'
            : hasFailures
                ? 'failure'
                : 'ready';
        const status = errorRate > 0.05 || this.analytics.budgetExceededCount > 0
            ? 'degraded'
            : 'healthy';

        return {
            status,
            uiState,
            messageKey: EMBEDDING_UI_MESSAGE_KEYS[uiState],
            budgets: {
                standardMs: EMBEDDING_BUDGET_MS
            },
            metrics: {
                totalRequests,
                failedRequests,
                validationFailures: this.analytics.validationFailures,
                retries: this.analytics.retries,
                fallbackResponses: this.analytics.fallbackResponses,
                budgetExceededCount: this.analytics.budgetExceededCount,
                lastDurationMs: this.analytics.lastDurationMs,
                lastErrorCode: this.analytics.lastErrorCode,
                lastUpdatedAt: this.analytics.lastUpdatedAt,
                errorRate
            }
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

    private async generateWithRetry(text: string): Promise<number[] | undefined> {
        return withRetry(
            async () => {
                switch (this.currentProvider) {
                    case 'ollama':
                        return await this.ollama.getEmbeddings(this.model, text);
                    case 'openai':
                        return await this.llm.getEmbeddings(text, this.model);
                    case 'llama':
                        return await this.llama.getEmbeddings(text);
                    case 'none':
                    default:
                        return undefined;
                }
            },
            {
                maxRetries: EMBEDDING_RETRY_ATTEMPTS - 1,
                baseDelayMs: EMBEDDING_RETRY_DELAY_MS,
                maxDelayMs: EMBEDDING_RETRY_DELAY_MS,
                jitterFactor: 0,
                shouldRetry: () => true,
                onRetry: (error, attempt) => {
                    this.analytics.retries++;
                    this.analytics.lastErrorCode = EMBEDDING_ERROR_CODE.transient;
                    const message = error instanceof Error ? error.message : String(error);
                    appLogger.warn(
                        EMBEDDING_SERVICE_NAME,
                        `Provider retry ${attempt + 1}/${EMBEDDING_RETRY_ATTEMPTS - 1}: ${message}`
                    );
                },
            }
        );
    }

    private finalizeDurationMetric(startedAt: number): void {
        const durationMs = Date.now() - startedAt;
        this.analytics.lastDurationMs = durationMs;
        this.analytics.lastUpdatedAt = Date.now();
        if (durationMs > EMBEDDING_BUDGET_MS) {
            this.analytics.budgetExceededCount++;
            appLogger.warn(
                EMBEDDING_SERVICE_NAME,
                `Performance budget exceeded: ${durationMs}ms > ${EMBEDDING_BUDGET_MS}ms`
            );
        }
    }

    // Indexing and Search moved to CodeIntelligenceService / RAGService
}
