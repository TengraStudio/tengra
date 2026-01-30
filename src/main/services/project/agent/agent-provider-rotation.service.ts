/**
 * Agent Provider Rotation Service
 * 
 * Manages provider/model rotation and fallback chain
 * Integrates with AuthService to check user's configured providers
 */

import { BaseService } from '@main/services/base.service';
import { AuthService } from '@main/services/security/auth.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { ModelOption, ProviderConfig } from '@shared/types/agent-state';

/**
 * Provider fallback chain configuration
 */
interface FallbackChain {
    cloud: string[];  // e.g., ['openai', 'anthropic', 'google']
    local: string[];  // e.g., ['ollama', 'llamacpp']
}

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

    constructor(
        private keyRotationService: KeyRotationService,
        private authService: AuthService
    ) {
        super('AgentProviderRotationService');
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing provider rotation service...');

        // Load available providers from auth service
        await this.loadConfiguredProviders();

        this.logInfo('Provider rotation service initialized');
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
    async getInitialProvider(userSelectedProvider?: string): Promise<ProviderConfig> {
        const provider = userSelectedProvider ?? this.fallbackChain.cloud[0];

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
    async getNextProvider(currentProvider: ProviderConfig): Promise<ProviderConfig | null> {
        this.logInfo(`Finding next provider after ${currentProvider.provider}`);

        // Step 1: Try rotating account for same provider
        const rotated = await this.tryRotateAccount(currentProvider);
        if (rotated) {
            this.logInfo(`Rotated to account ${rotated.accountIndex} for ${rotated.provider}`);
            return rotated;
        }

        // Step 2: Try next cloud provider
        const nextCloud = this.getNextCloudProvider(currentProvider.provider);
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
        const localProvider = await this.getLocalProvider();
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
    private getNextCloudProvider(currentProvider: string): string | null {
        const currentIndex = this.fallbackChain.cloud.indexOf(currentProvider);

        if (currentIndex === -1 || currentIndex === this.fallbackChain.cloud.length - 1) {
            return null;
        }

        return this.fallbackChain.cloud[currentIndex + 1];
    }

    /**
     * Get local inference provider
     * Checks if Ollama is available
     */
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
                models.push({
                    provider: account.provider,
                    model,
                    displayName: `${account.provider} - ${model}`,
                    type: 'cloud',
                    available: true,
                    quotaRemaining: undefined // TODO: Get from quota service
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
     * Get provider statistics
     */
    async getProviderStats(_provider: string): Promise<{
        requestCount: number;
        errorCount: number;
        lastError?: string;
    }> {
        // TODO: Query from database
        return {
            requestCount: 0,
            errorCount: 0
        };
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    /**
     * Update fallback chain configuration
     */
    async updateFallbackChain(chain: Partial<FallbackChain>): Promise<void> {
        if (chain.cloud) {
            this.fallbackChain.cloud = chain.cloud;
        }
        if (chain.local) {
            this.fallbackChain.local = chain.local;
        }

        this.logInfo('Fallback chain updated');

        // TODO: Persist to settings
    }

    /**
     * Get current fallback chain
     */
    getFallbackChain(): FallbackChain {
        return { ...this.fallbackChain };
    }
}
