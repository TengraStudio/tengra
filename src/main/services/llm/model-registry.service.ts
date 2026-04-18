/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import {
    LocalModelFileFormat,
    LocalModelRuntimeProvider,
    resolveLocalModelFileFormat,
    resolveRuntimeProviderForLocalModel,
} from '@main/services/llm/local-runtime.types';
import { resolveContextWindowForModel } from '@main/services/llm/model-context-window.data';
import { OllamaService } from '@main/services/llm/ollama.service';
import { RegionalPreferenceService } from '@main/services/llm/regional-preference.service';
import { getTokenEstimationService } from '@main/services/llm/token-estimation.service';
import { ProxyService, ProxyTelemetryEvent } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
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
    | 'cursor'
    | 'kimi'
    | 'nvidia'
    | 'openai'
    | 'huggingface'
    | 'anthropic'
    | 'sd-cpp';

/**
 * UI-facing normalized model metadata used across model list and picker views.
 */
export interface ModelProviderInfo {
    id: string;
    name: string;
    provider: string;
    providerCategory?: string;
    sourceProvider?: string;
    description?: string;
    tags?: string[];
    downloads?: number;
    likes?: number;
    contextWindow?: number;
    parameters?: string;
    fileFormat?: LocalModelFileFormat;
    runtimeProvider?: LocalModelRuntimeProvider;
    capabilities?: {
        image_generation?: boolean;
        text_generation?: boolean;
        embedding?: boolean;
    };
    [key: string]: JsonValue | undefined;
}

interface ProxyCatalogModel {
    id: string;
    name?: string;
    provider: string;
    description?: string;
    quotaInfo?: ModelProviderInfo['quotaInfo'];
    owned_by?: string;
    ownedBy?: string;
}

interface ProxyCatalogSnapshot {
    mappedModels: ModelProviderInfo[];
    rawModels: ProxyCatalogModel[];
}

export interface ModelRegistryDependencies {
    processManager: ProcessManagerService;
    jobScheduler: JobSchedulerService;
    settingsService: SettingsService;
    proxyService: ProxyService;
    eventBus: EventBusService;
    authService: AuthService;
    tokenService: TokenService;
    ollamaService: OllamaService;
    localImageService: LocalImageService;
    huggingFaceService: HuggingFaceService;
}

/**
 * Aggregates models from tengra-proxy, proxy providers, and local fallbacks.
 * Also keeps token context-window limits in sync with TokenEstimationService.
 */
