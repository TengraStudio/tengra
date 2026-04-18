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
import { ModelProviderInfo } from '@main/services/llm/model-registry.service';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject } from '@shared/types/common';

export interface BackgroundModelSelection {
    model: string;
    provider: string;
    source: 'oauth' | 'local' | 'api-key';
}

interface BackgroundModelResolverDeps {
    authService: AuthService;
    settingsService: SettingsService;
    getModels: () => Promise<ModelProviderInfo[]>;
}

const OAUTH_PROVIDER_ORDER = ['antigravity', 'copilot', 'codex', 'claude'] as const;
const LOCAL_PROVIDER_ORDER = ['ollama', 'huggingface'] as const;

/**
 * Selects a cheap, low-impact model for background jobs such as memory
 * extraction. This intentionally does not reuse the user's active chat model.
 */
export class BackgroundModelResolver {
    private cachedSelection: { value: BackgroundModelSelection | null; expiresAt: number } | null = null;
    private readonly cacheTtlMs = 60_000;

    constructor(private readonly deps: BackgroundModelResolverDeps) { }

    async resolve(): Promise<BackgroundModelSelection | null> {
        if (this.cachedSelection && this.cachedSelection.expiresAt > Date.now()) {
            return this.cachedSelection.value;
        }

        const models = await this.safeGetModels();
        const selected =
            await this.resolveOAuthModel(models)
            ?? this.resolveLocalModel(models)
            ?? await this.resolveApiKeyModel(models);

        this.cachedSelection = {
            value: selected,
            expiresAt: Date.now() + this.cacheTtlMs,
        };

        if (selected) {
            appLogger.debug(
                'BackgroundModelResolver',
                `Selected background model provider=${selected.provider} model=${selected.model} source=${selected.source}`
            );
        } else {
            appLogger.debug('BackgroundModelResolver', 'No usable background model found');
        }

        return selected;
    }

    private async safeGetModels(): Promise<ModelProviderInfo[]> {
        try {
            return await this.deps.getModels();
        } catch (error) {
            appLogger.debug('BackgroundModelResolver', `Model registry unavailable: ${String(error)}`);
            return [];
        }
    }

    private async resolveOAuthModel(models: ModelProviderInfo[]): Promise<BackgroundModelSelection | null> {
        for (const provider of OAUTH_PROVIDER_ORDER) {
            if (!await this.hasOAuthAccount(provider)) {
                continue;
            }

            const candidate = this.pickCheapestModelForProvider(models, provider);
            if (candidate) {
                return this.toSelection(candidate, provider, 'oauth');
            }
        }
        return null;
    }

    private resolveLocalModel(models: ModelProviderInfo[]): BackgroundModelSelection | null {
        const textModels = this.filterTextModels(models);
        for (const provider of LOCAL_PROVIDER_ORDER) {
            const candidate = textModels
                .filter(model => this.providerCategory(model) === provider)
                .sort((a, b) => this.localModelScore(a) - this.localModelScore(b))[0];
            if (candidate) {
                return this.toSelection(candidate, provider, 'local');
            }
        }
        return null;
    }

    private async resolveApiKeyModel(models: ModelProviderInfo[]): Promise<BackgroundModelSelection | null> {
        const apiKeyCandidates: Array<{ provider: string; fallbackModel: string }> = [
            { provider: 'openai', fallbackModel: 'gpt-4o-mini' },
            { provider: 'claude', fallbackModel: 'claude-haiku-4.5' },
            { provider: 'gemini', fallbackModel: 'gemini-2.5-flash-lite' },
            { provider: 'nvidia', fallbackModel: '' },
        ];

        for (const candidate of apiKeyCandidates) {
            if (!await this.hasApiKey(candidate.provider)) {
                continue;
            }

            const registryModel = this.pickCheapestModelForProvider(models, candidate.provider);
            if (registryModel) {
                return this.toSelection(registryModel, this.requestProvider(candidate.provider), 'api-key');
            }

            if (candidate.fallbackModel) {
                return {
                    model: candidate.fallbackModel,
                    provider: this.requestProvider(candidate.provider),
                    source: 'api-key',
                };
            }
        }

        return null;
    }

