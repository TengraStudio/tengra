/**
 * Agent Provider Rotation Service
 *
 * Manages provider/model rotation and fallback chain
 * Integrates with AuthService to check user's configured providers
 */

import { BaseService } from '@main/services/base.service';
import { AuthService } from '@main/services/security/auth.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { SettingsService } from '@main/services/system/settings.service';
import { ModelOption, ProviderConfig } from '@shared/types/agent-state';
import { ModelGovernanceConfig } from '@shared/types/project-agent';
import { AppSettings } from '@shared/types/settings';

/**
 * Provider fallback chain configuration
 */
interface FallbackChain {
    cloud: string[];  // e.g., ['openai', 'anthropic', 'google']
    local: string[];  // e.g., ['ollama', 'llamacpp']
}

type RotationStrategy = 'provider_priority' | 'balanced' | 'local_first';

interface RotationPreference {
    chain: FallbackChain;
    strategy: RotationStrategy;
    updatedAt: number;
}

interface ProviderHealthEntry {
    successCount: number;
    errorCount: number;
    lastError?: string;
    lastUsedAt?: Date;
}

interface ProviderStats {
    requestCount: number;
    errorCount: number;
    lastError?: string;
    lastUsedAt?: Date;
    successRate: number;
}

const DEFAULT_PROJECT_ID = '__default__';
const DEFAULT_ROTATION_STRATEGY: RotationStrategy = 'provider_priority';

/** Quota provider callback type for cross-domain quota access. */
export type QuotaProvider = (provider: string) => Promise<number | undefined>;

/**
 * Provider rotation service
 * Handles automatic provider switching on quota exhaustion
 */
export class AgentProviderRotationService extends BaseService {
    private fallbackChain: FallbackChain = {
        cloud: ['openai', 'anthropic', 'google', 'github'],
        local: ['ollama']
    };

    /** In-memory health tracking for accounts */
    private accountHealth: Map<string, ProviderHealthEntry> = new Map();

    /** Optional quota provider callback for cross-domain quota access. */
    private quotaProvider: QuotaProvider | null = null;
    private projectRotationPreferences: Map<string, RotationPreference> = new Map();

    constructor(
        private keyRotationService: KeyRotationService,
        private authService: AuthService,
        private settingsService?: SettingsService
    ) {
        super('AgentProviderRotationService');
    }

    /**
     * SEC-013-2: Verify provider access authorization
     */
    private async verifyProviderAccess(provider: string): Promise<boolean> {
        try {
            const accounts = await this.authService.getAccountsByProvider(provider);
            return accounts.some(a => a.isActive);
        } catch (error) {
            this.logError(`Access verification failed for ${provider}`, error as Error);
            return false;
        }
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing provider rotation service...');

        // Load available providers from auth service
        await this.loadConfiguredProviders();
        await this.loadPersistedRotationSettings();

        this.logInfo('Provider rotation service initialized');
    }

    /**
     * Set quota provider callback for cross-domain quota access.
     * This allows the proxy/quota service to inject its quota lookup.
     */
    setQuotaProvider(provider: QuotaProvider): void {
        this.quotaProvider = provider;
        this.logInfo('Quota provider registered');
    }

    /**
     * Get quota remaining for a provider.
     * Returns undefined if quota service is not available or provider not found.
     */
    async getQuotaRemaining(provider: string): Promise<number | undefined> {
        if (!this.quotaProvider) {
            return undefined;
        }
        try {
            return await this.quotaProvider(provider);
        } catch (error) {
            this.logError(`Failed to get quota for ${provider}`, error as Error);
            return undefined;
        }
    }

    /**
     * Check whether a provider has remaining quota.
     * Undefined quota means quota data is unavailable and should not block usage.
     */
    private async hasQuotaRemaining(provider: string): Promise<boolean> {
        const quotaRemaining = await this.getQuotaRemaining(provider);
        return quotaRemaining === undefined || quotaRemaining > 0;
    }

    // ========================================================================
    // Provider Selection
    // ========================================================================

