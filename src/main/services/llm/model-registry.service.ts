import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { resolveContextWindowForModel } from '@main/services/llm/model-context-window.data';
import { RegionalPreferenceService } from '@main/services/llm/regional-preference.service';
import { getTokenEstimationService } from '@main/services/llm/token-estimation.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonValue } from '@shared/types/common';
import { SystemEventKey } from '@shared/types/events';
import { getErrorMessage } from '@shared/utils/error.util';

export type ModelProviderId =
    | 'ollama'
    | 'opencode'
    | 'antigravity'
    | 'codex'
    | 'claude'
    | 'copilot'
    | 'nvidia'
    | 'openai'
    | 'huggingface'
    | 'anthropic'
    | 'sd-cpp';

/**
 * UI-facing normalized model metadata used across model list, picker, and marketplace views.
 */
export interface ModelProviderInfo {
    id: string;
    name: string;
    provider: string;
    description?: string;
    tags?: string[];
    downloads?: number;
    likes?: number;
    contextWindow?: number;
    parameters?: string;
    capabilities?: {
        image_generation?: boolean;
        text_generation?: boolean;
        embedding?: boolean;
    };
    [key: string]: JsonValue | undefined;
}

export interface ModelRegistryDependencies {
    processManager: import('@main/services/system/process-manager.service').ProcessManagerService;
    jobScheduler: JobSchedulerService;
    settingsService: SettingsService;
    proxyService: ProxyService;
    eventBus: EventBusService;
    authService: AuthService;
    tokenService: TokenService;
    localImageService: import('@main/services/llm/local-image.service').LocalImageService;
    huggingFaceService: HuggingFaceService;
}

/**
 * Aggregates models from native model-service, proxy providers, and local fallbacks.
 * Also keeps token context-window limits in sync with TokenEstimationService.
 */
export class ModelRegistryService extends BaseService {
    private static readonly ERROR_CODES = {
        FETCH_FAILED: 'MODEL_REGISTRY_FETCH_FAILED',
        MALFORMED_RESPONSE: 'MODEL_REGISTRY_MALFORMED_RESPONSE',
    } as const;
    private static readonly PERFORMANCE_BUDGET = {
        cacheRefreshMs: 2000,
        providerFetchMs: 1500,
        maxCachedModels: 5000,
    } as const;
    private static readonly UI_MESSAGE_KEYS = {
        ready: 'serviceHealth.modelRegistry.ready',
        empty: 'serviceHealth.modelRegistry.empty',
        failure: 'serviceHealth.modelRegistry.failure',
    } as const;
    private readonly FETCH_RETRY_POLICY = {
        maxAttempts: 2,
        delayMs: 250,
    } as const;
    private cachedModels: ModelProviderInfo[] = [];
    private lastUpdate: number = 0;
    private telemetry = {
        cacheUpdates: 0,
        providerFetchFailures: 0,
        lastSuccessfulUpdateAt: 0,
        lastTelemetryEventAt: 0,
    };

    constructor(private deps: ModelRegistryDependencies) {
        super('ModelRegistryService');
        this.initializeScheduler();
    }

    private initializeScheduler(): void {
        this.deps.jobScheduler.registerRecurringJob(
            'model-registry-update',
            async () => {
                await this.updateCache();
            },
            () => {
                // Get interval from settings, default to 1 hour (3600000 ms)
                // User asked for capability to set e.g. 5 minutes.
                // Assuming settings structure has 'modelUpdateInterval' in ms or similar.
                const settings = this.deps.settingsService.getSettings();
                return settings.ai?.modelUpdateInterval ?? 60 * 60 * 1000;
            }
        );
    }

    override async initialize(): Promise<void> {
        // Start the native service process
        await this.deps.processManager.startService({
            name: 'model-service',
            executable: 'tengra-model-service',
            persistent: true,
        });

        // Initial load if empty
        if (this.cachedModels.length === 0) {
            appLogger.info('ModelRegistry', 'Initializing model cache...');
            await this.updateCache();
        }
    }

