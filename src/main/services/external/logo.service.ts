import { promises as fs } from 'fs';
import { join } from 'path';

import { appLogger } from '@main/logging/logger';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import { ModelProviderInfo, ModelRegistryService } from '@main/services/llm/model-registry.service';
import { ProjectService } from '@main/services/project/project.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { JsonObject } from '@shared/types/common';
import { ModelQuotaItem } from '@shared/types/quota';
import { safeJsonParse } from '@shared/utils/sanitize.util';

interface LogoAnalysisModelCandidate {
    provider?: string;
    model: string;
    accountId?: string;
    source: 'quota' | 'registry';
}

interface ResolvedGenerationModel {
    model: string;
    provider?: string;
}

interface LogoServiceDependencies {
    llmService: LLMService;
    projectService: ProjectService;
    localImageService: LocalImageService;
    imagePersistenceService: ImagePersistenceService;
    authService: AuthService;
    quotaService: QuotaService;
    modelRegistryService: ModelRegistryService;
}

export class LogoService {
    private readonly llmService: LLMService;
    private readonly projectService: ProjectService;
    private readonly localImageService: LocalImageService;
    private readonly imagePersistenceService: ImagePersistenceService;
    private readonly authService: AuthService;
    private readonly quotaService: QuotaService;
    private readonly modelRegistryService: ModelRegistryService;

    constructor(deps: LogoServiceDependencies) {
        this.llmService = deps.llmService;
        this.projectService = deps.projectService;
        this.localImageService = deps.localImageService;
        this.imagePersistenceService = deps.imagePersistenceService;
        this.authService = deps.authService;
        this.quotaService = deps.quotaService;
        this.modelRegistryService = deps.modelRegistryService;
    }

    private getStylePrompt(style: string): string {
        const styles: Record<string, string> = {
            Minimalist:
                'minimalist, vector art, flat design, simple shapes, monochrome or duotone, clean lines, professional app icon',
            Cyberpunk:
                'cyberpunk, neon lights, futuristic, high contrast, glowing effects, grid background, dark mode aesthetic',
            Abstract:
                'abstract geometry, mathematical shapes, fluid forms, creative composition, artistic, modern art',
            Retro: 'retro pixel art, 8-bit style, nostalgic, vibrant colors, blocky, arcade game aesthetic',
            'Modern gradient':
                'modern gradient, fluid colors, glassmorphism, 3d render, glossy finish, high end tech startup',
        };
        return styles[style] || style;
    }

    async analyzeProjectIdentity(
        projectPath: string
    ): Promise<{ suggestedPrompts: string[]; colors: string[] }> {
        let pkgData: JsonObject = {};
        try {
            const pkgPath = join(projectPath, 'package.json');
            const content = await fs.readFile(pkgPath, 'utf-8');
            pkgData = safeJsonParse<JsonObject>(content, {});
        } catch {
            appLogger.warn('logo.service', `[LogoService] No package.json found at ${projectPath}`);
        }

        // Deep Analysis
        const analysis = await this.projectService.analyzeProject(projectPath);

        const context = `
 Project Name: ${pkgData.name ?? projectPath.split(/[\\/]/).pop() ?? 'Untitled'}
 Description: ${pkgData.description ?? analysis.type + ' project'}
Type: ${analysis.type}
Frameworks: ${analysis.frameworks.join(', ')}
Main Languages: ${Object.keys(analysis.languages).join(', ')}
Stats: ${analysis.stats.fileCount} files, ~${analysis.stats.loc} lines of code
Dependencies: ${Object.keys(analysis.dependencies).slice(0, 8).join(', ')}
`;

        const analysisPrompt = `Analyze this project metadata and suggest 3 creative, short concepts for an app icon/logo mascot. 
The concepts should be optimized for an AI image generator like DALL-E or Flux.
Each concept should be a single sentence description.
Also suggest an optional professional color palette (3-5 hex colors) that fits the project vibe.
If color preference is uncertain, return an empty colors array instead of forcing colors.
Consider standard tech branding (e.g., Python: Blue/Yellow, Node: Green/Lime, React: Cyan, Typescript: Blue).

Return JSON only: { "concepts": ["concept 1", "concept 2", "concept 3"], "colors": ["#hex1", "#hex2", "#hex3"] }

Project Info:
${context}`;

        try {
            const candidates = await this.getAnalysisModelCandidates();
            for (const candidate of candidates) {
                try {
                    await this.activateCandidateAccount(candidate);
                    appLogger.info(
                        'logo.service',
                        `[LogoService] Trying analysis model ${candidate.provider ?? 'auto'}/${candidate.model} (${candidate.source}${candidate.accountId ? `, account=${candidate.accountId}` : ''})`
                    );
                    const response = await this.llmService.chat(
                        [{ role: 'user', content: analysisPrompt }],
                        candidate.model,
                        [],
                        candidate.provider
                    );

                    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        continue;
                    }

                    const data = safeJsonParse<JsonObject>(jsonMatch[0], {});
                    const suggestedPrompts = (data.concepts as string[] | undefined) ?? [];
                    const colors = this.sanitizeHexColors(data.colors);

                    if (suggestedPrompts.length > 0 || colors.length > 0) {
                        return { suggestedPrompts, colors };
                    }
                } catch (candidateError) {
                    appLogger.warn(
                        'logo.service',
                        `[LogoService] Analysis candidate failed (${candidate.provider ?? 'auto'}/${candidate.model}): ${candidateError instanceof Error ? candidateError.message : String(candidateError)}`
                    );
                }
            }
        } catch (error) {
            appLogger.error(
                'logo.service',
                '[LogoService] Identity analysis failed',
                error as Error
            );
        }

