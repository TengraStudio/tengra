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
    private accountHealth: Map<string, {
        successCount: number;
        errorCount: number;
        lastError?: string;
        lastUsedAt?: Date;
    }> = new Map();

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
        const nextCloud = this.getNextCloudProvider(currentProvider.provider, chain);
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
     * Get next cloud provider in fallback chain
     */
    private getNextCloudProvider(currentProvider: string, chain: FallbackChain): string | null {
        const currentIndex = chain.cloud.indexOf(currentProvider);

        if (currentIndex === -1 || currentIndex === chain.cloud.length - 1) {
            return null;
        }

        return chain.cloud[currentIndex + 1];
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
                models.push({
                    provider: account.provider,
                    model,
                    displayName: `${account.provider} - ${model}`,
                    type: 'cloud',
                    available: true,
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
        const health = this.accountHealth.get(provider);
        if (!health) {
            return {
                requestCount: 0,
                errorCount: 0,
                successRate: 1.0 // Default to 100% for new providers
            };
        }

        const totalRequests = health.successCount + health.errorCount;
        const successRate = totalRequests > 0 ? health.successCount / totalRequests : 1.0;

        return {
            requestCount: totalRequests,
            errorCount: health.errorCount,
            lastError: health.lastError,
            lastUsedAt: health.lastUsedAt,
            successRate
        };
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
    async getAllProviderStats(): Promise<Map<string, {
        requestCount: number;
        errorCount: number;
        lastError?: string;
        lastUsedAt?: Date;
        successRate: number;
    }>> {
        const allStats = new Map<string, {
            requestCount: number;
            errorCount: number;
            lastError?: string;
            lastUsedAt?: Date;
            successRate: number;
        }>();

        for (const [provider, health] of this.accountHealth) {
            const totalRequests = health.successCount + health.errorCount;
            const successRate = totalRequests > 0 ? health.successCount / totalRequests : 1.0;

            allStats.set(provider, {
                requestCount: totalRequests,
                errorCount: health.errorCount,
                lastError: health.lastError,
                lastUsedAt: health.lastUsedAt,
                successRate
            });
        }

        return allStats;
    }

    /**
     * TODO-001-6: Reset statistics for a provider
     */
    resetProviderStats(provider: string): void {
        this.accountHealth.delete(provider);
        this.logInfo(`Reset stats for provider: ${provider}`);
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
