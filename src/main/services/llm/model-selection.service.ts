/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ModelProviderInfo } from '@main/services/llm/model-registry.service';
import { AuthService } from '@main/services/security/auth.service';

export interface ModelSelectionResult {
    model: string;
    provider: string;
    source: 'oauth' | 'local' | 'api-key';
}

interface ModelSelectionDeps {
    authService: AuthService;
    getModels: () => Promise<ModelProviderInfo[]>;
}

const OAUTH_PROVIDER_ORDER = ['antigravity', 'copilot', 'codex', 'claude'] as const;
const LOCAL_PROVIDER_ORDER = ['ollama', 'huggingface'] as const;

/**
 * Centralized model selection strategy used by background services.
 */
export class ModelSelectionService {
    constructor(private readonly deps: ModelSelectionDeps) { }

    async recommendBackgroundModel(): Promise<{
        selection: ModelSelectionResult | null;
        reason: string;
        candidates: Array<{
            provider: string;
            source: ModelSelectionResult['source'];
            model?: string;
            accountCount: number;
            score: number;
        }>;
    }> {
        const models = await this.safeGetModels();
        const candidates: Array<{
            provider: string;
            source: ModelSelectionResult['source'];
            model?: string;
            accountCount: number;
            score: number;
        }> = [];

        for (const provider of OAUTH_PROVIDER_ORDER) {
            const accountCount = await this.countOAuthAccounts(provider);
            if (accountCount <= 0) {
                continue;
            }
            const candidateModel = this.pickCheapestModelForProvider(models, provider);
            const modelId = candidateModel ? this.requestModelId(candidateModel) : undefined;
            candidates.push({
                provider,
                source: 'oauth',
                model: modelId,
                accountCount,
                score: 300 + (accountCount * 20) + (candidateModel ? (1000 - Math.min(this.remoteModelScore(candidateModel, provider), 1000)) : 0),
            });
        }

        for (const provider of LOCAL_PROVIDER_ORDER) {
            const textModels = this.filterTextModels(models)
                .filter(model => this.providerCategory(model) === provider)
                .sort((a, b) => this.localModelScore(a) - this.localModelScore(b));
            const best = textModels[0];
            if (!best) {
                continue;
            }
            candidates.push({
                provider,
                source: 'local',
                model: this.requestModelId(best),
                accountCount: textModels.length,
                score: 200 + Math.min(80, textModels.length * 5),
            });
        }

        const apiKeyCandidates: Array<{ provider: string; fallbackModel: string }> = [
            { provider: 'openai', fallbackModel: 'gpt-4o-mini' },
            { provider: 'anthropic', fallbackModel: 'claude-haiku-4.5' },
            { provider: 'gemini', fallbackModel: 'gemini-2.5-flash-lite' },
            { provider: 'nvidia', fallbackModel: 'z-ai/glm-5.1' },
        ];
        for (const providerCandidate of apiKeyCandidates) {
            const accountCount = await this.countApiKeyAccounts(providerCandidate.provider);
            if (accountCount <= 0) {
                continue;
            }
            const best = this.pickCheapestModelForProvider(models, providerCandidate.provider);
            candidates.push({
                provider: providerCandidate.provider,
                source: 'api-key',
                model: best ? this.requestModelId(best) : providerCandidate.fallbackModel,
                accountCount,
                score: 100 + (accountCount * 10) + (best ? (500 - Math.min(this.remoteModelScore(best, providerCandidate.provider), 500)) : 0),
            });
        }

        const ranked = candidates
            .filter(candidate => typeof candidate.model === 'string' && candidate.model.length > 0)
            .sort((left, right) => right.score - left.score);
        const chosen = ranked[0];
        if (!chosen) {
            return {
                selection: null,
                reason: 'No eligible models found from oauth/local/api-key sources.',
                candidates: [],
            };
        }

        const reasonParts = [
            `Selected ${chosen.provider}/${chosen.model} via ${chosen.source}`,
            `accounts=${chosen.accountCount}`,
            chosen.accountCount > 1 ? 'multi-account eligible' : 'single-account',
        ];
        return {
            selection: {
                provider: chosen.provider,
                model: chosen.model as string,
                source: chosen.source,
            },
            reason: reasonParts.join(', '),
            candidates: ranked,
        };
    }

    async selectBackgroundModel(): Promise<ModelSelectionResult | null> {
        const recommendation = await this.recommendBackgroundModel();
        return recommendation.selection;
    }