    private async updateCache(): Promise<void> {
        this.telemetry.cacheUpdates += 1;
        this.trackTelemetry('model-registry.cache.update.started');
        appLogger.info('ModelRegistry', 'Updating remote model cache...');
        this.cachedModels = await this.fetchRemoteModels();
        this.lastUpdate = Date.now();
        this.telemetry.lastSuccessfulUpdateAt = this.lastUpdate;

        // Push limits to TokenEstimationService
        const tokenEstimator = getTokenEstimationService();
        for (const model of this.cachedModels) {
            if (model.contextWindow) {
                tokenEstimator.registerModelLimit(model.id, model.contextWindow);
                // Also register normalized name if it differs
                const normalized = model.id.split('/').pop();
                if (normalized && normalized !== model.id) {
                    tokenEstimator.registerModelLimit(normalized, model.contextWindow);
                }
            }
        }

        appLogger.info('ModelRegistry', `Cache updated with ${this.cachedModels.length} models`);
        this.trackTelemetry('model-registry.cache.update.completed', {
            modelCount: this.cachedModels.length,
        });
        this.deps.eventBus.emit('model:updated', {
            provider: 'all',
            count: this.cachedModels.length,
            timestamp: this.lastUpdate,
        });
    }

    /**
     * Get all available models from all sources.
     * This aggregates:
     * - Local Ollama models
     * - GitHub Copilot models
     * - Proxy models (GitHub Models, Claude, Gemini, etc.)
     * - Llama C++ models
     */
    /**
     * Get all available models from all sources.
     * This is a cache-aware wrapper around getRemoteModels.
     */
    async getAllModels(): Promise<ModelProviderInfo[]> {
        return this.getRemoteModels();
    }