    /**
     * Load configured providers from auth database
     */
    private async loadConfiguredProviders(): Promise<void> {
        try {
            // Get all linked accounts from auth service
            const accounts = await this.authService.getAllAccounts();

            // Extract unique providers
            const cloudProviders = new Set<string>();

            for (const account of accounts) {
                if (account.provider && account.isActive) {
                    cloudProviders.add(account.provider);
                }
            }

            // Update fallback chain with available providers
            if (cloudProviders.size > 0) {
                this.fallbackChain.cloud = Array.from(cloudProviders);
                this.logInfo(`Loaded ${cloudProviders.size} cloud providers from auth database`);
            }
        } catch (error) {
            this.logWarn(`Failed to load providers from auth database, using defaults: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get initial provider configuration based on user selection
     * NASA Rule #7: Check return values
     */
    async getInitialProvider(userSelectedProvider?: string, projectId: string = DEFAULT_PROJECT_ID): Promise<ProviderConfig> {
        const chain = this.getFallbackChain(projectId);
        const provider = userSelectedProvider?.trim() || chain.cloud[0];
        if (!provider) {
            const localProvider = await this.getLocalProviderFromChain(chain);
            if (localProvider) {
                return localProvider;
            }
            throw new Error('No providers available in fallback chain');
        }

        if (chain.local.includes(provider)) {
            const localProvider = await this.getLocalProviderFromChain({ cloud: [], local: [provider] });
            if (localProvider) {
                return localProvider;
            }
            throw new Error(`Local provider ${provider} is not available`);
        }

        // SEC-013-2: Verify access
        const isAuthorized = await this.verifyProviderAccess(provider);
        if (!isAuthorized) {
            throw new Error(`Provider ${provider} is not authorized or has no active accounts`);
        }

        // Get model from settings or use default
        const model = await this.getDefaultModelForProvider(provider);

        if (!model) {
            throw new Error(`No model available for provider: ${provider}`);
        }

        return {
            provider,
            model,
            accountIndex: 0,
            status: 'active'
        };
    }

    /**
     * Get next provider in fallback chain
     * Returns null if chain exhausted
     */
    async getNextProvider(currentProvider: ProviderConfig, projectId: string = DEFAULT_PROJECT_ID): Promise<ProviderConfig | null> {
        this.logInfo(`Finding next provider after ${currentProvider.provider}`);
        const chain = this.getFallbackChain(projectId);

        // Step 1: Try rotating account for same provider
        const rotated = await this.tryRotateAccount(currentProvider);
        if (rotated) {
            this.logInfo(`Rotated to account ${rotated.accountIndex} for ${rotated.provider}`);
            return rotated;
        }

        // Step 2: Try next cloud provider
        let nextCloud: string | null = null;
        const currentIndex = chain.cloud.indexOf(currentProvider.provider);
        const startIndex = currentIndex === -1 ? 0 : currentIndex + 1;
        for (let i = startIndex; i < chain.cloud.length; i++) {
            const candidate = chain.cloud[i];
            if (await this.hasQuotaRemaining(candidate)) {
                nextCloud = candidate;
                break;
            }
            this.logInfo(`Skipping cloud provider ${candidate} due to exhausted quota`);
        }
        if (nextCloud) {
            this.logInfo(`Falling back to cloud provider: ${nextCloud}`);
            const model = await this.getDefaultModelForProvider(nextCloud);
            if (model) {
                return {
                    provider: nextCloud,
                    model,
                    accountIndex: 0,
                    status: 'active'
                };
            }
        }

        // Step 3: Try local inference
        const localProvider = await this.getLocalProviderFromChain(chain);
        if (localProvider) {
            this.logInfo('Falling back to local inference');
            return localProvider;
        }

        // Chain exhausted
        this.logWarn('Provider fallback chain exhausted');
        return null;
    }

    /**
     * Try rotating to next account for same provider
     * NASA Rule #7: Check return values
     */
    private async tryRotateAccount(
        currentProvider: ProviderConfig
    ): Promise<ProviderConfig | null> {
        const provider = currentProvider.provider;
        const accounts = await this.authService.getAccountsByProvider(provider);
        const activeAccounts = accounts.filter(a => a.isActive);

        if (activeAccounts.length <= 1) {
            // Fall back to legacy KeyRotationService for backward compatibility
            const rotated = this.keyRotationService.rotateKey(provider);
            if (!rotated) {
                return null;
            }
            return {
                ...currentProvider,
                accountIndex: currentProvider.accountIndex + 1,
                status: 'active'
            };
        }

        const nextIndex = (currentProvider.accountIndex + 1) % activeAccounts.length;

        // If we've circled back to the first account, it means we've exhausted all accounts for this provider
        if (nextIndex === 0) {
            return null;
        }

        return {
            ...currentProvider,
            accountIndex: nextIndex,
            status: 'active'
        };
    }

    /**
     * Record health telemetry for an account
     */
    async recordAccountHealth(
        provider: string,
        accountIndex: number,
        success: boolean,
        error?: string
    ): Promise<void> {
        const key = `${provider}:${accountIndex}`;
        const current = this.accountHealth.get(key) ?? { successCount: 0, errorCount: 0 };

        if (success) {
            current.successCount++;
        } else {
            current.errorCount++;
            current.lastError = error;
        }
        current.lastUsedAt = new Date();
        this.accountHealth.set(key, current);
    }

    /**
     * Get local inference provider
     * Checks if Ollama is available
     */
    private async getLocalProviderFromChain(chain: FallbackChain): Promise<ProviderConfig | null> {
        if (chain.local.length === 0) {
            return null;
        }
        if (chain.local.includes('ollama')) {
            return await this.getLocalProvider();
        }
        this.logDebug('No supported local providers found in fallback chain');
        return null;
    }

    private async getLocalProvider(): Promise<ProviderConfig | null> {
        const isOllamaAvailable = await this.checkOllamaAvailability();

        if (!isOllamaAvailable) {
            return null;
        }

        return {
            provider: 'ollama',
            model: 'llama3', // Default local model
            accountIndex: 0,
            status: 'active'
        };
    }

    /**
     * Check if Ollama is running and accessible
     */
    private async checkOllamaAvailability(): Promise<boolean> {
        try {
            const response = await fetch('http://127.0.0.1:11434/api/tags');
            return response.ok;
        } catch {
            this.logDebug('Ollama not reachable');
            return false;
        }
    }

    // ========================================================================
    // Model Management
    // ========================================================================

    /**
     * Get default model for a provider
     */
    private async getDefaultModelForProvider(provider: string): Promise<string | null> {
        // Check if user has this provider configured in auth
        const accounts = await this.authService.getAllAccounts();
        const hasProvider = accounts.some(acc => acc.provider === provider && acc.isActive);

        if (!hasProvider) {
            return null;
        }

        // Default models for each provider
        const defaultModels: Record<string, string> = {
            'openai': 'gpt-4-turbo',
            'anthropic': 'claude-3-5-sonnet-20241022',
            'google': 'gemini-1.5-pro',
            'ollama': 'llama3',
            'github': 'gpt-4o'
        };

        return defaultModels[provider] || null;
    }

    /**
     * Get available model options for user selection
     * Called when interrupt required
     */
    async getAvailableModels(): Promise<ModelOption[]> {
        const models: ModelOption[] = [];

        // Get accounts from auth database
        const accounts = await this.authService.getAllAccounts();
        const activeAccounts = accounts.filter(acc => acc.isActive);

        // Add cloud models from user's linked accounts
        for (const account of activeAccounts) {
            if (!account.provider) {
                continue;
            }

            const model = await this.getDefaultModelForProvider(account.provider);
            if (model) {
                const quotaRemaining = await this.getQuotaRemaining(account.provider);
                const hasQuotaRemaining = quotaRemaining === undefined || quotaRemaining > 0;
                models.push({
                    provider: account.provider,
                    model,
                    displayName: `${account.provider} - ${model}`,
                    type: 'cloud',
                    available: hasQuotaRemaining,
                    quotaRemaining
                });
            }
        }

        // Add local models if available
        const localProvider = await this.getLocalProvider();
        if (localProvider) {
            models.push({
                provider: localProvider.provider,
                model: localProvider.model,
                displayName: `Local - ${localProvider.model}`,
                type: 'local',
                available: true
            });
        }

        return models;
    }

    // ========================================================================
    // Provider Health Checks
    // ========================================================================

    /**
     * Check if provider is available
     */
    async isProviderAvailable(provider: string): Promise<boolean> {
        try {
            // Check if user has this provider configured in auth
            const accounts = await this.authService.getAllAccounts();
            const hasProvider = accounts.some(
                acc => acc.provider === provider && acc.isActive
            );

            return hasProvider;
        } catch (error) {
            this.logError(`Provider availability check failed for ${provider}`, error as Error);
            return false;
        }
    }

    /**
     * TODO-001-6: Get provider statistics from in-memory health tracking
     */
    async getProviderStats(provider: string): Promise<{
        requestCount: number;
        errorCount: number;
        lastError?: string;
        lastUsedAt?: Date;
        successRate: number;
    }> {
        const stats = this.aggregateProviderStats(provider);
        if (!stats) {
            return {
                requestCount: 0,
                errorCount: 0,
                successRate: 1.0 // Default to 100% for new providers
            };
        }
        return stats;
    }

    /**
     * TODO-001-6: Record a successful request for a provider
     */
    recordProviderSuccess(provider: string): void {
        const health = this.accountHealth.get(provider) ?? {
            successCount: 0,
            errorCount: 0
        };

        health.successCount++;
        health.lastUsedAt = new Date();

        this.accountHealth.set(provider, health);
        this.logDebug(`Recorded success for ${provider}: ${health.successCount} successes, ${health.errorCount} errors`);
    }

    /**
     * TODO-001-6: Record a failed request for a provider
     */
    recordProviderError(provider: string, error: string): void {
        const health = this.accountHealth.get(provider) ?? {
            successCount: 0,
            errorCount: 0
        };

        health.errorCount++;
        health.lastError = error;
        health.lastUsedAt = new Date();

        this.accountHealth.set(provider, health);
        this.logDebug(`Recorded error for ${provider}: ${error}`);
    }

    /**
     * TODO-001-6: Get all provider statistics
     */
    async getAllProviderStats(): Promise<Map<string, ProviderStats>> {
        const allStats = new Map<string, ProviderStats>();
        const providers = new Set<string>();

        for (const key of this.accountHealth.keys()) {
            providers.add(this.getProviderNameFromHealthKey(key));
        }

        for (const provider of providers) {
            const stats = this.aggregateProviderStats(provider);
            if (stats) {
                allStats.set(provider, stats);
            }
        }

        return allStats;
    }

    /**
     * TODO-001-6: Reset statistics for a provider
     */
    resetProviderStats(provider: string): void {
        for (const key of Array.from(this.accountHealth.keys())) {
            if (this.getProviderNameFromHealthKey(key) === provider) {
                this.accountHealth.delete(key);
            }
        }
        this.logInfo(`Reset stats for provider: ${provider}`);
    }

    private getProviderNameFromHealthKey(key: string): string {
        const separatorIndex = key.indexOf(':');
        if (separatorIndex === -1) {
            return key;
        }
        return key.slice(0, separatorIndex);
    }

    private aggregateProviderStats(provider: string): ProviderStats | null {
        let successCount = 0;
        let errorCount = 0;
        let lastError: string | undefined;
        let lastUsedAt: Date | undefined;
        let lastErrorAt: Date | undefined;

        for (const [key, health] of this.accountHealth.entries()) {
            if (this.getProviderNameFromHealthKey(key) !== provider) {
                continue;
            }
            successCount += health.successCount;
            errorCount += health.errorCount;
            if (health.lastUsedAt && (!lastUsedAt || health.lastUsedAt > lastUsedAt)) {
                lastUsedAt = health.lastUsedAt;
            }
            if (health.lastError && health.lastUsedAt && (!lastErrorAt || health.lastUsedAt > lastErrorAt)) {
                lastErrorAt = health.lastUsedAt;
                lastError = health.lastError;
            }
        }

        const totalRequests = successCount + errorCount;
        if (totalRequests === 0 && !lastUsedAt && !lastError) {
            return null;
        }

        return {
            requestCount: totalRequests,
            errorCount,
            lastError,
            lastUsedAt,
            successRate: totalRequests > 0 ? successCount / totalRequests : 1.0
        };
    }

    // ========================================================================
    // Model Governance (MARCH1-MODEL-GOV-001)
    // ========================================================================

    /**
     * MARCH1-MODEL-GOV-001: Check if a model is allowed by governance policy.
     * Returns true if the model passes governance checks, false if blocked.
     */
    isModelAllowedByGovernance(
        model: string,
        governance: ModelGovernanceConfig | undefined,
        taskId?: string
    ): boolean {
        if (!governance) {
            return true;
        }

        // Check blocklist first
        if (governance.blockedModels.length > 0 && governance.blockedModels.includes(model)) {
            this.logWarn(
                `Model blocked by governance policy: model=${model}, taskId=${taskId ?? 'unknown'}, reason=blocked_by_denylist`
            );
            return false;
        }

        // Check allowlist (empty = all allowed)
        if (governance.allowedModels.length > 0 && !governance.allowedModels.includes(model)) {
            this.logWarn(
                `Model blocked by governance policy: model=${model}, taskId=${taskId ?? 'unknown'}, reason=not_in_allowlist`
            );
            return false;
        }

        return true;
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    /**
     * Update fallback chain configuration
     */
    async updateFallbackChain(
        chain: Partial<FallbackChain>,
        projectId: string = DEFAULT_PROJECT_ID,
        strategy?: RotationStrategy
    ): Promise<void> {
        const currentPreference = this.getOrCreateProjectPreference(projectId);
        const updatedPreference: RotationPreference = {
            chain: {
                cloud: chain.cloud ?? currentPreference.chain.cloud,
                local: chain.local ?? currentPreference.chain.local
            },
            strategy: strategy ?? currentPreference.strategy,
            updatedAt: Date.now()
        };

        this.projectRotationPreferences.set(projectId, updatedPreference);
        if (projectId === DEFAULT_PROJECT_ID) {
            this.fallbackChain = {
                cloud: [...updatedPreference.chain.cloud],
                local: [...updatedPreference.chain.local]
            };
        }

        this.logInfo('Fallback chain updated');
        await this.persistRotationSettings();
    }

    /**
     * Get current fallback chain
     */
    getFallbackChain(projectId: string = DEFAULT_PROJECT_ID): FallbackChain {
        const preference = this.getOrCreateProjectPreference(projectId);
        return {
            cloud: [...preference.chain.cloud],
            local: [...preference.chain.local]
        };
    }

    private getOrCreateProjectPreference(projectId: string): RotationPreference {
        const existing = this.projectRotationPreferences.get(projectId);
        if (existing) {
            return existing;
        }

        return {
            chain: {
                cloud: [...this.fallbackChain.cloud],
                local: [...this.fallbackChain.local]
            },
            strategy: DEFAULT_ROTATION_STRATEGY,
            updatedAt: Date.now()
        };
    }

    private async loadPersistedRotationSettings(): Promise<void> {
        if (!this.settingsService) {
            return;
        }

        const persisted = this.settingsService.getSettings().ai?.agentProviderRotation;
        if (!persisted?.byProject) {
            return;
        }

        this.projectRotationPreferences.clear();
        for (const [projectId, preference] of Object.entries(persisted.byProject)) {
            if (!Array.isArray(preference.chain?.cloud) || !Array.isArray(preference.chain?.local)) {
                continue;
            }
            this.projectRotationPreferences.set(projectId, {
                chain: {
                    cloud: preference.chain.cloud,
                    local: preference.chain.local
                },
                strategy: preference.strategy ?? DEFAULT_ROTATION_STRATEGY,
                updatedAt: preference.updatedAt ?? Date.now()
            });
        }

        const defaultProjectId = persisted.defaultProjectId ?? DEFAULT_PROJECT_ID;
        const defaultPreference = this.projectRotationPreferences.get(defaultProjectId);
        if (defaultPreference) {
            this.fallbackChain = {
                cloud: [...defaultPreference.chain.cloud],
                local: [...defaultPreference.chain.local]
            };
        }
    }

    private async persistRotationSettings(): Promise<void> {
        if (!this.settingsService) {
            return;
        }

        const byProject: Record<string, RotationPreference> = {};
        for (const [projectId, preference] of this.projectRotationPreferences.entries()) {
            byProject[projectId] = {
                chain: {
                    cloud: [...preference.chain.cloud],
                    local: [...preference.chain.local]
                },
                strategy: preference.strategy,
                updatedAt: preference.updatedAt
            };
        }

        const currentAiSettings = this.settingsService.getSettings().ai;
        const agentProviderRotation = {
            defaultProjectId: DEFAULT_PROJECT_ID,
            byProject
        } as NonNullable<NonNullable<AppSettings['ai']>['agentProviderRotation']>;
        await this.settingsService.saveSettings({
            ai: {
                ...currentAiSettings,
                agentProviderRotation
            }
        });
    }
}