    private pickCheapestModelForProvider(models: ModelProviderInfo[], provider: string): ModelProviderInfo | undefined {
        return this.filterTextModels(models)
            .filter(model => this.providerMatches(model, provider))
            .sort((a, b) => this.remoteModelScore(a, provider) - this.remoteModelScore(b, provider))[0];
    }

    private filterTextModels(models: ModelProviderInfo[]): ModelProviderInfo[] {
        return models.filter(model => {
            const capabilities = model.capabilities ?? {};
            if (capabilities.text_generation === false || capabilities.embedding === true || capabilities.image_generation === true) {
                return false;
            }
            const searchable = `${model.id} ${model.name ?? ''} ${model.description ?? ''}`.toLowerCase();
            return !/(embed|embedding|image|vision|audio|speech|transcribe|tts|realtime|moderation|sora|dall[-\s]?e)/i.test(searchable);
        });
    }

    private async hasOAuthAccount(provider: string): Promise<boolean> {
        const settings = this.deps.settingsService.getSettings();
        const connectedBySettings =
            (provider === 'antigravity' && settings.antigravity?.connected === true)
            || (provider === 'copilot' && settings.copilot?.connected === true)
            || (provider === 'codex' && settings.codex?.connected === true);

        const token = await this.getTokenForProvider(provider);
        if (!token) {
            return false;
        }

        if (connectedBySettings) {
            return true;
        }

        return !this.looksLikeApiKey(token);
    }

    private async hasApiKey(provider: string): Promise<boolean> {
        const settings = this.deps.settingsService.getSettings();
        if (provider === 'openai') {
            return this.hasProviderKey(settings.openai as JsonObject | undefined);
        }
        if (provider === 'claude') {
            return this.hasProviderKey(settings.anthropic as JsonObject | undefined)
                || this.hasProviderKey(settings.claude as JsonObject | undefined);
        }
        if (provider === 'gemini') {
            return this.hasProviderKey(settings.gemini as JsonObject | undefined);
        }
        if (provider === 'nvidia') {
            return this.hasProviderKey(settings.nvidia as JsonObject | undefined);
        }
        return false;
    }

    private hasProviderKey(value: JsonObject | undefined): boolean {
        if (!value) {
            return false;
        }
        const primary = typeof value.apiKey === 'string' ? value.apiKey.trim() : '';
        const keys = Array.isArray(value.apiKeys)
            ? value.apiKeys.some(key => typeof key === 'string' && key.trim().length > 0)
            : false;
        return primary.length > 0 || keys;
    }

    private async getTokenForProvider(provider: string): Promise<string | undefined> {
        const aliases = this.providerAliases(provider);
        for (const alias of aliases) {
            const token = await this.deps.authService.getActiveToken(alias);
            if (token) {
                return token;
            }
        }
        return undefined;
    }

    private providerAliases(provider: string): string[] {
        switch (provider) {
            case 'antigravity': return ['antigravity', 'google'];
            case 'copilot': return ['copilot', 'github'];
            case 'codex': return ['codex'];
            case 'claude': return ['claude', 'anthropic'];
            case 'openai': return ['openai'];
            default: return [provider];
        }
    }

    private providerMatches(model: ModelProviderInfo, provider: string): boolean {
        const category = this.providerCategory(model);
        if (provider === 'openai') {
            return category === 'openai' || category === 'codex';
        }
        if (provider === 'claude') {
            return category === 'claude' || category === 'anthropic';
        }
        if (provider === 'antigravity' || provider === 'gemini') {
            return category === 'antigravity' || category === 'gemini' || category === 'google';
        }
        return category === provider;
    }

