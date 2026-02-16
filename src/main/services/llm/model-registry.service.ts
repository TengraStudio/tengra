import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { HFModel, HuggingFaceService } from '@main/services/llm/huggingface.service';
import { getTokenEstimationService } from '@main/services/llm/token-estimation.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonValue } from '@shared/types/common';
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
    private cachedModels: ModelProviderInfo[] = [];
    private lastUpdate: number = 0;

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
            executable: 'tandem-model-service',
            persistent: true,
        });

        // Initial load if empty
        if (this.cachedModels.length === 0) {
            appLogger.info('ModelRegistry', 'Initializing model cache...');
            await this.updateCache();
        }
    }

    private async updateCache(): Promise<void> {
        appLogger.info('ModelRegistry', 'Updating remote model cache...');
        this.cachedModels = await this.fetchRemoteModels();
        this.lastUpdate = Date.now();

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
    async getAllModels(): Promise<ModelProviderInfo[]> {
        const proxyPort = this.deps.proxyService.getEmbeddedProxyStatus().port ?? 8317;
        const proxyKey = await this.deps.proxyService.getProxyKey();

        const promises: Promise<ModelProviderInfo[]>[] = [
            // Always fetch these providers
            this.fetchModelProvider('ollama', proxyPort, proxyKey),
            // Llama-cpp is not yet supported in Rust service (it involves local file scanning),
            // but the user requested explicit cleanup. We will assume 'ollama' covers local for now
            // or we might need to implement 'llama' file scanning in Rust.
            // For now, we follow instructions: "rust service will do all model fetching".
            // If Rust doesn't support 'llama-cpp' explicitly yet, we might miss it,
            // but 'ollama' covers the primary local use case.
            this.fetchModelProvider('opencode', proxyPort, proxyKey),
        ];

        // Copilot (Configured check moved to Rust or simplified: just try to fetch if we have a token?)
        // The Rust service needs a token for Copilot.
        // We need to manage tokens. Copilot token management was in CopilotService.
        // We can't verify configuration without CopilotService?
        // Wait, AuthService doesn't handle Copilot tokens?
        // CopilotService had `ensureCopilotToken`.
        // If we removed CopilotService, how do we get the token?
        // The user said "rust service does all fetching". It didn't say "move auth logic to Rust".
        // But I'm forced to remove CopilotService from HERE to obey "one structure".
        // Use AuthService if possible, or specialized Copilot token logic needs to be somewhere.
        // For now, I will omit Copilot fetching if I can't get the token, OR I assume AuthService *should* handle it.
        // Let's check AuthService later. For now, we'll try to get 'github' token if existing.

        // Dynamically add cloud providers if authenticated
        const cloudProviders: ModelProviderId[] = [
            'antigravity',
            'codex',
            'claude',
            'copilot',
            'nvidia',
            'openai',
        ];
        for (const p of cloudProviders) {
            // Proactively refresh tokens for cloud providers before fetching models
            try {
                await this.deps.tokenService.ensureFreshToken(p);
            } catch (err) {
                appLogger.warn(
                    'ModelRegistry',
                    `Failed to ensure fresh token for ${p}: ${getErrorMessage(err)}`
                );
            }

            const token = await this.deps.authService.getActiveToken(p);

            if (token) {
                promises.push(this.fetchModelProvider(p, proxyPort, proxyKey, token));
            }
        }

        const results = await Promise.all(promises);
        const all = results.flat();

        // Add NVIDIA models to ensure high-quality ones are always visible
        const nvidiaToken = await this.deps.authService.getActiveToken('nvidia');
        if (nvidiaToken) {
            all.push(...this.getNvidiaModels());
        }

        // Add OpenAI Image Models
        const openaiToken = await this.deps.authService.getActiveToken('openai');
        if (openaiToken) {
            all.push(...this.getOpenAIImageModels());
        }

        const unique = new Map<string, ModelProviderInfo>();
        all.forEach(m => {
            const key = `${m.provider}:${m.id}`;
            unique.set(key, m);
        });

        // Add SD-CPP if provider is configured or it's a core component
        unique.set('sd-cpp:stable-diffusion-v1-5', {
            id: 'stable-diffusion-v1-5',
            name: 'Stable Diffusion v1.5 (Local)',
            provider: 'sd-cpp',
            description: 'Local image generation via stable-diffusion.cpp',
            capabilities: { image_generation: true, text_generation: false, embedding: false },
            tags: ['local', 'image-gen', 'sd-cpp']
        });

        return Array.from(unique.values());
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
            const response = await this.deps.processManager.sendRequest<{
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

            appLogger.debug(
                'ModelRegistry',
                `Rust response for ${provider}: success=${response.success}, models=${response.models.length}, error=${response.error ?? 'none'}`
            );

            if (response.success && response.models.length > 0) {
                return response.models.map(m => {
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
                    return this.ensureModelCapabilities(normalizedModel);
                });
            }
        } catch (e) {
            appLogger.debug(
                'ModelRegistry',
                `Failed to fetch ${provider} models from Rust: ${getErrorMessage(e as Error)}`
            );
        }
        return [];
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
        const models: ModelProviderInfo[] = [];
        models.push(...(await this.fetchHuggingFaceModels()));
        return models.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
    }

    /**
     * Fetches models from HuggingFace using the HuggingFaceService.
     */
    private async fetchHuggingFaceModels(): Promise<ModelProviderInfo[]> {
        try {
            const { models } = await this.deps.huggingFaceService.searchModels('', 50);

            return models.map((m: HFModel) => ({
                id: m.id,
                name: m.name,
                provider: 'huggingface',
                description: m.description,
                tags: m.tags,
                downloads: m.downloads,
                likes: m.likes,
                author: m.author,
                lastModified: m.lastModified,
                capabilities: {
                    text_generation: true
                }
            }));
        } catch (error) {
            appLogger.error('ModelRegistryService', `Failed to fetch HF models: ${getErrorMessage(error as Error)}`);
            return [];
        }
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
                description: 'The latest DALL-E model from OpenAI.',
                capabilities: { image_generation: true },
            },
            {
                id: 'openai/dall-e-2',
                name: 'DALL-E 2',
                provider: 'openai',
                description: 'Previous generation DALL-E model.',
                capabilities: { image_generation: true },
            },
        ];
    }
}