    private async resolveProviderToken(provider: ModelProviderId): Promise<string | undefined> {
        const activeToken = await this.deps.authService.getActiveToken(provider);
        if (activeToken) {
            return activeToken;
        }

        const settings = this.deps.settingsService.getSettings();
        const readKey = (value: JsonValue | undefined): string | undefined => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                return undefined;
            }
            const raw = value['apiKey'];
            if (typeof raw !== 'string') {
                return undefined;
            }
            const trimmed = raw.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        };
        if (provider === 'nvidia') {
            return readKey(settings.nvidia);
        }
        if (provider === 'openai' || provider === 'codex') {
            return readKey(settings.openai);
        }
        if (provider === 'claude') {
            return readKey(settings.anthropic);
        }
        if (provider === 'antigravity') {
            return readKey(settings.gemini);
        }
        return undefined;
    }

    private async fetchModelProvider(
        provider: ModelProviderId,
        proxyPort?: number,
        proxyKey?: string,
        token?: string
    ): Promise<ModelProviderInfo[]> {
        return this.fetchFromRustService(provider, token, proxyPort, proxyKey);
    }

    private async fetchFromRustService(
        provider: ModelProviderId,
        token?: string,
        proxyPort?: number,
        proxyKey?: string
    ): Promise<ModelProviderInfo[]> {
        try {
            const response = await this.fetchRustModelsWithRetry(provider, token, proxyPort, proxyKey);

            appLogger.debug(
                'ModelRegistry',
                `Rust response for ${provider}: success=${response.success}, models=${response.models.length}, error=${response.error ?? 'none'}`
            );

            const hasValidResponseShape =
                typeof response.success === 'boolean' &&
                Array.isArray(response.models);

            if (!hasValidResponseShape) {
                appLogger.warn(
                    'ModelRegistry',
                    `[${ModelRegistryService.ERROR_CODES.MALFORMED_RESPONSE}] Ignoring malformed model response for provider ${provider}`
                );
                return [];
            }

            if (response.success && response.models.length > 0) {
                const validModels = response.models.filter(model =>
                    typeof model.id === 'string' &&
                    model.id.trim().length > 0 &&
                    typeof model.provider === 'string' &&
                    model.provider.trim().length > 0
                );

                return validModels.map(m => {
                    const mappedProvider = provider === 'anthropic' ? 'claude' : provider;
                    let id = m.id;
                    if (mappedProvider === 'nvidia' && !id.startsWith('nvidia/')) {
                        id = `nvidia/${id}`;
                    }
                    const normalizedModel: ModelProviderInfo = {
                        ...m,
                        id,
                        provider: mappedProvider,
                    };
                    return this.enrichModelMetadata(normalizedModel);
                });
            }
        } catch (e) {
            this.telemetry.providerFetchFailures += 1;
            this.trackTelemetry('model-registry.provider.fetch.failed', { provider });
            appLogger.debug(
                'ModelRegistry',
                `[${ModelRegistryService.ERROR_CODES.FETCH_FAILED}] Failed to fetch ${provider} models from Rust: ${getErrorMessage(e as Error)}`
            );
        }
        return [];
    }

    private trackTelemetry(name: SystemEventKey, properties: Record<string, unknown> = {}): void {
        this.telemetry.lastTelemetryEventAt = Date.now();
        this.deps.eventBus.emit('telemetry:model-registry', {
            name,
            ...properties,
            timestamp: Date.now()
        });
    }

    getHealthMetrics(): {
        status: 'healthy' | 'degraded';
        uiState: 'ready' | 'empty' | 'failure';
        messageKey: string;
        performanceBudget: typeof ModelRegistryService.PERFORMANCE_BUDGET;
        cacheUpdates: number;
        providerFetchFailures: number;
        cachedModelCount: number;
        lastSuccessfulUpdateAt: number;
        lastTelemetryEventAt: number;
    } {
        const uiState = this.telemetry.providerFetchFailures > 0
            ? 'failure'
            : this.cachedModels.length === 0
                ? 'empty'
                : 'ready';
        return {
            status: this.telemetry.providerFetchFailures > 0 ? 'degraded' : 'healthy',
            uiState,
            messageKey: ModelRegistryService.UI_MESSAGE_KEYS[uiState],
            performanceBudget: ModelRegistryService.PERFORMANCE_BUDGET,
            cacheUpdates: this.telemetry.cacheUpdates,
            providerFetchFailures: this.telemetry.providerFetchFailures,
            cachedModelCount: this.cachedModels.length,
            lastSuccessfulUpdateAt: this.telemetry.lastSuccessfulUpdateAt,
            lastTelemetryEventAt: this.telemetry.lastTelemetryEventAt,
        };
    }

    private async fetchRustModelsWithRetry(
        provider: ModelProviderId,
        token?: string,
        proxyPort?: number,
        proxyKey?: string
    ): Promise<{
        success: boolean;
        models: ModelProviderInfo[];
        error?: string;
    }> {
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= this.FETCH_RETRY_POLICY.maxAttempts; attempt++) {
            try {
                return await this.deps.processManager.sendRequest<{
                    success: boolean;
                    models: ModelProviderInfo[];
                    error?: string;
                }>('model-service', {
                    type: 'FetchModels',
                    provider,
                    token,
                    proxy_port: proxyPort,
                    proxy_key: proxyKey,
                });
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.FETCH_RETRY_POLICY.maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, this.FETCH_RETRY_POLICY.delayMs));
                }
            }
        }
        throw (lastError ?? new Error('Unknown model registry fetch error'));
    }

    private ensureModelCapabilities(model: ModelProviderInfo): ModelProviderInfo {
        const existing = model.capabilities ?? {};
        if (
            existing.image_generation !== undefined &&
            existing.text_generation !== undefined &&
            existing.embedding !== undefined
        ) {
            return model;
        }

        const searchable = `${model.id} ${model.name ?? ''} ${model.description ?? ''}`.toLowerCase();
        const looksLikeImageModel = this.looksLikeImageGenerationModel(searchable);
        const looksLikeEmbeddingModel = this.looksLikeEmbeddingModel(searchable);

        // Keep explicit server values when present, infer only missing fields.
        const capabilities = {
            image_generation: existing.image_generation ?? looksLikeImageModel,
            text_generation: existing.text_generation ?? (!looksLikeEmbeddingModel && !looksLikeImageModel),
            embedding: existing.embedding ?? looksLikeEmbeddingModel,
        };

        return {
            ...model,
            capabilities,
        };
    }

    private enrichModelMetadata(model: ModelProviderInfo): ModelProviderInfo {
        const withCapabilities = this.ensureModelCapabilities(model);
        const resolvedContextWindow = resolveContextWindowForModel(withCapabilities);
        if (!resolvedContextWindow) {
            return withCapabilities;
        }
        return {
            ...withCapabilities,
            contextWindow: resolvedContextWindow,
        };
    }

    private looksLikeImageGenerationModel(searchable: string): boolean {
        const positiveSignals = [
            /dall[-\s]?e/i,
            /nano\s*banana/i,
            /\bflux\b/i,
            /stable[\s-]?diffusion|sdxl/i,
            /gemini[\s-]*3[\s-]*pro[\s-]*image/i,
            /\bimage\s*generation\b/i,
        ];
        const negativeSignals = [
            /image[-\s]?detection|deepfake/i,
            /content[-\s]?safety|guard/i,
            /embedding/i,
            /alphafold|protein|molecular/i,
            /ui\s*checkpoint|computer\s*use|browser\s*subagent/i,
        ];

        return (
            positiveSignals.some(regex => regex.test(searchable)) &&
            !negativeSignals.some(regex => regex.test(searchable))
        );
    }

    private looksLikeEmbeddingModel(searchable: string): boolean {
        const embeddingSignals = [
            /\bembed(ding)?\b/i,
            /\bbge\b/i,
            /\barctic-embed\b/i,
            /text-embedding/i,
        ];
        return embeddingSignals.some(regex => regex.test(searchable));
    }

    // Removed fetchProxyModels and fetchLlamaModels

    /**
     * Get cached remote models.
     */
    async getRemoteModels(): Promise<ModelProviderInfo[]> {
        if (this.cachedModels.length === 0) {
            await this.updateCache();
        }
        return this.cachedModels;
    }

    /**
     * Unix epoch of last successful cache update.
     */
    getLastUpdate(): number {
        return this.lastUpdate;
    }

    private async fetchRemoteModels(): Promise<ModelProviderInfo[]> {
        const proxyPort = this.deps.proxyService.getEmbeddedProxyStatus().port ?? 8317;
        const proxyKey = await this.deps.proxyService.getProxyKey();

        const promises: Promise<ModelProviderInfo[]>[] = [
            this.fetchModelProvider('ollama', proxyPort, proxyKey),
            this.fetchModelProvider('opencode', proxyPort, proxyKey),
        ];

        // Fetch from HuggingFace (as expected by tests and as a fallback)
        promises.push((async () => {
            try {
                const results = await this.deps.huggingFaceService.searchModels('GGUF', 50, 0, 'downloads');
                return results.models.map(m => ({
                    id: m.id,
                    name: m.name,
                    provider: 'huggingface' as ModelProviderId,
                    description: m.description,
                    tags: m.tags,
                    downloads: m.downloads,
                    likes: m.likes,
                    capabilities: { text_generation: true }
                }));
            } catch (err) {
                appLogger.warn('ModelRegistry', `Failed to fetch HuggingFace models: ${getErrorMessage(err)}`);
                return [];
            }
        })());

        const cloudProviders: ModelProviderId[] = [
            'antigravity',
            'codex',
            'claude',
            'copilot',
            'nvidia',
            'openai',
        ];

        for (const p of cloudProviders) {
            try {
                await this.deps.tokenService.ensureFreshToken(p);
            } catch (err) {
                appLogger.warn('ModelRegistry', `Token refresh failed for ${p}: ${getErrorMessage(err)}`);
            }

            const token = await this.resolveProviderToken(p);
            if (token) {
                promises.push(this.fetchModelProvider(p, proxyPort, proxyKey, token));
            }
        }

        const results = await Promise.all(promises);
        const all = results.flat();

        // Add curated static models
        const nvidiaToken = await this.resolveProviderToken('nvidia');
        if (nvidiaToken) {
            all.push(...this.getNvidiaModels());
        }

        const openaiToken = await this.resolveProviderToken('openai');
        if (openaiToken) {
            all.push(...this.getOpenAIImageModels());
        }

        const unique = new Map<string, ModelProviderInfo>();
        all.forEach(m => {
            const key = `${m.provider}:${m.id}`;
            unique.set(key, m);
        });

        // Add SD-CPP
        unique.set('sd-cpp:stable-diffusion-v1-5', {
            id: 'stable-diffusion-v1-5',
            name: 'Stable Diffusion v1.5 (Local)',
            provider: 'sd-cpp',
            description: 'Local image generation via stable-diffusion.cpp',
            capabilities: { image_generation: true, text_generation: false, embedding: false },
            tags: ['local', 'image-gen', 'sd-cpp']
        });

        const allModels = Array.from(unique.values()).map(model => this.enrichModelMetadata(model));
        const missingContext = allModels.filter(
            model => (model.capabilities?.text_generation ?? true) && !model.contextWindow
        );
        if (missingContext.length > 0) {
            appLogger.info(
                'ModelRegistry',
                `Context window unresolved for ${missingContext.length}/${allModels.length} models`
            );
        }
        const settings = this.deps.settingsService.getSettings();
        const locale = settings.general?.language ?? 'en';

        return RegionalPreferenceService.applyPreferences(allModels, locale);
    }

    /**
     * Get locally installed models
     */
    async getInstalledModels(): Promise<ModelProviderInfo[]> {
        return this.fetchModelProvider('ollama');
    }

    /**
     * Curated NVIDIA catalog fallback used when token-based provider fetch is available.
     */
    private getNvidiaModels(): ModelProviderInfo[] {
        return [
            {
                id: 'nvidia/meta/llama-3.1-405b-instruct',
                name: 'Llama 3.1 405B Instruct',
                provider: 'nvidia',
                contextWindow: 128000,
                capabilities: { text_generation: true },
            },
            {
                id: 'nvidia/meta/llama-3.1-70b-instruct',
                name: 'Llama 3.1 70B Instruct',
                provider: 'nvidia',
                contextWindow: 128000,
                capabilities: { text_generation: true },
            },
            {
                id: 'nvidia/meta/llama-3.1-8b-instruct',
                name: 'Llama 3.1 8B Instruct',
                provider: 'nvidia',
                contextWindow: 128000,
                capabilities: { text_generation: true },
            },
            {
                id: 'nvidia/nvidia/llama-3.1-nemotron-70b-instruct',
                name: 'Llama 3.1 Nemotron 70B',
                provider: 'nvidia',
                contextWindow: 128000,
                capabilities: { text_generation: true },
            },
            {
                id: 'nvidia/nvidia/nemotron-4-340b-instruct',
                name: 'Nemotron-4 340B Instruct',
                provider: 'nvidia',
                contextWindow: 128000,
                capabilities: { text_generation: true },
            },
            {
                id: 'nvidia/mistralai/mixtral-8x22b-instruct-v0.1',
                name: 'Mixtral 8x22B Instruct v0.1',
                provider: 'nvidia',
                contextWindow: 65536,
                capabilities: { text_generation: true },
            },
            {
                id: 'nvidia/microsoft/phi-3-medium-4k-instruct',
                name: 'Phi-3 Medium 4K Instruct',
                provider: 'nvidia',
                contextWindow: 4096,
                capabilities: { text_generation: true },
            },
        ];
    }

    /**
     * Static OpenAI image generation models added for image-capable picker workflows.
     */
    private getOpenAIImageModels(): ModelProviderInfo[] {
        return [
            {
                id: 'openai/dall-e-3',
                name: 'DALL-E 3',
                provider: 'openai',
                description: 'DEPRECATED: OpenAI sunset 2026-04-30. Replacement: gpt-image-1.',
                deprecated: true,
                retired: false,
                replacement: 'gpt-image-1',
                capabilities: { image_generation: true },
            },
            {
                id: 'openai/dall-e-2',
                name: 'DALL-E 2',
                provider: 'openai',
                description: 'DEPRECATED: OpenAI sunset 2026-04-30. Replacement: gpt-image-1.',
                deprecated: true,
                retired: false,
                replacement: 'gpt-image-1',
                capabilities: { image_generation: true },
            },
        ];
    }
}