        return {
            suggestedPrompts: [`Professional modern logo for a ${analysis.type} project`],
            colors: [],
        };
    }

    private sanitizeHexColors(input: unknown): string[] {
        if (!Array.isArray(input)) {
            return [];
        }
        const valid = input
            .filter((value): value is string => typeof value === 'string')
            .map(value => value.trim())
            .filter(value => /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value));
        return Array.from(new Set(valid)).slice(0, 5);
    }

    private async getAnalysisModelCandidates(): Promise<LogoAnalysisModelCandidate[]> {
        const ranked: LogoAnalysisModelCandidate[] = [];
        const seen = new Set<string>();

        const pushCandidate = (candidate: LogoAnalysisModelCandidate) => {
            const key = `${candidate.provider ?? 'auto'}:${candidate.model}:${candidate.accountId ?? 'default'}`;
            if (seen.has(key)) {
                return;
            }
            seen.add(key);
            ranked.push(candidate);
        };

        let registryModels: ModelProviderInfo[] = [];
        try {
            registryModels = await this.modelRegistryService.getAllModels();
        } catch (error) {
            appLogger.warn(
                'logo.service',
                `[LogoService] Failed to load model registry for ranking: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        const textModels = registryModels
            .filter(model => model.capabilities?.text_generation !== false)
            .filter(model => this.isAllowedAnalysisProvider((model.provider ?? '').toLowerCase()));

        // Priority chain:
        // antigravity (quota-aware) -> claude (fixed small set) -> copilot (allowed set, random)
        // -> nvidia -> opencode -> ollama.
        const antigravityCandidates = await this.getAntigravityCandidates(textModels);
        for (const candidate of antigravityCandidates) {
            pushCandidate(candidate);
        }

        const claudeWhitelist = new Set([
            'claude-3-7-sonnet-20250219',
            'claude-3-haiku-20240307',
            'claude-3-5-haiku-20241022',
        ]);
        const claudeModels = textModels
            .filter(model => {
                const provider = (model.provider ?? '').toLowerCase();
                return provider === 'claude' || provider === 'anthropic';
            })
            .filter(model => claudeWhitelist.has(this.normalizeModelKey(model.id)))
            .sort(
                (left, right) =>
                    this.getModelCostScore((left.provider ?? '').toLowerCase(), left) -
                    this.getModelCostScore((right.provider ?? '').toLowerCase(), right)
            );
        for (const modelInfo of claudeModels) {
            const provider = (modelInfo.provider ?? '').toLowerCase();
            const resolved = this.resolveProviderAndModel(modelInfo, provider);
            pushCandidate({ provider: resolved.provider, model: resolved.model, source: 'registry' });
        }

        const copilotModels = textModels
            .filter(model => {
                const provider = (model.provider ?? '').toLowerCase();
                return provider === 'copilot' || provider === 'github';
            })
            .filter(model => this.isAllowedCopilotModelByName(`${model.id} ${model.name ?? ''}`))
            .sort(
                (left, right) =>
                    this.getModelCostScore((left.provider ?? '').toLowerCase(), left) -
                    this.getModelCostScore((right.provider ?? '').toLowerCase(), right)
            );
        if (copilotModels.length > 0) {
            const randomIndex = Math.floor(Math.random() * copilotModels.length);
            const chosenCopilot = copilotModels[randomIndex];
            const provider = (chosenCopilot.provider ?? '').toLowerCase();
            const resolved = this.resolveProviderAndModel(chosenCopilot, provider);
            pushCandidate({ provider: resolved.provider, model: resolved.model, source: 'registry' });
        }

        const nvidiaModels = textModels
            .filter(model => (model.provider ?? '').toLowerCase() === 'nvidia')
            .filter(model => this.isEconomicalUsefulModel('nvidia', model))
            .sort((left, right) => this.getModelCostScore('nvidia', left) - this.getModelCostScore('nvidia', right));
        for (const modelInfo of nvidiaModels) {
            const resolved = this.resolveProviderAndModel(modelInfo, 'nvidia');
            pushCandidate({ provider: resolved.provider, model: resolved.model, source: 'registry' });
        }

        const opencodeModels = textModels
            .filter(model => (model.provider ?? '').toLowerCase() === 'opencode')
            .sort((left, right) => this.getModelCostScore('opencode', left) - this.getModelCostScore('opencode', right));
        for (const modelInfo of opencodeModels) {
            const resolved = this.resolveProviderAndModel(modelInfo, 'opencode');
            pushCandidate({ provider: resolved.provider, model: resolved.model, source: 'registry' });
        }

        const ollamaModels = textModels
            .filter(model => (model.provider ?? '').toLowerCase() === 'ollama')
            .sort((left, right) => this.getModelCostScore('ollama', left) - this.getModelCostScore('ollama', right));
        for (const modelInfo of ollamaModels) {
            const resolved = this.resolveProviderAndModel(modelInfo, 'ollama');
            pushCandidate({ provider: resolved.provider, model: resolved.model, source: 'registry' });
        }

        appLogger.info(
            'logo.service',
            `[LogoService] Analysis candidates ordered: ${ranked.map(c => `${c.provider}/${c.model}[${c.source}]`).join(', ')}`
        );

        return await this.expandCandidatesForMultipleAccounts(ranked);
    }

    private isAllowedAnalysisProvider(provider: string): boolean {
        return (
            provider === 'antigravity' ||
            provider === 'google' ||
            provider === 'claude' ||
            provider === 'anthropic' ||
            provider === 'copilot' ||
            provider === 'github' ||
            provider === 'nvidia' ||
            provider === 'opencode' ||
            provider === 'ollama'
        );
    }

    private normalizeModelKey(modelId: string): string {
        const idx = modelId.indexOf('/');
        if (idx <= 0) {
            return modelId.toLowerCase();
        }
        return modelId.slice(idx + 1).toLowerCase();
    }

    private isAntigravityAllowedModelByName(value: string): boolean {
        const normalized = value.toLowerCase();
        return (
            /gemini[\s-]*2\.5[\s-]*flash[\s-]*lite/.test(normalized) ||
            /gemini[\s-]*2\.5[\s-]*flash(?![\s-]*lite)/.test(normalized) ||
            /gemini[\s-]*2\.5.*(pro.*ui.*checkpoint|computer.*use|uic3)/.test(normalized)
        );
    }

    private isAllowedAntigravityAnalysisModel(modelInfo: ModelProviderInfo): boolean {
        const searchable = `${modelInfo.id} ${modelInfo.name ?? ''}`;
        return this.isAntigravityAllowedModelByName(searchable);
    }

    private isAllowedCopilotModelByName(value: string): boolean {
        const normalized = value.toLowerCase();
        return (
            /gemini[\s-]*2\.0[\s-]*flash/.test(normalized) ||
            /gemini[\s-]*2\.5[\s-]*pro/.test(normalized) ||
            /gpt[\s-]*4\.1/.test(normalized)
        );
    }

    private getQuotaPercentage(model: ModelQuotaItem): number | null {
        if (model.quotaInfo?.remainingFraction !== undefined) {
            return Math.round(model.quotaInfo.remainingFraction * 100);
        }
        if (typeof model.percentage === 'number') {
            return model.percentage;
        }
        if (
            model.quotaInfo?.remainingQuota !== undefined &&
            model.quotaInfo?.totalQuota !== undefined &&
            model.quotaInfo.totalQuota > 0
        ) {
            return Math.round((model.quotaInfo.remainingQuota / model.quotaInfo.totalQuota) * 100);
        }
        return null;
    }

    private async getAntigravityCandidates(
        textModels: ModelProviderInfo[]
    ): Promise<LogoAnalysisModelCandidate[]> {
        const antigravityModels = textModels
            .filter(model => {
                const provider = (model.provider ?? '').toLowerCase();
                return provider === 'antigravity' || provider === 'google';
            })
            .filter(model => this.isAllowedAntigravityAnalysisModel(model))
            .sort((left, right) => this.getModelCostScore('antigravity', left) - this.getModelCostScore('antigravity', right));

        if (!antigravityModels.length) {
            return [];
        }

        const quotaResponse = await this.quotaService.getQuota(0, '');
        if (!quotaResponse?.accounts?.length) {
            return [];
        }

        const rankedAccounts = quotaResponse.accounts
            .map(account => {
                const usablePercents = account.models
                    .filter(model => this.isAntigravityAllowedModelByName(`${model.id} ${model.name}`))
                    .map(model => this.getQuotaPercentage(model))
                    .filter((value): value is number => value !== null);

                const bestPercent =
                    usablePercents.length > 0 ? Math.max(...usablePercents) : -1;
                return {
                    accountId: account.accountId ?? '',
                    bestPercent,
                };
            })
            .filter(account => account.bestPercent > 0 && account.accountId.length > 0)
            .sort((a, b) => b.bestPercent - a.bestPercent);

        if (!rankedAccounts.length) {
            return [];
        }

        appLogger.info(
            'logo.service',
            `[LogoService] Antigravity account quota ranking: ${rankedAccounts
                .map(account => `${account.accountId}=${account.bestPercent}%`)
                .join(', ')}`
        );

        const candidates: LogoAnalysisModelCandidate[] = [];
        for (const account of rankedAccounts) {
            for (const modelInfo of antigravityModels) {
                const resolved = this.resolveProviderAndModel(modelInfo, 'antigravity');
                candidates.push({
                    provider: resolved.provider,
                    model: resolved.model,
                    accountId: account.accountId,
                    source: 'quota',
                });
            }
        }
        return candidates;
    }

    private async expandCandidatesForMultipleAccounts(
        baseCandidates: LogoAnalysisModelCandidate[]
    ): Promise<LogoAnalysisModelCandidate[]> {
        const result: LogoAnalysisModelCandidate[] = [];

        const claudeAccounts = await this.getRankedClaudeAccounts();
        const copilotAccounts = await this.getRankedCopilotAccounts();
        const nvidiaAccounts = await this.authService.getAccountsByProvider('nvidia');

        for (const candidate of baseCandidates) {
            const provider = (candidate.provider ?? '').toLowerCase();
            if (provider === 'opencode' || provider === 'ollama') {
                result.push(candidate);
                continue;
            }

            if (provider === 'antigravity' || provider === 'google') {
                // Antigravity candidates are already expanded by account ranking.
                result.push(candidate);
                continue;
            }

            if (provider === 'claude' || provider === 'anthropic') {
                if (claudeAccounts.length === 0) {
                    appLogger.info(
                        'logo.service',
                        '[LogoService] Skipping claude/anthropic candidate because no quota-positive account is available'
                    );
                    continue;
                }
                for (const account of claudeAccounts) {
                    result.push({ ...candidate, accountId: account.accountId });
                }
                continue;
            }

            if (provider === 'copilot' || provider === 'github') {
                if (copilotAccounts.length === 0) {
                    appLogger.info(
                        'logo.service',
                        '[LogoService] Skipping copilot/github candidate because no quota-positive account is available'
                    );
                    continue;
                }
                for (const account of copilotAccounts) {
                    result.push({ ...candidate, accountId: account.accountId });
                }
                continue;
            }

            if (provider === 'nvidia') {
                if (nvidiaAccounts.length === 0) {
                    result.push(candidate);
                    continue;
                }
                for (const account of nvidiaAccounts) {
                    result.push({ ...candidate, accountId: account.id });
                }
                continue;
            }

            result.push(candidate);
        }

        return result;
    }

    private async getRankedCopilotAccounts(): Promise<Array<{ accountId: string; remaining: number }>> {
        const quota = await this.quotaService.getCopilotQuota();
        if (!quota.accounts.length) {
            return [];
        }

        const ranked = quota.accounts
            .map(account => ({
                accountId: account.accountId ?? '',
                remaining: account.remaining,
            }))
            .filter(account => account.accountId.length > 0 && account.remaining > 0)
            .sort((a, b) => b.remaining - a.remaining);

        if (ranked.length > 0) {
            appLogger.info(
                'logo.service',
                `[LogoService] Copilot account quota ranking: ${ranked.map(account => `${account.accountId}=${account.remaining}`).join(', ')}`
            );
        }

        return ranked;
    }

    private async getRankedClaudeAccounts(): Promise<Array<{ accountId: string; remaining: number }>> {
        const quota = await this.quotaService.getClaudeQuota();
        if (!quota.accounts.length) {
            return [];
        }

        const ranked = quota.accounts
            .map(account => {
                const remaining = Math.min(
                    100 - (account.fiveHour?.utilization ?? 100),
                    100 - (account.sevenDay?.utilization ?? 100)
                );
                return {
                    accountId: account.accountId ?? '',
                    remaining,
                };
            })
            .filter(account => account.accountId.length > 0 && account.remaining > 0)
            .sort((a, b) => b.remaining - a.remaining);

        if (ranked.length > 0) {
            appLogger.info(
                'logo.service',
                `[LogoService] Claude account quota ranking: ${ranked.map(account => `${account.accountId}=${account.remaining}%`).join(', ')}`
            );
        }

        return ranked;
    }

    private async activateCandidateAccount(candidate: LogoAnalysisModelCandidate): Promise<void> {
        if (!candidate.accountId) {
            return;
        }

        try {
            const accounts = await this.authService.getAllAccounts();
            const account = accounts.find(item => item.id === candidate.accountId);
            if (!account) {
                return;
            }
            await this.authService.setActiveAccount(account.provider, account.id);
        } catch (error) {
            appLogger.warn(
                'logo.service',
                `[LogoService] Failed to activate account ${candidate.accountId}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private resolveProviderAndModel(
        modelInfo: ModelProviderInfo,
        fallbackProvider: string
    ): { provider: string; model: string } {
        const declaredProvider = fallbackProvider.toLowerCase();
        const modelId = modelInfo.id;
        const slashIndex = modelId.indexOf('/');
        const prefix = slashIndex > 0 ? modelId.slice(0, slashIndex).toLowerCase() : '';

        if (prefix === 'codex') {
            return {
                provider: 'codex',
                model: modelId.slice(slashIndex + 1),
            };
        }

        if (prefix === 'openai') {
            return {
                provider: declaredProvider === 'codex' ? 'codex' : 'openai',
                model: modelId.slice(slashIndex + 1),
            };
        }

        if (prefix === 'anthropic' || prefix === 'claude') {
            return {
                provider: declaredProvider === 'claude' ? 'claude' : 'anthropic',
                model: modelId.slice(slashIndex + 1),
            };
        }

        if (prefix === 'google' || prefix === 'gemini') {
            return {
                provider: declaredProvider === 'antigravity' ? 'antigravity' : 'google',
                model: modelId.slice(slashIndex + 1),
            };
        }

        if (prefix && prefix === declaredProvider) {
            return {
                provider: declaredProvider,
                model: modelId.slice(slashIndex + 1),
            };
        }

        return {
            provider: declaredProvider,
            model: this.normalizeModelForProvider(modelId, declaredProvider),
        };
    }

    private normalizeModelForProvider(modelId: string, provider: string): string {
        const normalizedProvider = provider.toLowerCase();
        const providerPrefix = `${normalizedProvider}/`;
        if (modelId.startsWith(providerPrefix)) {
            return modelId.slice(providerPrefix.length);
        }
        if (normalizedProvider === 'claude' && modelId.startsWith('anthropic/')) {
            return modelId.slice('anthropic/'.length);
        }
        if (normalizedProvider === 'anthropic' && modelId.startsWith('claude/')) {
            return modelId.slice('claude/'.length);
        }
        if (normalizedProvider === 'openai' && modelId.startsWith('codex/')) {
            return modelId.slice('codex/'.length);
        }
        return modelId;
    }

    private isEconomicalUsefulModel(provider: string, modelInfo: ModelProviderInfo): boolean {
        const searchable = `${modelInfo.id} ${modelInfo.name ?? ''}`.toLowerCase();

        const expensiveOrIrrelevant = [
            /image|nano\s*banana|browser\s*subagent/i,
            /thinking/i,
            /\bopus\b/i,
            /\bhigh\b/i,
            /\bo1\b|\bo3\b|\bgpt-5\b/i,
        ];
        if (expensiveOrIrrelevant.some(regex => regex.test(searchable))) {
            return false;
        }

        const lowCostByProvider: Record<string, RegExp[]> = {
            antigravity: [
                /gemini\s*2\.5\s*flash\s*lite/i,
                /gemini\s*2\.5\s*flash/i,
                /gemini\s*3\s*flash/i,
                /gemini\s*3\s*pro\s*\(low\)/i,
                /gpt-oss/i,
                /sonnet\s*4\.5/i,
            ],
            claude: [/haiku/i, /sonnet/i],
            anthropic: [/haiku/i, /sonnet/i],
            openai: [/mini/i, /gpt-4o/i, /gpt-4\.1/i],
            codex: [/mini/i, /gpt-4o/i, /gpt-4\.1/i, /gpt-oss/i],
            ollama: [/llama3|mistral|qwen|phi|deepseek/i],
            copilot: [/mini|flash|sonnet|gpt-4o/i],
            github: [/mini|flash|sonnet|gpt-4o/i],
            nvidia: [/mini|flash|lite|haiku|sonnet|llama-3\.2|phi|gemma|qwen|mistral/i],
            google: [/flash|lite|pro\s*\(low\)|gemini/i],
            opencode: [/free|nano|pickle|minimax|glm|kimi/i],
        };

        const matchers = lowCostByProvider[provider.toLowerCase()];
        if (!matchers) {
            return /mini|flash|lite|haiku|sonnet|gpt-oss/i.test(searchable);
        }
        return matchers.some(regex => regex.test(searchable));
    }

    private getModelCostScore(provider: string, modelInfo: ModelProviderInfo): number {
        const searchable = `${modelInfo.id} ${modelInfo.name ?? ''}`.toLowerCase();
        let score = 100;

        if (/lite/.test(searchable)) {
            score -= 55;
        }
        if (/flash/.test(searchable)) {
            score -= 45;
        }
        if (/mini|haiku|gpt-oss/.test(searchable)) {
            score -= 35;
        }
        if (/low/.test(searchable)) {
            score -= 30;
        }
        if (/sonnet/.test(searchable)) {
            score -= 10;
        }
        if (/thinking|opus|high|\bo1\b|\bo3\b|gpt-5/.test(searchable)) {
            score += 60;
        }
        if (/image|nano\s*banana|ui\s*checkpoint|browser\s*subagent/.test(searchable)) {
            score += 80;
        }

        if (provider === 'ollama') {
            score -= 5;
        }

        return score;
    }

    async improveLogoPrompt(prompt: string): Promise<string> {
        const improvementPrompt = `You are a creative brand designer. Expand and improve the following logo description into a detailed, high-quality prompt for an AI image generator (like Flux or DALL-E). 
        Focus on artistic style, lighting, composition, and professional aesthetics. Keep it to 2-3 sentences.
        Original Idea: ${prompt}
        Improved Prompt:`;

        try {
            const candidates = await this.getAnalysisModelCandidates();
            for (const candidate of candidates) {
                try {
                    await this.activateCandidateAccount(candidate);
                    const response = await this.llmService.chat(
                        [{ role: 'user', content: improvementPrompt }],
                        candidate.model,
                        [],
                        candidate.provider
                    );
                    const improved = response.content.trim();
                    if (improved.length > 0) {
                        return improved;
                    }
                } catch (candidateError) {
                    appLogger.warn(
                        'logo.service',
                        `[LogoService] Prompt improvement candidate failed (${candidate.provider ?? 'auto'}/${candidate.model}): ${candidateError instanceof Error ? candidateError.message : String(candidateError)}`
                    );
                }
            }
            return prompt;
        } catch (error) {
            appLogger.warn(
                'logo.service',
                `[LogoService] Prompt improvement failed: ${error instanceof Error ? error.message : String(error)}`
            );
            return prompt; // Fallback to original
        }
    }

    async generateLogo(
        projectPath: string,
        prompt: string,
        style: string,
        model: string,
        count: number = 1
    ): Promise<string[]> {
        appLogger.info(
            'logo.service',
            `[LogoService] Generating ${count} logos for ${projectPath} with prompt: "${prompt}", style: "${style}", model: "${model}"`
        );

        const styleKeywords = this.getStylePrompt(style);
        const enhancedPrompt = `Design a professional app icon for a project. 
        Core Concept: ${prompt}
        Visual Style: ${styleKeywords}
        Constraints: Square aspect ratio, centered composition, high quality vector style, solid background, avoid text, avoid complex details, minimalist aesthetic, sharp edges.`;

        const results: string[] = [];
        const errors: Error[] = [];

        for (let i = 0; i < count; i++) {
            try {
                const savedPath = await this.generateSingleLogo(projectPath, enhancedPrompt, model);
                results.push(savedPath);
            } catch (error) {
                appLogger.error(
                    'LogoService',
                    `Generation failed for attempt ${i + 1}:`,
                    error as Error
                );
                errors.push(error as Error);
            }
        }

        if (results.length === 0 && errors.length > 0) {
            throw errors[0];
        }

        return results;
    }

    private async generateSingleLogo(
        projectPath: string,
        enhancedPrompt: string,
        model: string
    ): Promise<string> {
        const resolved = await this.resolveGenerationModel(model);
        const isSdCpp = resolved.provider === 'sd-cpp';
        const isLocal = isSdCpp || model.toLowerCase().includes('local') || model === '';

        if (isLocal) {
            // Force provider if it's sd-cpp to ensure the settings are loaded correctly
            const options = {
                prompt: enhancedPrompt,
                width: 1024,
                height: 1024,
            };

            const tempPath = await this.localImageService.generateImage(options);

            if (tempPath) {
                return await this.saveGeneratedImage(
                    projectPath,
                    tempPath,
                    enhancedPrompt,
                    isSdCpp ? 'sd-cpp/stable-diffusion' : 'local-stable-diffusion'
                );
            }
            throw new Error('Local generation failed to produce an image.');
        }

        // Remote API
        const response = await this.llmService.chat(
            [{ role: 'user', content: enhancedPrompt }],
            resolved.model,
            [],
            resolved.provider
        );

        if (response.images && response.images.length > 0) {
            return await this.saveGeneratedImage(
                projectPath,
                response.images[0],
                enhancedPrompt,
                `${resolved.provider}/${resolved.model}`
            );
        }

        throw new Error('Remote generation returned no images.');
    }

    private async resolveGenerationModel(model: string): Promise<ResolvedGenerationModel> {
        const trimmed = model.trim();
        if (trimmed.length === 0) {
            return { model: trimmed };
        }

        const slashIndex = trimmed.indexOf('/');
        if (slashIndex > 0) {
            const prefix = trimmed.slice(0, slashIndex).toLowerCase();
            const bareModel = trimmed.slice(slashIndex + 1);
            if (this.isKnownProvider(prefix)) {
                return { model: bareModel, provider: prefix };
            }
        }

        // Fallback to registry lookup for models without explicit provider prefix.
        try {
            const allModels = await this.modelRegistryService.getAllModels();
            const exact = allModels.find(m => m.id === trimmed);
            if (exact?.provider) {
                const provider = exact.provider.toLowerCase();
                return {
                    model: this.normalizeModelForProvider(exact.id, provider),
                    provider,
                };
            }

            const suffixMatch = allModels.find(m => this.normalizeModelKey(m.id) === trimmed.toLowerCase());
            if (suffixMatch?.provider) {
                const provider = suffixMatch.provider.toLowerCase();
                return {
                    model: this.normalizeModelForProvider(suffixMatch.id, provider),
                    provider,
                };
            }
        } catch (error) {
            appLogger.warn(
                'logo.service',
                `[LogoService] Failed to resolve generation model provider for "${trimmed}": ${error instanceof Error ? error.message : String(error)}`
            );
        }

        return { model: trimmed };
    }

    private isKnownProvider(provider: string): boolean {
        return (
            provider === 'antigravity' ||
            provider === 'google' ||
            provider === 'claude' ||
            provider === 'anthropic' ||
            provider === 'copilot' ||
            provider === 'github' ||
            provider === 'nvidia' ||
            provider === 'opencode' ||
            provider === 'ollama' ||
            provider === 'openai' ||
            provider === 'codex' ||
            provider === 'sd-cpp'
        );
    }

    private async saveGeneratedImage(
        projectPath: string,
        sourcePathOrUrl: string,
        prompt: string,
        model: string
    ): Promise<string> {
        const targetDir = join(projectPath, '.tandem', 'temp');
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000);
        const targetPath = join(targetDir, `logo-${timestamp}-${randomSuffix}.png`);

        await fs.mkdir(targetDir, { recursive: true });

        // If source is a URL (remote), fetch it. If it's a path (local), copy it.
        // ImagePersistenceService.saveImage handles data URIs and URLs.
        // But here we want to save to the PROJECT temp folder first for the UI to display?
        // Or does the UI use the gallery path?
        // The original code copied to project/.tandem/temp AND saved to gallery.
        // Let's keep that behavior.

        const resolvedLocalSource = this.resolveLocalImagePath(sourcePathOrUrl);

        if (sourcePathOrUrl.startsWith('http')) {
            // download
            const response = await fetch(sourcePathOrUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await fs.writeFile(targetPath, buffer);
        } else if (sourcePathOrUrl.startsWith('data:')) {
            const match = sourcePathOrUrl.match(/^data:[^;]+;base64,(.+)$/);
            if (!match?.[1]) {
                throw new Error('Invalid data URI image payload');
            }
            const buffer = Buffer.from(match[1], 'base64');
            await fs.writeFile(targetPath, buffer);
        } else {
            // copy local file
            await fs.copyFile(resolvedLocalSource, targetPath);
        }

        // Save to gallery with metadata
        await this.imagePersistenceService.saveImage(sourcePathOrUrl, {
            prompt: prompt,
            model: model,
            width: 1024,
            height: 1024,
        });

        return targetPath;
    }

    private resolveLocalImagePath(pathOrUri: string): string {
        const normalized = pathOrUri.trim();
        if (normalized.startsWith('safe-file://') || normalized.startsWith('file://')) {
            let localPath = normalized
                .replace(/^safe-file:\/+/i, '')
                .replace(/^file:\/+/i, '');
            localPath = decodeURIComponent(localPath);
            if (/^\/[A-Za-z]:\//.test(localPath)) {
                localPath = localPath.slice(1);
            }
            return process.platform === 'win32' ? localPath.replace(/\//g, '\\') : `/${localPath}`;
        }
        return normalized;
    }

    async applyLogo(projectPath: string, tempLogoPath: string): Promise<string> {
        try {
            const tandemDir = join(projectPath, '.tandem');
            await fs.mkdir(tandemDir, { recursive: true });

            const targetPath = join(tandemDir, 'logo.png');
            const sourcePath = this.resolveLocalImagePath(tempLogoPath);
            if (sourcePath !== targetPath) {
                await fs.copyFile(sourcePath, targetPath);
            }

            // Also try to save as icon.png in public if it exists (common for web apps)
            const publicDir = join(projectPath, 'public');
            try {
                const publicStats = await fs.stat(publicDir);
                if (publicStats.isDirectory()) {
                    await fs.copyFile(targetPath, join(publicDir, 'icon.png'));
                    await fs.copyFile(targetPath, join(publicDir, 'favicon.png'));
                }
            } catch {
                // Ignore if public dir doesn't exist
            }

            return targetPath;
        } catch (error) {
            appLogger.error('logo.service', '[LogoService] Apply logo failed', error as Error);
            throw error;
        }
    }

    async getCompletion(text: string) {
        const prompt = `You are an expert programmer. Complete the following code snippet. 
Provide ONLY the completion text, no explanation, no markdown blocks.
Context:
${text}`;

        const response = await this.llmService.chat(
            [{ role: 'user', content: prompt }],
            'antigravity-flux-schnell',
            [],
            'antigravity'
        );
        return response.content;
    }
}
