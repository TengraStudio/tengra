/**
 * LLM Provider Plugin System
 * Abstract interface for LLM providers to enable a plugin architecture.
 */

import { Message, ToolDefinition } from '@/types';

/**
 * Model information returned by providers
 */
export interface LLMModel {
    id: string;
    name: string;
    provider: string;
    contextLength?: number;
    maxTokens?: number;
    capabilities?: {
        vision?: boolean;
        functionCalling?: boolean;
        streaming?: boolean;
    };
    pricing?: {
        inputPerMillion?: number;
        outputPerMillion?: number;
    };
}

/**
 * Chat completion options
 */
export interface ChatCompletionOptions {
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    tools?: ToolDefinition[];
    stream?: boolean;
}

/**
 * Provider configuration
 */
export interface LLMProviderConfig {
    apiKey?: string;
    baseUrl?: string;
    organizationId?: string;
    timeout?: number;
    maxRetries?: number;
    [key: string]: unknown;
}

/**
 * Provider status
 */
export interface LLMProviderStatus {
    isConfigured: boolean;
    isConnected: boolean;
    lastError?: string;
    modelCount?: number;
    rateLimitRemaining?: number;
}

/**
 * Abstract LLM Provider Plugin Interface
 * All LLM providers must implement this interface.
 */
export interface ILLMProvider {
    /** Unique provider identifier */
    readonly id: string;

    /** Human-readable provider name */
    readonly name: string;

    /** Provider description */
    readonly description?: string;

    /** Provider icon (URL or base64) */
    readonly icon?: string;

    /**
     * Initialize the provider with configuration
     */
    initialize(config: LLMProviderConfig): Promise<void>;

    /**
     * Check if provider is properly configured
     */
    isConfigured(): boolean;

    /**
     * Get provider status
     */
    getStatus(): Promise<LLMProviderStatus>;

    /**
     * Get available models
     */
    getModels(): Promise<LLMModel[]>;

    /**
     * Send a chat completion request
     */
    chat(messages: Message[], options: ChatCompletionOptions): Promise<Message | null>;

    /**
     * Send a streaming chat completion request
     */
    streamChat(messages: Message[], options: ChatCompletionOptions): Promise<ReadableStream<Uint8Array> | null>;

    /**
     * Test the connection to the provider
     */
    testConnection(): Promise<{ success: boolean; error?: string }>;

    /**
     * Cleanup resources
     */
    dispose(): Promise<void>;
}

/**
 * Provider registry for managing multiple LLM providers
 */
export interface ILLMProviderRegistry {
    /**
     * Register a new provider
     */
    register(provider: ILLMProvider): void;

    /**
     * Unregister a provider
     */
    unregister(providerId: string): void;

    /**
     * Get a provider by ID
     */
    get(providerId: string): ILLMProvider | undefined;

    /**
     * Get all registered providers
     */
    getAll(): ILLMProvider[];

    /**
     * Get all configured providers
     */
    getConfigured(): ILLMProvider[];

    /**
     * Get the default provider
     */
    getDefault(): ILLMProvider | undefined;

    /**
     * Set the default provider
     */
    setDefault(providerId: string): void;
}

/**
 * Base implementation helper for providers
 */
export abstract class BaseLLMProvider implements ILLMProvider {
    abstract readonly id: string;
    abstract readonly name: string;
    readonly description?: string;
    readonly icon?: string;

    protected config: LLMProviderConfig = {};
    protected _isConfigured = false;

    async initialize(config: LLMProviderConfig): Promise<void> {
        this.config = config;
        this._isConfigured = !!config.apiKey || await this.validateConfig();
    }

    isConfigured(): boolean {
        return this._isConfigured;
    }

    protected async validateConfig(): Promise<boolean> {
        return false;
    }

    abstract getStatus(): Promise<LLMProviderStatus>;
    abstract getModels(): Promise<LLMModel[]>;
    abstract chat(messages: Message[], options: ChatCompletionOptions): Promise<Message | null>;
    abstract streamChat(messages: Message[], options: ChatCompletionOptions): Promise<ReadableStream<Uint8Array> | null>;
    abstract testConnection(): Promise<{ success: boolean; error?: string }>;

    async dispose(): Promise<void> {
        this.config = {};
        this._isConfigured = false;
    }
}

/**
 * Simple provider registry implementation
 */
export class LLMProviderRegistry implements ILLMProviderRegistry {
    private providers = new Map<string, ILLMProvider>();
    private defaultProviderId?: string;

    register(provider: ILLMProvider): void {
        this.providers.set(provider.id, provider);
        if (!this.defaultProviderId) {
            this.defaultProviderId = provider.id;
        }
    }

    unregister(providerId: string): void {
        this.providers.delete(providerId);
        if (this.defaultProviderId === providerId) {
            this.defaultProviderId = this.providers.keys().next().value;
        }
    }

    get(providerId: string): ILLMProvider | undefined {
        return this.providers.get(providerId);
    }

    getAll(): ILLMProvider[] {
        return Array.from(this.providers.values());
    }

    getConfigured(): ILLMProvider[] {
        return this.getAll().filter(p => p.isConfigured());
    }

    getDefault(): ILLMProvider | undefined {
        return this.defaultProviderId ? this.providers.get(this.defaultProviderId) : undefined;
    }

    setDefault(providerId: string): void {
        if (this.providers.has(providerId)) {
            this.defaultProviderId = providerId;
        }
    }
}
