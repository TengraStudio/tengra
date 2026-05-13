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
const LOCAL_PROVIDER_ORDER = ['ollama', 'llama', 'huggingface'] as const;

/**
 * Centralized model selection strategy used by background services.
 */
export class ModelSelectionService {
    static readonly serviceName = 'modelSelectionService';
    static readonly dependencies = ['deps'] as const;
    constructor(private readonly deps: ModelSelectionDeps) { }

    async recommendModel(category: 'chat' | 'inline' | 'embeddings' | 'images' = 'chat'): Promise<ModelSelectionResult | null> {
        const models = await this.safeGetModels();
        const candidates: Array<{
            provider: string;
            source: ModelSelectionResult['source'];
            model?: string;
            accountCount: number;
            score: number;
        }> = [];

        // 1. Process OAuth Candidates
        for (const provider of OAUTH_PROVIDER_ORDER) {
            const accountCount = await this.countOAuthAccounts(provider);
            if (accountCount <= 0) {
                continue;
            }
            const candidateModel = this.pickBestModelForProvider(models, provider, category);
            const modelId = candidateModel ? this.requestModelId(candidateModel) : undefined;
            if (!modelId) {continue;}

            candidates.push({
                provider,
                source: 'oauth',
                model: modelId,
                accountCount,
                score: 400 + (accountCount * 20) + (candidateModel ? (1000 - Math.min(this.modelScore(candidateModel, provider, category), 1000)) : 0),
            });
        }

        // 2. Process Local Candidates
        for (const provider of LOCAL_PROVIDER_ORDER) {
            const categoryModels = this.filterModelsByCategory(models, category)
                .filter(model => this.providerCategory(model) === provider)
                .sort((a, b) => this.modelScore(a, provider, category) - this.modelScore(b, provider, category));
            
            const best = categoryModels[0];
            if (!best) {continue;}

            candidates.push({
                provider,
                source: 'local',
                model: this.requestModelId(best),
                accountCount: categoryModels.length,
                score: 300 + Math.min(80, categoryModels.length * 5),
            });
        }

        // 3. Process API Key Candidates
        const apiKeyFallbacks: Record<string, string> = {
            openai: category === 'embeddings' ? 'text-embedding-3-small' : (category === 'inline' ? 'gpt-4o-mini' : 'gpt-4o'),
            anthropic: category === 'inline' ? 'claude-haiku-4.5' : 'claude-sonnet-4.6',
            gemini: 'gemini-2.5-flash-lite',
            nvidia: 'z-ai/glm-5.1',
        };

        for (const [provider, fallbackModel] of Object.entries(apiKeyFallbacks)) {
            const accountCount = await this.countApiKeyAccounts(provider);
            if (accountCount <= 0) {continue;}

            const best = this.pickBestModelForProvider(models, provider, category);
            candidates.push({
                provider,
                source: 'api-key',
                model: best ? this.requestModelId(best) : fallbackModel,
                accountCount,
                score: 200 + (accountCount * 10) + (best ? (500 - Math.min(this.modelScore(best, provider, category), 500)) : 0),
            });
        }

        const ranked = candidates
            .filter(c => typeof c.model === 'string' && c.model.length > 0)
            .sort((l, r) => r.score - l.score);

        const chosen = ranked[0];
        return chosen ? {
            provider: chosen.provider,
            model: chosen.model as string,
            source: chosen.source,
        } : null;
    }

    async selectChatModel(): Promise<ModelSelectionResult | null> {
        return this.recommendModel('chat');
    }

    async selectInlineModel(): Promise<ModelSelectionResult | null> {
        return this.recommendModel('inline');
    }

    async selectEmbeddingModel(): Promise<ModelSelectionResult | null> {
        return this.recommendModel('embeddings');
    }

    async selectImageModel(): Promise<ModelSelectionResult | null> {
        return this.recommendModel('images');
    }

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
        // ... (keep similar to original but use recommendModel internally if possible, or just keep as is for background tasks)
        const selection = await this.recommendModel('chat');
        return {
            selection,
            reason: selection ? `Selected ${selection.provider}/${selection.model} via ${selection.source}` : 'No models found',
            candidates: [], // Simplified for now
        };
    }

    async selectBackgroundModel(): Promise<ModelSelectionResult | null> {
        return this.recommendModel('chat');
    }

    private async safeGetModels(): Promise<ModelProviderInfo[]> {
        try {
            return await this.deps.getModels();
        } catch {
            return [];
        }
    }

    private pickBestModelForProvider(models: ModelProviderInfo[], provider: string, category: string): ModelProviderInfo | undefined {
        return this.filterModelsByCategory(models, category)
            .filter(model => this.providerMatches(model, provider))
            .sort((a, b) => this.modelScore(a, provider, category) - this.modelScore(b, provider, category))[0];
    }

    private filterModelsByCategory(models: ModelProviderInfo[], category: string): ModelProviderInfo[] {
        return models.filter(model => {
            const capabilities = model.capabilities ?? {};
            if (category === 'embeddings') {return capabilities.embedding === true;}
            if (category === 'images') {return capabilities.image_generation === true;}
            
            // Default to text generation
            if (capabilities.text_generation === false) {return false;}
            if (capabilities.embedding === true || capabilities.image_generation === true) {return false;}

            const searchable = `${model.id} ${model.name ?? ''} ${model.description ?? ''}`.toLowerCase();
            return !/(embed|embedding|image|vision|audio|speech|transcribe|tts|realtime|moderation|sora|dall[-\s]?e)/i.test(searchable);
        });
    }

    private modelScore(model: ModelProviderInfo, provider: string, category: string): number {
        if (provider === 'ollama' || provider === 'llama' || provider === 'huggingface') {
            return this.localModelScore(model);
        }
        return this.remoteModelScore(model, provider, category);
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
        if (provider === 'llama' && model.id.startsWith('llama/')) {
            return model.id.slice('llama/'.length);
        }
        return model.id;
    }

    private localModelScore(model: ModelProviderInfo): number {
        if ((model as ModelProviderInfo & { loaded?: boolean }).loaded === true) {
            return 0;
        }
        const parameterScore = this.parseParameterSize(model.parameters)
            ?? this.parseParameterSize(model.name)
            ?? this.parseParameterSize(model.id);
        if (parameterScore !== undefined) {
            return parameterScore;
        }
        const rawSize = model.size;
        return typeof rawSize === 'number' && Number.isFinite(rawSize) ? rawSize / 1_000_000_000 : Number.MAX_SAFE_INTEGER;
    }

    private remoteModelScore(model: ModelProviderInfo, provider: string, category: string): number {
        const pricing = model.pricing;
        if (pricing && typeof pricing === 'object' && !Array.isArray(pricing)) {
            const input = typeof pricing.input === 'number' ? pricing.input : undefined;
            const output = typeof pricing.output === 'number' ? pricing.output : undefined;
            if (input !== undefined && output !== undefined) {
                let score = input + output;
                if (category === 'inline') {
                    // Heavily penalize large/expensive models for inline suggestions
                    if (score > 10) {score += 5000;}
                }
                return score;
            }
        }

        const searchable = `${model.id} ${model.name ?? ''}`.toLowerCase();
        const providerBias = provider === 'copilot' ? 0 : 100;
        
        // inline preferences
        if (category === 'inline') {
            if (searchable.includes('mini') || searchable.includes('flash') || searchable.includes('haiku') || searchable.includes('lite')) {
                return providerBias + 0;
            }
        }

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