export class ModelRegistryService extends BaseService {
    private static readonly OPENCODE_MODELS_URL = 'https://opencode.ai/zen/v1/models';
    private static readonly OPENCODE_DEFAULT_API_KEY = 'public';
    private static readonly OPENCODE_REQUEST_TIMEOUT_MS = 8000;
    private static readonly OPENCODE_FREE_PRICE = 0;
    private static readonly OPENCODE_PRICING_RULES: ReadonlyArray<{
        match: RegExp;
        input: number;
        output: number;
    }> = [
            { match: /big[\s-_]?pickle/i, input: 0, output: 0 },
            { match: /minimax[\s-_]?m2\.5[\s-_]?free/i, input: 0, output: 0 },
            { match: /gpt[\s-_]?5[\s-_]?nano/i, input: 0, output: 0 },
            { match: /minimax[\s-_]?m2\.5(?![\s-_]?free)/i, input: 0.30, output: 1.20 },
            { match: /minimax[\s-_]?m2\.1/i, input: 0.30, output: 1.20 },
            { match: /glm[\s-_]?5/i, input: 1.00, output: 3.20 },
            { match: /glm[\s-_]?4\.7/i, input: 0.60, output: 2.20 },
            { match: /glm[\s-_]?4\.6/i, input: 0.60, output: 2.20 },
            { match: /kimi[\s-_]?k2\.5/i, input: 0.60, output: 3.00 },
            { match: /kimi[\s-_]?k2[\s-_]?thinking/i, input: 0.40, output: 2.50 },
            { match: /kimi[\s-_]?k2(?!\.5)/i, input: 0.40, output: 2.50 },
            { match: /qwen3[\s-_]?coder[\s-_]?480b/i, input: 0.45, output: 1.50 },
            { match: /gemini[\s-_]?3(\.1)?[\s-_]?pro/i, input: 2.00, output: 12.00 },
            { match: /gemini[\s-_]?3(\.1)?[\s-_]?flash/i, input: 0.50, output: 3.00 },
            { match: /gemini[\s-_]?3\.1[\s-_]?flash[\s-_]?lite/i, input: 0.25, output: 1.50 },
            { match: /gpt[\s-_]?5\.4[\s-_]?mini/i, input: 0.15, output: 0.60 },
            { match: /gpt[\s-_]?5\.4/i, input: 2.50, output: 10.00 },
            { match: /gpt[\s-_]?5\.2([\s-_]?codex)?[\s-_]?pro/i, input: 1.50, output: 7.50 },
            { match: /gpt[\s-_]?5\.2([\s-_]?codex)?/i, input: 0.50, output: 2.50 },
            { match: /gpt[\s-_]?5([\s-_]?codex)?[\s-_]?pro/i, input: 1.00, output: 5.00 },
            { match: /gpt[\s-_]?5([\s-_]?codex)?[\s-_]?mini/i, input: 0.10, output: 0.50 },
            { match: /gpt[\s-_]?5([\s-_]?codex)?[\s-_]?nano/i, input: 0.05, output: 0.25 },
            { match: /gpt[\s-_]?5([\s-_]?codex)?/i, input: 0.25, output: 1.25 },
            { match: /claude[\s-_]?opus[\s-_]?4\.6/i, input: 5.00, output: 25.00 },
            { match: /claude[\s-_]?sonnet[\s-_]?4\.6/i, input: 3.00, output: 15.00 },
            { match: /claude[\s-_]?haiku[\s-_]?4\.5/i, input: 1.00, output: 5.00 },
            { match: /claude[\s-_]?haiku[\s-_]?3\.5/i, input: 0.80, output: 4.00 },
        ];
    private static readonly KNOWN_PROVIDER_IDS: ReadonlySet<string> = new Set([
        'ollama',
        'opencode',
        'antigravity',
        'codex',
        'claude',
        'copilot',
        'cursor',
        'kimi',
        'moonshot',
        'nvidia',
        'openai',
        'huggingface',
        'anthropic',
        'sd-cpp',
        'github',
    ]);

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