    private providerCategory(model: ModelProviderInfo): string {
        const raw = (model.providerCategory ?? model.sourceProvider ?? model.provider).trim().toLowerCase();
        if (raw === 'github') {
            return 'copilot';
        }
        if (raw === 'anthropic') {
            return 'claude';
        }
        if (raw === 'google' || raw === 'gemini') {
            return 'antigravity';
        }
        if (raw === 'moonshot') {
            return 'kimi';
        }
        return raw;
    }

    private requestProvider(provider: string): string {
        if (provider === 'claude') {
            return 'anthropic';
        }
        return provider;
    }

    private toSelection(model: ModelProviderInfo, provider: string, source: BackgroundModelSelection['source']): BackgroundModelSelection {
        return {
            model: this.requestModelId(model),
            provider: this.requestProvider(provider),
            source,
        };
    }

    private requestModelId(model: ModelProviderInfo): string {
        const provider = this.providerCategory(model);
        if (provider === 'ollama' && model.id.startsWith('ollama/')) {
            return model.id.slice('ollama/'.length);
        }
        return model.id;
    }

    private localModelScore(model: ModelProviderInfo): number {
        const parameterScore = this.parseParameterSize(model.parameters)
            ?? this.parseParameterSize(model.name)
            ?? this.parseParameterSize(model.id);
        if (parameterScore !== undefined) {
            return parameterScore;
        }
        const rawSize = model.size;
        return typeof rawSize === 'number' && Number.isFinite(rawSize) ? rawSize / 1_000_000_000 : Number.MAX_SAFE_INTEGER;
    }

    private remoteModelScore(model: ModelProviderInfo, provider: string): number {
        const pricing = model.pricing;
        if (pricing && typeof pricing === 'object' && !Array.isArray(pricing)) {
            const input = typeof pricing.input === 'number' ? pricing.input : undefined;
            const output = typeof pricing.output === 'number' ? pricing.output : undefined;
            if (input !== undefined && output !== undefined) {
                return input + output;
            }
        }

        const searchable = `${model.id} ${model.name ?? ''}`.toLowerCase();
        const providerBias = provider === 'copilot' ? 0 : 100;
        const patterns: Array<[RegExp, number]> = [
            [/raptor[\s-_]?mini/i, providerBias + 0],
            [/gpt[\s-_]?5[\s._-]?mini/i, providerBias + 1],
            [/gpt[\s-_]?4\.1/i, providerBias + 2],
            [/claude[\s-_]?haiku[\s-_]?4\.5/i, providerBias + 3],
            [/gemini[\s-_]?2\.5[\s-_]?flash[\s-_]?lite/i, providerBias + 4],
            [/gemini[\s-_]?3[\s._-]?flash/i, providerBias + 5],
            [/gpt[\s-_]?5\.4[\s._-]?nano/i, providerBias + 6],
            [/gpt[\s-_]?5\.4[\s._-]?mini/i, providerBias + 7],
            [/gpt[\s-_]?4o[\s-_]?mini/i, providerBias + 8],
        ];

        for (const [pattern, score] of patterns) {
            if (pattern.test(searchable)) {
                return score;
            }
        }

        return Number.MAX_SAFE_INTEGER;
    }

    private parseParameterSize(value: string | undefined): number | undefined {
        if (!value) {
            return undefined;
        }
        const match = value.toLowerCase().match(/(\d+(?:\.\d+)?)\s*([bmk])\b/);
        if (!match) {
            return undefined;
        }

        const amount = Number(match[1]);
        if (!Number.isFinite(amount)) {
            return undefined;
        }

        switch (match[2]) {
            case 'b': return amount;
            case 'm': return amount / 1000;
            case 'k': return amount / 1_000_000;
            default: return undefined;
        }
    }

    private looksLikeApiKey(token: string): boolean {
        const normalized = token.trim().toLowerCase();
        return normalized.startsWith('sk-')
            || normalized.startsWith('sk_')
            || normalized.startsWith('nvapi-')
            || normalized.startsWith('gsk_')
            || normalized.startsWith('hf_');
    }
}