    private async safeGetModels(): Promise<ModelProviderInfo[]> {
        try {
            return await this.deps.getModels();
        } catch {
            return [];
        }
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

    private async countOAuthAccounts(provider: string): Promise<number> {
        const aliases = this.providerAliases(provider);
        let count = 0;
        for (const alias of aliases) {
            const accounts = await this.deps.authService.getAccountsByProviderFull(alias);
            count += accounts.filter(account => this.isOAuthAccount(account)).length;
        }
        return count;
    }

    private async countApiKeyAccounts(provider: string): Promise<number> {
        const aliases = this.providerAliases(provider);
        let count = 0;
        for (const alias of aliases) {
            const accounts = await this.deps.authService.getAccountsByProviderFull(alias);
            count += accounts.filter(account => this.isApiKeyAccount(account)).length;
        }
        return count;
    }

    private providerAliases(provider: string): string[] {
        switch (provider) {
            case 'antigravity': return ['antigravity', 'google'];
            case 'copilot': return ['copilot'];
            case 'codex': return ['codex'];
            case 'claude': return ['claude'];
            case 'anthropic': return ['anthropic'];
            case 'openai': return ['openai', 'codex'];
            default: return [provider];
        }
    }

    private providerMatches(model: ModelProviderInfo, provider: string): boolean {
        const category = this.providerCategory(model);
        if (provider === 'openai') {
            return category === 'openai' || category === 'codex';
        }
        if (provider === 'claude') {
            return category === 'claude';
        }
        if (provider === 'anthropic') {
            return category === 'anthropic';
        }
        if (provider === 'antigravity' || provider === 'gemini') {
            return category === 'antigravity' || category === 'gemini' || category === 'google';
        }
        return category === provider;
    }

    private providerCategory(model: ModelProviderInfo): string {
        const raw = (model.providerCategory ?? model.sourceProvider ?? model.provider).trim().toLowerCase();
        if (raw === 'google' || raw === 'gemini') {
            return 'antigravity';
        }
        if (raw === 'moonshot') {
            return 'kimi';
        }
        return raw;
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
            || normalized.startsWith('hf_')
            || normalized.startsWith('aiza')
            || normalized.startsWith('pplx-')
            || normalized.startsWith('xai-');
    }

    private isApiKeyAccount(account: {
        accessToken?: string;
        refreshToken?: string;
        sessionToken?: string;
        metadata?: RuntimeValue;
    }): boolean {
        const metadata = (account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata))
            ? (account.metadata as Record<string, unknown>)
            : undefined;
        const authType = this.readMetadataString(metadata, 'auth_type', 'authType');
        const metadataType = this.readMetadataString(metadata, 'type');
        if (authType === 'oauth' || metadataType === 'oauth') {
            return false;
        }
        if (authType === 'api_key' || metadataType === 'api_key') {
            return typeof account.accessToken === 'string' && account.accessToken.trim().length > 0;
        }
        if (typeof account.refreshToken === 'string' && account.refreshToken.trim().length > 0) {
            return false;
        }
        if (typeof account.sessionToken === 'string' && account.sessionToken.trim().length > 0) {
            return false;
        }
        return typeof account.accessToken === 'string' && this.looksLikeApiKey(account.accessToken);
    }

    private isOAuthAccount(account: {
        accessToken?: string;
        refreshToken?: string;
        sessionToken?: string;
        metadata?: RuntimeValue;
    }): boolean {
        const metadata = (account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata))
            ? (account.metadata as Record<string, unknown>)
            : undefined;
        const authType = this.readMetadataString(metadata, 'auth_type', 'authType');
        const metadataType = this.readMetadataString(metadata, 'type');
        if (authType === 'api_key' || metadataType === 'api_key') {
            return false;
        }
        if (authType === 'oauth' || metadataType === 'oauth') {
            return true;
        }
        if (typeof account.refreshToken === 'string' && account.refreshToken.trim().length > 0) {
            return true;
        }
        if (typeof account.sessionToken === 'string' && account.sessionToken.trim().length > 0) {
            return true;
        }
        if (typeof account.accessToken !== 'string' || account.accessToken.trim().length === 0) {
            return false;
        }
        return !this.looksLikeApiKey(account.accessToken);
    }

    private readMetadataString(
        metadata: Record<string, unknown> | undefined,
        ...keys: string[]
    ): string | undefined {
        if (!metadata) {
            return undefined;
        }
        for (const key of keys) {
            const value = metadata[key];
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim().toLowerCase();
            }
        }
        return undefined;
    }
}