    private static readonly SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;
    private static readonly NVIDIA_RECOVERY_ATTEMPTS = 2;
    private static readonly NVIDIA_RECOVERY_DELAY_MS = 1500;
    private static readonly COPILOT_RECOVERY_ATTEMPTS = 2;
    private static readonly COPILOT_RECOVERY_DELAY_MS = 1500;
    private static readonly INITIAL_CACHE_WARMUP_DELAY_MS = 15000;
    private cachedModels: ModelProviderInfo[] = [];
    private lastUpdate: number = 0;
    private cacheRefreshPromise: Promise<void> | null = null;
    private initialWarmupTimeout: ReturnType<typeof setTimeout> | null = null;
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
                const settings = this.deps.settingsService.getSettings();
                return settings.ai?.modelUpdateInterval ?? 60 * 60 * 1000;
            }
        );
    }

    override async initialize(): Promise<void> {
        // Listen for account changes to refresh models
        this.deps.eventBus.on('account:linked', () => {
            appLogger.debug('ModelRegistry', 'Account linked, refreshing model cache...');
            void this.updateCache();
        });
        this.deps.eventBus.on('account:updated', () => {
            appLogger.debug('ModelRegistry', 'Account updated, refreshing model cache...');
            void this.updateCache();
        });
        this.deps.eventBus.on('account:unlinked', () => {
            appLogger.debug('ModelRegistry', 'Account unlinked, refreshing model cache...');
            void this.updateCache();
        });
        this.deps.eventBus.onCustom(ProxyTelemetryEvent.PROXY_STARTED, () => {
            appLogger.debug('ModelRegistry', 'Embedded proxy reported ready, refreshing model cache...');
            void this.updateCache();
        });

        if (this.cachedModels.length === 0) {
            this.scheduleInitialCacheWarmup();
        }
    }

    private scheduleInitialCacheWarmup(): void {
        if (this.initialWarmupTimeout || this.cachedModels.length > 0) {
            return;
        }

        appLogger.debug(
            'ModelRegistry',
            `Deferring initial model cache warmup by ${ModelRegistryService.INITIAL_CACHE_WARMUP_DELAY_MS}ms`
        );
        this.initialWarmupTimeout = setTimeout(() => {
            this.initialWarmupTimeout = null;
            appLogger.debug('ModelRegistry', 'Running deferred initial model cache warmup...');
            void this.updateCache();
        }, ModelRegistryService.INITIAL_CACHE_WARMUP_DELAY_MS);

        if (typeof this.initialWarmupTimeout.unref === 'function') {
            this.initialWarmupTimeout.unref();
        }
    }

    private async updateCache(): Promise<void> {
        if (this.cacheRefreshPromise) {
            return this.cacheRefreshPromise;
        }
        this.cacheRefreshPromise = this.performCacheUpdate().finally(() => {
            this.cacheRefreshPromise = null;
        });
        return this.cacheRefreshPromise;
    }

    private async performCacheUpdate(): Promise<void> {
        this.telemetry.cacheUpdates += 1;
        this.trackTelemetry('model-registry.cache.update.started');
        appLogger.debug('ModelRegistry', 'Updating remote model cache...');
        const remoteModels = await this.fetchRemoteModelsWithRecovery();
        this.cachedModels = this.mergeConnectedProviderModels(remoteModels, this.cachedModels);
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

        appLogger.debug('ModelRegistry', `Cache updated with ${this.cachedModels.length} models`);
        this.trackTelemetry('model-registry.cache.update.completed', {
            modelCount: this.cachedModels.length,
        });
        this.deps.eventBus.emit('model:updated', {
            provider: 'all',
            count: this.cachedModels.length,
            timestamp: this.lastUpdate,
        });
    }

    private mergeConnectedProviderModels(
        nextModels: ModelProviderInfo[],
        previousModels: ModelProviderInfo[]
    ): ModelProviderInfo[] {
        if (!this.shouldPreserveConnectedCopilotModels(nextModels, previousModels)) {
            return nextModels;
        }

        const merged = [...nextModels];
        const seenKeys = new Set(nextModels.map(model => `${model.provider}:${model.id}`));
        const previousCopilotModels = previousModels.filter(model => this.isCopilotProvider(model.providerCategory ?? model.provider));
        let preservedCount = 0;

        for (const previousModel of previousCopilotModels) {
            const modelKey = `${previousModel.provider}:${previousModel.id}`;
            if (seenKeys.has(modelKey)) {
                continue;
            }
            merged.push(previousModel);
            seenKeys.add(modelKey);
            preservedCount += 1;
        }

        appLogger.debug(
            'ModelRegistry',
            `Preserved ${preservedCount} cached Copilot model(s) during transient proxy catalog gap`
        );
        return merged;
    }

    private shouldPreserveConnectedCopilotModels(
        nextModels: ModelProviderInfo[],
        previousModels: ModelProviderInfo[]
    ): boolean {
        const settings = this.deps.settingsService.getSettings();
        if (settings.copilot?.connected !== true) {
            return false;
        }
        if (nextModels.some(model => this.isCopilotProvider(model.providerCategory ?? model.provider))) {
            return false;
        }
        return previousModels.some(model => this.isCopilotProvider(model.providerCategory ?? model.provider));
    }

    private isCopilotProvider(provider: string | undefined): boolean {
        const normalizedProvider = (provider ?? '').trim().toLowerCase();
        return normalizedProvider === 'copilot' || normalizedProvider === 'github';
    }

    private async fetchRemoteModelsWithRecovery(): Promise<ModelProviderInfo[]> {
        let models = await this.fetchRemoteModels();
        if (!this.requiresProviderRecovery(models)) {
            return models;
        }

        const attempts = this.resolveRecoveryAttemptCount();
        const delayMs = this.resolveRecoveryDelayMs();
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            await this.delay(delayMs);
            models = await this.fetchRemoteModels();
            if (!this.requiresProviderRecovery(models)) {
                return models;
            }
        }

        return models;
    }

    private resolveRecoveryAttemptCount(): number {
        return Math.max(
            ModelRegistryService.NVIDIA_RECOVERY_ATTEMPTS,
            ModelRegistryService.COPILOT_RECOVERY_ATTEMPTS
        );
    }

    private resolveRecoveryDelayMs(): number {
        return Math.max(
            ModelRegistryService.NVIDIA_RECOVERY_DELAY_MS,
            ModelRegistryService.COPILOT_RECOVERY_DELAY_MS
        );
    }

    private requiresProviderRecovery(models: ModelProviderInfo[]): boolean {
        return this.requiresNvidiaRecovery(models) || this.requiresCopilotRecovery(models);
    }

    private requiresNvidiaRecovery(models: ModelProviderInfo[]): boolean {
        const settings = this.deps.settingsService.getSettings();
        if (!settings.nvidia?.apiKey?.trim()) {
            return false;
        }

        const nvidiaModels = models.filter(model => model.provider === 'nvidia');
        return nvidiaModels.length <= 1;
    }

    private requiresCopilotRecovery(models: ModelProviderInfo[]): boolean {
        const settings = this.deps.settingsService.getSettings();
        if (settings.copilot?.connected !== true) {
            return false;
        }

        const copilotModels = models.filter(model => this.isCopilotProvider(model.providerCategory ?? model.provider));
        return copilotModels.length === 0;
    }

    private async delay(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    private isSnapshotStale(): boolean {
        if (this.lastUpdate === 0) {
            return true;
        }
        return Date.now() - this.lastUpdate > ModelRegistryService.SNAPSHOT_MAX_AGE_MS;
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
     * This is a cache-aware wrapper that merges remote and local installed models.
     */
    async getAllModels(): Promise<ModelProviderInfo[]> {
        const [remoteModels, installedModels] = await Promise.all([
            this.getRemoteModels(),
            this.getInstalledModels(),
        ]);

        const unique = new Map<string, ModelProviderInfo>();
        for (const model of [...remoteModels, ...installedModels]) {
            unique.set(`${model.provider}:${model.id}`, model);
        }

        return Array.from(unique.values());
    }

    private getTokenProviderAliases(provider: ModelProviderId): readonly string[] {
        switch (provider) {
            case 'antigravity':
                return ['antigravity', 'google', 'gemini'];
            case 'codex':
                return ['codex', 'openai'];
            case 'openai':
                return ['openai', 'codex'];
            case 'claude':
            case 'anthropic':
                return ['claude', 'anthropic'];
            case 'copilot':
                return ['copilot', 'github'];
            case 'cursor':
                return ['cursor'];
            case 'kimi':
                return ['kimi', 'moonshot'];
            case 'nvidia':
                return ['nvidia'];
            default:
                return [provider];
        }
    }

    private async resolveTokenFromAliases(aliases: readonly string[]): Promise<string | undefined> {
        for (const alias of aliases) {
            const activeToken = await this.deps.authService.getActiveToken(alias);
            if (activeToken) {
                return activeToken;
            }
        }

        for (const alias of aliases) {
            const accounts = await this.deps.authService.getAccountsByProviderFull(alias);
            const activeAccount = accounts.find(account => account.isActive);
            const activeToken = activeAccount?.accessToken ?? activeAccount?.sessionToken ?? activeAccount?.refreshToken;
            if (activeToken) {
                return activeToken;
            }
            const fallbackToken = accounts
                .map(account => account.accessToken ?? account.sessionToken ?? account.refreshToken)
                .find(token => typeof token === 'string' && token.trim().length > 0);
            if (fallbackToken) {
                return fallbackToken;
            }
        }

        return undefined;
    }

    private async resolveProviderToken(provider: ModelProviderId): Promise<string | undefined> {
        const tokenFromAccounts = await this.resolveTokenFromAliases(this.getTokenProviderAliases(provider));
        if (tokenFromAccounts) {
            return tokenFromAccounts;
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
            return readKey(settings.antigravity);
        }
        return undefined;
    }

    private async fetchProxyCatalog(): Promise<ProxyCatalogSnapshot> {
        try {
            const response = await this.deps.proxyService.getRawModelCatalog();
            if (!Array.isArray(response.data)) {
                appLogger.warn(
                    'ModelRegistry',
                    `[${ModelRegistryService.ERROR_CODES.MALFORMED_RESPONSE}] Ignoring malformed proxy model response`
                );
                return { mappedModels: [], rawModels: [] };
            }
            const rawModels = response.data
                .filter(model =>
                    typeof model.id === 'string'
                    && model.id.trim().length > 0
                    && typeof model.provider === 'string'
                    && model.provider.trim().length > 0
                );
            return {
                mappedModels: rawModels.map(model => this.mapProxyModel(model)),
                rawModels,
            };
        } catch (e) {
            this.telemetry.providerFetchFailures += 1;
            this.trackTelemetry('model-registry.provider.fetch.failed', { provider: 'proxy' });
            appLogger.debug(
                'ModelRegistry',
                `[${ModelRegistryService.ERROR_CODES.FETCH_FAILED}] Failed to fetch models from tengra-proxy: ${getErrorMessage(e as Error)}`
            );
        }
        return { mappedModels: [], rawModels: [] };
    }

    private mapProxyModel(model: ProxyCatalogModel): ModelProviderInfo {
        const normalizedRawProvider = model.provider.trim().toLowerCase();
        let requestedProvider: ModelProviderId = 'antigravity';
        if (normalizedRawProvider === 'ollama') {
            requestedProvider = 'ollama';
        } else if (normalizedRawProvider === 'opencode') {
            requestedProvider = 'opencode';
        } else if (normalizedRawProvider === 'codex') {
            requestedProvider = 'codex';
        } else if (normalizedRawProvider === 'claude' || normalizedRawProvider === 'anthropic') {
            requestedProvider = 'claude';
        } else if (normalizedRawProvider === 'copilot' || normalizedRawProvider === 'github') {
            requestedProvider = 'copilot';
        } else if (normalizedRawProvider === 'cursor') {
            requestedProvider = 'cursor';
        } else if (normalizedRawProvider === 'kimi' || normalizedRawProvider === 'moonshot') {
            requestedProvider = 'kimi';
        } else if (normalizedRawProvider === 'nvidia' || normalizedRawProvider === 'nim' || normalizedRawProvider === 'nim_openai') {
            requestedProvider = 'nvidia';
        } else if (normalizedRawProvider === 'openai') {
            requestedProvider = 'openai';
        } else if (normalizedRawProvider === 'huggingface') {
            requestedProvider = 'huggingface';
        } else if (normalizedRawProvider === 'sd-cpp') {
            requestedProvider = 'sd-cpp';
        }
        const mappedProvider = this.resolveCanonicalProvider(model.provider, requestedProvider);
        const normalizedId = this.normalizeProxyModelId(mappedProvider, model.id);
        const normalizedModel: ModelProviderInfo = {
            id: normalizedId,
            name: model.name ?? model.id,
            provider: mappedProvider,
            sourceProvider: mappedProvider,
            description: model.description,
            quotaInfo: model.quotaInfo,
        };
        return this.enrichModelMetadata(normalizedModel);
    }

    private trackTelemetry(name: SystemEventKey, properties: Record<string, RuntimeValue> = {}): void {
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

    private ensureProviderMetadata(model: ModelProviderInfo): ModelProviderInfo {
        const normalizedProvider = model.provider.trim().toLowerCase();
        const normalizedSourceProvider = (model.sourceProvider ?? '').trim().toLowerCase();
        const categoryProvider = normalizedSourceProvider === '' ? normalizedProvider : normalizedSourceProvider;
        return {
            ...model,
            provider: normalizedProvider,
            sourceProvider: categoryProvider,
            providerCategory: this.resolveProviderCategory(categoryProvider),
        };
    }

    private resolveProviderCategory(provider: string): string {
        const p = provider.toLowerCase();
        if (p === 'copilot' || p === 'github') {
            return 'copilot';
        }
        if (p === 'cursor') {
            return 'cursor';
        }
        if (p === 'kimi' || p === 'moonshot') {
            return 'kimi';
        }
        if (p === 'antigravity' || p === 'google' || p === 'gemini') {
            return 'antigravity';
        }
        if (p === 'codex' || p === 'openai') {
            return 'codex';
        }
        if (p === 'claude' || p === 'anthropic') {
            return 'claude';
        }
        return p;
    }

    private resolveCanonicalProvider(rawProvider: string, requestedProvider: ModelProviderId): string {
        const raw = rawProvider.trim().toLowerCase();

        if (raw === 'github') {
            return 'copilot';
        }
        if (raw === 'moonshot') {
            return 'kimi';
        }
        if (raw === 'google' || raw === 'gemini') {
            return 'antigravity';
        }
        if (raw === 'openai') {
            return 'codex';
        }
        if (raw === 'anthropic') {
            return 'claude';
        }
        if (raw === 'nvidia_key' || raw === 'nim' || raw === 'nim_openai') {
            return 'nvidia';
        }

        if (raw === '' || !ModelRegistryService.KNOWN_PROVIDER_IDS.has(raw)) {
            return requestedProvider;
        }
        return raw;
    }

    private enrichModelMetadata(model: ModelProviderInfo): ModelProviderInfo {
        const withProviderMetadata = this.ensureProviderMetadata(model);
        const withCapabilities = this.ensureModelCapabilities(withProviderMetadata);
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

    /** Clears the model cache and resets telemetry counters. */
    override async cleanup(): Promise<void> {
        if (this.initialWarmupTimeout) {
            clearTimeout(this.initialWarmupTimeout);
            this.initialWarmupTimeout = null;
        }
        this.cachedModels = [];
        this.lastUpdate = 0;
        this.logInfo('Model registry service cleaned up');
    }

    /**
     * Get cached remote models.
     */
    async getRemoteModels(): Promise<ModelProviderInfo[]> {
        if (this.cachedModels.length === 0) {
            if (this.initialWarmupTimeout) {
                clearTimeout(this.initialWarmupTimeout);
                this.initialWarmupTimeout = null;
            }
            await this.updateCache();
            return this.cachedModels;
        }

        if (this.isSnapshotStale()) {
            void this.updateCache();
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
        const proxyCatalog = await this.fetchProxyCatalog();
        const all = [...proxyCatalog.mappedModels];
        const openCodeModels = await this.fetchOpenCodeModels();
        all.push(...openCodeModels);

        const openaiToken = await this.resolveProviderToken('openai');
        if (openaiToken) {
            all.push(...this.getOpenAIImageModels());
        }
        const mergedWithProxy = this.mergeProxyRegisteredModels(all, proxyCatalog.rawModels);

        const unique = new Map<string, ModelProviderInfo>();
        mergedWithProxy.forEach(m => {
            const key = `${m.provider}:${m.id}`;
            unique.set(key, m);
        });

        const allModels = Array.from(unique.values()).map(model => this.enrichModelMetadata(model));
        const missingContext = allModels.filter(
            model => (model.capabilities?.text_generation ?? true) && !model.contextWindow
        );
        if (missingContext.length > 0) {
            appLogger.debug(
                'ModelRegistry',
                `Context window unresolved for ${missingContext.length}/${allModels.length} models`
            );
        }
        const settings = this.deps.settingsService.getSettings();
        const locale = settings.general?.language ?? 'en';

        return RegionalPreferenceService.applyPreferences(allModels, locale);
    }

    private async fetchOpenCodeModels(): Promise<ModelProviderInfo[]> {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            ModelRegistryService.OPENCODE_REQUEST_TIMEOUT_MS
        );

        try {
            const apiKey = process.env.OPENCODE_API_KEY?.trim()
                || ModelRegistryService.OPENCODE_DEFAULT_API_KEY;
            const hasUserProvidedOpenCodeKey = apiKey.toLowerCase() !== ModelRegistryService.OPENCODE_DEFAULT_API_KEY;
            const response = await fetch(ModelRegistryService.OPENCODE_MODELS_URL, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                signal: controller.signal,
            });
            if (!response.ok) {
                return [];
            }
            const payload = await response.json() as JsonValue;
            const parsed = this.parseOpenCodeModels(payload);
            if (hasUserProvidedOpenCodeKey) {
                return parsed;
            }
            return parsed.filter(model => {
                const pricing = model.pricing as { input?: number; output?: number } | undefined;
                return pricing?.input === 0 && pricing?.output === 0;
            });
        } catch (e) {
            this.telemetry.providerFetchFailures += 1;
            this.trackTelemetry('model-registry.provider.fetch.failed', { provider: 'opencode' });
            appLogger.debug(
                'ModelRegistry',
                `[${ModelRegistryService.ERROR_CODES.FETCH_FAILED}] Failed to fetch OpenCode models: ${getErrorMessage(e as Error)}`
            );
            return [];
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private parseOpenCodeModels(payload: JsonValue): ModelProviderInfo[] {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return [];
        }
        const rawData = payload['data'];
        if (!Array.isArray(rawData)) {
            return [];
        }

        return rawData
            .map(item => {
                if (!item || typeof item !== 'object' || Array.isArray(item)) {
                    return null;
                }
                const rawId = item['id'];
                const rawName = item['name'];
                if (typeof rawId !== 'string' || rawId.trim() === '') {
                    return null;
                }
                const id = rawId.trim();
                const name = typeof rawName === 'string' && rawName.trim() !== '' ? rawName.trim() : id;
                const pricing = this.resolveOpenCodePricing(id, name);
                return this.enrichModelMetadata({
                    id,
                    name,
                    provider: 'opencode',
                    sourceProvider: 'opencode',
                    pricing,
                });
            })
            .filter((model): model is ModelProviderInfo => model !== null);
    }

    private resolveOpenCodePricing(id: string, name: string): { input: number; output: number } | undefined {
        const searchable = `${id} ${name}`.toLowerCase();
        const matched = ModelRegistryService.OPENCODE_PRICING_RULES.find(rule => rule.match.test(searchable));
        if (!matched) {
            return undefined;
        }
        if (matched.input === ModelRegistryService.OPENCODE_FREE_PRICE
            && matched.output === ModelRegistryService.OPENCODE_FREE_PRICE) {
            return { input: 0, output: 0 };
        }
        return { input: matched.input, output: matched.output };
    }

    /**
     * Get locally installed models
     */
    async getInstalledModels(): Promise<ModelProviderInfo[]> {
        const [ollamaModels, huggingFaceModels] = await Promise.all([
            this.getInstalledOllamaModels(),
            this.getInstalledHuggingFaceModels(),
        ]);
        return [...ollamaModels, ...huggingFaceModels];
    }

    private async getInstalledOllamaModels(): Promise<ModelProviderInfo[]> {
        try {
            const models = await this.deps.ollamaService.getModels();
            return models
                .filter(model => typeof model.name === 'string' && model.name.trim().length > 0)
                .map(model => this.enrichModelMetadata({
                    id: `ollama/${model.name}`,
                    name: model.name,
                    provider: 'ollama',
                    sourceProvider: 'ollama',
                    contextWindow: this.resolveOllamaContextWindow(model.name),
                    parameters: model.details?.parameter_size,
                    capabilities: { text_generation: true },
                }));
        } catch (error) {
            this.telemetry.providerFetchFailures += 1;
            this.trackTelemetry('model-registry.provider.fetch.failed', { provider: 'ollama' });
            appLogger.debug(
                'ModelRegistry',
                `[${ModelRegistryService.ERROR_CODES.FETCH_FAILED}] Failed to fetch installed Ollama models: ${getErrorMessage(error as Error)}`
            );
            return [];
        }
    }

    private async getInstalledHuggingFaceModels(): Promise<ModelProviderInfo[]> {
        try {
            const installed = await this.deps.huggingFaceService.listInstalledModels();
            return installed.map(model => this.enrichModelMetadata({
                id: model.modelId,
                name: this.resolveHuggingFaceModelName(model.modelId),
                provider: 'huggingface',
                sourceProvider: 'huggingface',
                contextWindow: model.contextLength,
                capabilities: { text_generation: true },
                backend: model.runtimeProvider ?? resolveRuntimeProviderForLocalModel(model.path),
                runtimeProvider: model.runtimeProvider ?? resolveRuntimeProviderForLocalModel(model.path),
                fileFormat: model.fileFormat ?? resolveLocalModelFileFormat(model.path),
                localPath: model.path,
            }));
        } catch (error) {
            this.telemetry.providerFetchFailures += 1;
            this.trackTelemetry('model-registry.provider.fetch.failed', { provider: 'huggingface' });
            appLogger.debug(
                'ModelRegistry',
                `[${ModelRegistryService.ERROR_CODES.FETCH_FAILED}] Failed to fetch installed Hugging Face models: ${getErrorMessage(error as Error)}`
            );
            return [];
        }
    }

    private resolveHuggingFaceModelName(modelId: string): string {
        const trimmed = modelId.trim();
        if (trimmed === '') {
            return 'Hugging Face Model';
        }
        const parts = trimmed.split('/');
        const candidate = parts[parts.length - 1];
        return candidate && candidate.trim() !== '' ? candidate : trimmed;
    }

    private resolveOllamaContextWindow(modelName: string): number | undefined {
        return resolveContextWindowForModel({
            id: `ollama/${modelName}`,
            name: modelName,
            provider: 'ollama',
        });
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

    private mergeProxyRegisteredModels(
        models: ModelProviderInfo[],
        proxyModels: ProxyCatalogModel[]
    ): ModelProviderInfo[] {
        if (proxyModels.length === 0) {
            return models;
        }

        const registeredImageIdsByProvider: Record<string, Set<string>> = {};
        for (const proxyModel of proxyModels) {
            const provider = this.resolveProxyModelProvider(proxyModel);
            if (!registeredImageIdsByProvider[provider]) {
                registeredImageIdsByProvider[provider] = new Set();
            }
            const modelId = typeof proxyModel.id === 'string' ? proxyModel.id.trim().toLowerCase() : '';
            if (modelId.includes('image')) {
                registeredImageIdsByProvider[provider].add(modelId);
            }
        }

        const merged = models.filter(model => {
            const provider = model.provider;

            if (model.capabilities?.image_generation === true || this.isAntigravityImageModel(model)) {
                const modelId = model.id.trim().toLowerCase();
                const registeredImageIds = registeredImageIdsByProvider[provider];

                if (registeredImageIds && registeredImageIds.size > 0 && !registeredImageIds.has(modelId)) {
                    return false;
                }
            }

            const modelId = model.id.trim().toLowerCase();
            const idWithoutPrefix = modelId.replace(/^[a-z-]+\//, '');

            if (idWithoutPrefix === 'gemini-3.1-flash-lite') {
                return false;
            }

            return true;
        });
        const existing = new Set(merged.map(model => `${model.provider}:${model.id}`));

        for (const proxyModel of proxyModels) {
            const provider = this.resolveProxyModelProvider(proxyModel);
            const modelId = typeof proxyModel.id === 'string'
                ? this.normalizeProxyModelId(provider, proxyModel.id)
                : '';
            if (modelId === '') {
                continue;
            }

            const key = `${provider}:${modelId}`;
            if (existing.has(key)) {
                continue;
            }

            merged.push(this.enrichModelMetadata({
                id: modelId,
                name: typeof proxyModel.name === 'string' && proxyModel.name.trim() !== '' ? proxyModel.name : modelId,
                provider: provider as ModelProviderId,
                sourceProvider: provider as ModelProviderId,
                description: typeof proxyModel.description === 'string' ? proxyModel.description : undefined,
                quotaInfo: proxyModel.quotaInfo,
            }));
            existing.add(key);
        }

        return merged;
    }

    private normalizeProxyModelId(provider: string, rawId: string): string {
        const trimmedId = rawId.trim();
        if (provider === 'nvidia' && trimmedId !== '' && !trimmedId.startsWith('nvidia/')) {
            return `nvidia/${trimmedId}`;
        }
        return trimmedId;
    }

    private isAntigravityImageModel(model: ModelProviderInfo): boolean {
        if (model.capabilities?.image_generation === true) {
            return true;
        }

        const searchable = `${model.id} ${model.name ?? ''} ${model.description ?? ''}`.toLowerCase();
        return searchable.includes('image');
    }

    private resolveProxyModelProvider(model: {
        provider?: string;
        owned_by?: string;
        ownedBy?: string;
        id: string;
    }): ModelProviderId {
        const explicitProvider = typeof model.provider === 'string' ? model.provider.trim().toLowerCase() : '';
        if (explicitProvider !== '') {
            return this.resolveCanonicalProvider(explicitProvider, 'antigravity') as ModelProviderId;
        }

        const ownedByRaw = typeof model.owned_by === 'string'
            ? model.owned_by
            : typeof model.ownedBy === 'string'
                ? model.ownedBy
                : '';
        const ownedBy = ownedByRaw.trim().toLowerCase();

        // Try to infer provider from ID if ownedBy is missing
        const fallback = this.inferProviderFromId(model.id);

        if (ownedBy !== '') {
            return this.resolveCanonicalProvider(ownedBy, fallback) as ModelProviderId;
        }

        return this.resolveCanonicalProvider(model.id, fallback) as ModelProviderId;
    }

    private inferProviderFromId(id: string): ModelProviderId {
        const lowerId = id.toLowerCase();
        if (lowerId.includes('gpt') || lowerId.includes('openai') || lowerId.includes('o1') || lowerId.includes('o3')) {
            return 'codex';
        }
        if (lowerId.includes('claude') || lowerId.includes('anthropic')) {
            return 'claude';
        }
        if (lowerId.includes('gemini') || lowerId.includes('google')) {
            return 'antigravity';
        }
        if (lowerId.includes('copilot') || lowerId.includes('github')) {
            return 'copilot';
        }
        if (lowerId.includes('cursor')) {
            return 'cursor';
        }
        if (lowerId.includes('kimi') || lowerId.includes('moonshot')) {
            return 'kimi';
        }
        return 'antigravity';
    }
}
