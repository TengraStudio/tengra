/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CircuitBreaker } from '@main/core/circuit-breaker';
import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { HttpService } from '@main/services/external/http.service';
import { LLMOpenAIChatService, OpenAIStreamYield } from '@main/services/llm/chatgpt/llm-openai-chat.service';
import { LLMEmbeddingsService } from '@main/services/llm/llm-embeddings.service';
import { HuggingFaceService } from '@main/services/llm/local/huggingface.service';
import { LlamaService } from '@main/services/llm/local/llama.service';
import {
    resolveHuggingFaceLocalRouteTarget,
    resolveLocalRuntimeBaseUrl,
} from '@main/services/llm/local/local-model-runtime-router.service';
import { ModelFallbackService } from '@main/services/llm/model-fallback.service';
import { ModelSelectionService } from '@main/services/llm/model-selection.service';
import { ResponseCacheService } from '@main/services/llm/response-cache.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { TokenService } from '@main/services/security/token.service';
import { ConfigService } from '@main/services/system/config.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { ChatMessage, ContentPart, OpenAIResponse } from '@main/types/llm.types';
import { sanitizePrompt } from '@main/utils/prompt-sanitizer.util';
import { buildLocaleReinforcementInstruction } from '@shared/instructions';
import { Message, MessageContentPart, SystemMode, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { OpenAIChatCompletion } from '@shared/types/llm-provider-types';
import { ApiError, AuthenticationError, NetworkError, ValidationError } from '@shared/utils/error.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { Agent } from 'undici';

import { getContextWindowService } from './context-window.service';

const DEFAULT_MODELS = {
    OPENAI: '', // Dynamically resolved via ModelSelectionService
    EMBEDDING: '' // Dynamically resolved via ModelSelectionService
} as const;

export interface LLMChatOptions {
    model?: string;
    tools?: ToolDefinition[];
    baseUrl?: string;
    apiKey?: string;
    provider?: string;
    stream?: boolean;
    persistImages?: boolean;
    n?: number;
    temperature?: number;
    systemMode?: SystemMode;
    reasoningEffort?: string;
    workspaceRoot?: string;
    accountId?: string;
    numCtx?: number;
    metadata?: JsonObject;
    signal?: AbortSignal;
}

export interface OpenAIModelDefinition {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

/**
 * HuggingFace model metadata structure.
 */
export interface HFModel {
    id: string;
    name: string;
    description: string;
    author: string;
    downloads: number;
    likes: number;
    tags: string[];
    lastModified: string;
}

export interface LLMServiceDependencies {
    httpService: HttpService;
    configService: ConfigService;
    keyRotationService: KeyRotationService;
    settingsService: SettingsService;
    authService: AuthService;
    proxyService: ProxyService;
    tokenService?: TokenService;
    huggingFaceService: HuggingFaceService;
    llamaService?: LlamaService;
    fallbackService: ModelFallbackService;
    cacheService: ResponseCacheService;
    modelSelectionService: ModelSelectionService;
    databaseService: DatabaseService;
    eventBusService: EventBusService;
}

/**
 * Service for interacting with multiple Large Language Model providers.
 * Delegates provider-specific logic to extracted sub-services.
 */
export class LLMService {
    static readonly serviceName = 'llmService';
    static readonly dependencies = [
        'httpService',
        'configService',
        'keyRotationService',
        'settingsService',
        'authService',
        'proxyService',
        'tokenService',
        'huggingFaceService',
        'llamaService',
        'modelFallbackService',
        'responseCacheService',
        'modelSelectionService',
        'databaseService',
        'eventBusService',
    ] as const;
    private static readonly PERFORMANCE_BUDGET = {
        chatCompletionMs: 30000,
        cacheLookupMs: 50,
        maxRecentEvents: 20,
    } as const;
    private static readonly UI_MESSAGE_KEYS = {
        ready: 'serviceHealth.llm.ready',
        empty: 'serviceHealth.llm.empty',
        failure: 'serviceHealth.llm.failure',
    } as const;

    private openaiBaseUrl: string = 'https://api.openai.com/v1';
    private dispatcher: Agent | null = null;

    private usageStats = {
        openAiRequests: 0,
        openAiFailures: 0,
        lastRequestAt: 0,
        lastSuccessAt: 0,
        lastError: '' as string | null,
        recentEvents: [] as Array<{ name: string; timestamp: number; provider: string }>,
    };

    private breakers: Record<string, CircuitBreaker>;
    private deps: LLMServiceDependencies;

    // Extracted sub-services
    private openaiChat: LLMOpenAIChatService;
    private embeddingsService: LLMEmbeddingsService;

    constructor(
        httpService: HttpService,
        configService: ConfigService,
        keyRotationService: KeyRotationService,
        settingsService: SettingsService,
        authService: AuthService,
        proxyService: ProxyService,
        tokenService: TokenService | undefined,
        huggingFaceService: HuggingFaceService,
        llamaService: LlamaService | undefined,
        fallbackService: ModelFallbackService,
        cacheService: ResponseCacheService,
        modelSelectionService: ModelSelectionService,
        databaseService: DatabaseService,
        eventBusService: EventBusService
    ) {
        this.deps = {
            httpService,
            configService,
            keyRotationService,
            settingsService,
            authService,
            proxyService,
            tokenService,
            huggingFaceService,
            llamaService,
            fallbackService,
            cacheService,
            modelSelectionService,
            databaseService,
            eventBusService,
        };
        this.breakers = {
            openai: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, serviceName: 'OpenAI' }),
            anthropic: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, serviceName: 'Anthropic' }),
            groq: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, serviceName: 'Groq' }),
        };

        this.openaiChat = new LLMOpenAIChatService(
            { httpService, keyRotationService, tokenService },
            this.breakers.openai,
            (model: string, provider?: string) => this.normalizeModelName(model, provider),
            () => this.getDispatcher()
        );

        this.embeddingsService = new LLMEmbeddingsService(
            { httpService, keyRotationService },
            () => this.openaiBaseUrl
        );
    }

    /**
     * Initializes the service by loading API keys from the database.
     */
    async initialize(): Promise<void> {
        await this.reloadKeys();

        // Listen for account changes to reload keys
        this.deps.eventBusService.on('account:linked', () => this.reloadKeys());
        this.deps.eventBusService.on('account:updated', () => this.reloadKeys());
        this.deps.eventBusService.on('account:unlinked', () => this.reloadKeys());
    }

    /**
     * Reloads keys from the database.
     */
    private async reloadKeys(): Promise<void> {
        try {
            const accounts = await this.deps.databaseService.getLinkedAccounts();
            const providerKeys: Record<string, string[]> = {};
            
            for (const account of accounts) {
                if (account.isActive && (account.accessToken || account.sessionToken)) {
                    const provider = account.provider.toLowerCase();
                    const key = account.accessToken || account.sessionToken;
                    if (key) {
                        providerKeys[provider] = providerKeys[provider] || [];
                        providerKeys[provider].push(key);
                    }
                }
            }

            for (const [provider, keys] of Object.entries(providerKeys)) {
                if (keys.length > 0) {
                    this.deps.keyRotationService.initializeProviderKeys(provider, keys);
                }
            }
            appLogger.debug('LLMService', 'API keys reloaded due to account change');
        } catch (error) {
            appLogger.error('LLMService', `Failed to reload API keys: ${getErrorMessage(error as Error)}`);
        }
    }

    // --- Content safety ---

    /**
     * Sanitizes user input messages to prevent injection/XSS.
     */
    private sanitizeMessages(messages: Array<Message | ChatMessage>): Array<Message | ChatMessage> {
        return messages.map(msg => {
            if (msg.role === 'user') {
                const checkContent = (content: string) => {
                    return sanitizePrompt(content);
                };

                if (typeof msg.content === 'string') {
                    return { ...msg, content: checkContent(msg.content) };
                }

                if (Array.isArray(msg.content)) {
                    const content = msg.content as Array<ContentPart | MessageContentPart>;
                    const sanitizedContent = content.map(part => {
                        if (part.type === 'text' && typeof part.text === 'string') {
                            return { ...part, text: checkContent(part.text) };
                        }
                        return part;
                    });
                    return { ...msg, content: sanitizedContent };
                }
            }
            return msg;
        });
    }

    /**
     * Injects locale-specific instructions into the system prompt.
     */
    private applyLocaleInstructions(messages: Array<Message | ChatMessage>): Array<Message | ChatMessage> {
        const settings = this.deps.settingsService.getSettings();
        const lang = settings.general?.language ?? 'en';

        if (lang === 'en') { return messages; }
        const instruction = buildLocaleReinforcementInstruction(lang);

        const result = [...messages];
        const systemMsgIndex = result.findIndex(m => m.role === 'system');

        if (systemMsgIndex !== -1) {
            const systemMsg = result[systemMsgIndex];
            if (typeof systemMsg.content === 'string') {
                if (!systemMsg.content.includes(instruction)) {
                    result[systemMsgIndex] = {
                        ...systemMsg,
                        content: `${systemMsg.content}\n\nIMPORTANT: ${instruction}`
                    } as Message | ChatMessage;
                }
            }
        } else {
            result.unshift({
                role: 'system',
                content: `IMPORTANT: ${instruction}`
            } as Message | ChatMessage);
        }

        return result;
    }

    private applyUserPromptOverrides(
        messages: Array<Message | ChatMessage>,
        model: string,
    ): Array<Message | ChatMessage> {
        const settings = this.deps.settingsService.getSettings();
        const overrides = settings.aiPromptOverrides;
        if (!overrides) {
            return messages;
        }

        const globalOverride = overrides.global;
        const providerScopedModelKey = Object.keys(overrides.byModel ?? {})
            .find(key => key === model || key.endsWith(`:${model}`));

        const modelOverride = providerScopedModelKey
            ? overrides.byModel?.[providerScopedModelKey]
            : undefined;

        const enabledOverrides = [globalOverride, modelOverride]
            .filter(override => override?.enabled === true);

        if (enabledOverrides.length === 0) {
            return messages;
        }

        let result = [...messages];

        for (const override of enabledOverrides) {
            if (!override) {
                continue;
            }

            const systemInstructions = override.systemInstructions?.trim();
            if (systemInstructions) {
                const systemMsgIndex = result.findIndex(message => message.role === 'system');

                if (systemMsgIndex >= 0) {
                    const existing = result[systemMsgIndex];

                    if (
                        typeof existing.content === 'string'
                        && !existing.content.includes(systemInstructions)
                    ) {
                        result[systemMsgIndex] = {
                            ...existing,
                            content: `${existing.content}\n\n${systemInstructions}`,
                        } as Message | ChatMessage;
                    }
                } else {
                    result.unshift({
                        role: 'system',
                        content: systemInstructions,
                    } as Message | ChatMessage);
                }
            }

            const prefix = override.userPromptPrefix?.trim();
            const suffix = override.userPromptSuffix?.trim();

            if (prefix || suffix) {
                result = result.map(message => {
                    if (message.role !== 'user' || typeof message.content !== 'string') {
                        return message;
                    }

                    return {
                        ...message,
                        content: `${prefix ? `${prefix}\n\n` : ''}${message.content}${suffix ? `\n\n${suffix}` : ''}`,
                    } as Message | ChatMessage;
                });
            }
        }

        return result;
    }

    // --- Configuration setters ---

    setOpenAIApiKey(key: string) {
        this.deps.keyRotationService.initializeProviderKeys('openai', key);
    }
    setOpenAIBaseUrl(url: string) { this.openaiBaseUrl = url.replace(/\/$/, ''); }
    setAnthropicApiKey(key: string) {
        this.deps.keyRotationService.initializeProviderKeys('anthropic', key);
    }
    setGroqApiKey(key: string) {
        this.deps.keyRotationService.initializeProviderKeys('groq', key);
    }
    setNvidiaApiKey(key: string) {
        this.deps.keyRotationService.initializeProviderKeys('nvidia', key);
    }
    setKimiApiKey(key: string) {
        this.deps.keyRotationService.initializeProviderKeys('kimi', key);
    }

    isOpenAIConnected(): boolean {
        return !!this.deps.keyRotationService.getCurrentKey('openai');
    }

    private getDispatcher(): Agent | null {
        if (this.dispatcher) { return this.dispatcher; }
        try {
            this.dispatcher = new Agent({
                connectTimeout: 30000,
                headersTimeout: 120000,
                bodyTimeout: 120000,
                keepAliveMaxTimeout: 60000,
                keepAliveTimeout: 30000,
                connections: 10
            });
        } catch (e) {
            appLogger.error('LLMService', `Failed to create undici agent: ${getErrorMessage(e as Error)}`);
        }
        return this.dispatcher;
    }

    destroy() {
        if (this.dispatcher) {
            try {
                void this.dispatcher.destroy();
                this.dispatcher = null;
            } catch (e) {
                appLogger.error('LLMService', `Error destroying dispatcher: ${getErrorMessage(e as Error)}`);
            }
        }
    }

    private validateMessagesInput(messages: Array<Message | ChatMessage>): void {
        if (!Array.isArray(messages)) {
            throw new ValidationError('Messages must be an array', { field: 'messages' });
        }

        for (const msg of messages) {
            const role = (msg as { role?: string }).role;
            if (typeof role !== 'string' || role.trim().length === 0) {
                throw new ValidationError('Each message must include a valid role', { field: 'messages.role' });
            }

            const content = (msg as { content?: string | MessageContentPart[] | ContentPart[] }).content;
            const isValidContent = typeof content === 'string' || Array.isArray(content);
            if (!isValidContent) {
                throw new ValidationError('Each message must include string or array content', { field: 'messages.content' });
            }
        }
    }

    // --- OpenAI Chat (delegates to LLMOpenAIChatService) ---

    /** Sends a non-streaming chat completion via the OpenAI-compatible API. */
    async chatOpenAI(messages: Array<Message | ChatMessage>, options: LLMChatOptions = {}): Promise<OpenAIResponse> {
        return this.executeChatOpenAI(messages, options);
    }

    private async executeChatOpenAI(messages: Array<Message | ChatMessage>, options: LLMChatOptions): Promise<OpenAIResponse> {
        this.validateMessagesInput(messages);
        let { model = DEFAULT_MODELS.OPENAI, tools, baseUrl: baseUrlOverride, apiKey: apiKeyOverride, provider: requestedProvider, stream = false, n, signal, systemMode, reasoningEffort, workspaceRoot, metadata, accountId } = options;
        
        if (!model) {
            const selection = await this.deps.modelSelectionService.selectChatModel();
            model = selection?.model ?? '';
        }

        const provider = this.resolveProvider(model, requestedProvider);
        this.usageStats.openAiRequests += 1;
        this.usageStats.lastRequestAt = Date.now();
        this.recordUsageStatsEvent('llm.openai.request', provider);
        const overridden = this.applyUserPromptOverrides(messages, model);
        const sanitized = this.applyLocaleInstructions(this.sanitizeMessages(overridden));
        const preparedMessages = this.prepareMessagesForContextWindow(sanitized as Message[], model);

        const config = await this.getOpenAISettings(baseUrlOverride, apiKeyOverride, provider);
        const endpoint = `${config.baseUrl}/chat/completions`;

        try {
            const parsed = await this.openaiChat.executeChat(
                preparedMessages,
                { model, tools, provider, stream, n, systemMode, reasoningEffort, metadata },
                {
                    endpoint,
                    apiKey: config.apiKey,
                    numCtx: options.numCtx,
                    signal,
                    provider,
                    includeProviderHint: this.shouldIncludeProviderHint(config.baseUrl, provider),
                    workspaceRoot,
                    accountId,
                }
            );
            this.usageStats.lastSuccessAt = Date.now();
            this.usageStats.lastError = null;
            this.recordUsageStatsEvent('llm.openai.success', provider);
            return parsed;
        } catch (error) {
            this.usageStats.openAiFailures += 1;
            this.usageStats.lastError = getErrorMessage(error as Error);
            this.recordUsageStatsEvent('llm.openai.failure', provider);
            appLogger.error('LLMService', `[LLMService:OpenAI] Chat Error: ${getErrorMessage(error as Error)}`);
            if (error instanceof ApiError) { throw error; }
            throw new NetworkError(error instanceof Error ? error.message : String(error), { originalError: (error instanceof Error ? error.message : String(error)) as RuntimeValue as JsonObject });
        }
    }

    /** Sends a streaming chat completion via the OpenAI-compatible API. */
    async *chatOpenAIStream(messages: Array<Message | ChatMessage>, options: LLMChatOptions = {}): AsyncGenerator<OpenAIStreamYield> {
        yield* this.executeChatOpenAIStream(messages, options);
    }

    private async *executeChatOpenAIStream(messages: Array<Message | ChatMessage>, options: LLMChatOptions): AsyncGenerator<OpenAIStreamYield> {
        this.validateMessagesInput(messages);
        let {
            model = DEFAULT_MODELS.OPENAI,
            tools,
            baseUrl: baseUrlOverride,
            apiKey: apiKeyOverride,
            provider: requestedProvider,
            signal,
            systemMode,
            reasoningEffort,
            workspaceRoot,
            metadata,
            accountId,
            persistImages,
        } = options;

        if (!model) {
            const selection = await this.deps.modelSelectionService.selectChatModel();
            model = selection?.model ?? '';
        }

        const provider = this.resolveProvider(model, requestedProvider);
        const overridden = this.applyUserPromptOverrides(messages, model);
        const sanitized = this.applyLocaleInstructions(this.sanitizeMessages(overridden));
        const preparedMessages = this.prepareMessagesForContextWindow(sanitized as Message[], model);

        const config = await this.getOpenAISettings(baseUrlOverride, apiKeyOverride, provider);
        const endpoint = `${config.baseUrl}/chat/completions`;
        yield* this.openaiChat.executeChatStream(
            preparedMessages,
            { model, tools, provider, stream: true, systemMode, reasoningEffort, metadata, persistImages },
            {
                endpoint,
                apiKey: config.apiKey,
                numCtx: options.numCtx,
                signal,
                provider,
                includeProviderHint: this.shouldIncludeProviderHint(config.baseUrl, provider),
                workspaceRoot,
                accountId,
            }
        );
    }


    // --- Unified chat routing ---

    /** Unified streaming chat across all providers. */
    async *chatStream(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], provider?: string, options?: { systemMode?: SystemMode; reasoningEffort?: string; temperature?: number; signal?: AbortSignal; workspaceRoot?: string; accountId?: string; metadata?: JsonObject; persistImages?: boolean }) {
        const effectiveProvider = this.resolveProvider(model, provider);
        const p = effectiveProvider.toLowerCase();
        const config = await this.getRouteConfig(p, model, tools, options);

        yield* this.chatOpenAIStream(messages, {
            model, tools,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            provider: config.provider,
            temperature: config.temperature,
            systemMode: options?.systemMode,
            reasoningEffort: options?.reasoningEffort,
            metadata: options?.metadata,
            persistImages: options?.persistImages,
            signal: options?.signal,
            workspaceRoot: options?.workspaceRoot,
            accountId: options?.accountId,
            numCtx: (config as { numCtx?: number }).numCtx
        });
    }

    /** Unified non-streaming chat across all providers. */
    async chat(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], provider?: string, options?: { temperature?: number; workspaceRoot?: string; n?: number; metadata?: JsonObject; accountId?: string; stream?: boolean }): Promise<OpenAIResponse> {
        this.validateMessagesInput(messages);
        const effectiveProvider = this.resolveProvider(model, provider);
        const shouldCache = (!tools || tools.length === 0) && !this.isImageGenerationModel(model);

        if (shouldCache) {
            const cached = await this.deps.cacheService.get(messages as Message[], model, options as JsonObject);
            if (cached) { return cached; }
        }

        const chain = this.deps.fallbackService.getChain();
        if (chain.length > 0 && !provider) {
            const result = await this.deps.fallbackService.executeWithFallback(
                messages as Message[],
                async (p, m, ms, t, opts) => {
                    const res = await this.executeChatRoute(p, m, ms, t, opts as { temperature?: number; workspaceRoot?: string; n?: number; metadata?: JsonObject; accountId?: string; stream?: boolean });
                    return { content: res.content, role: 'assistant', reasoning: res.reasoning_content } as Message;
                },
                tools,
                options as JsonObject
            );

            if (result.success && result.data) {
                const response: OpenAIResponse = {
                    content: typeof result.data.content === 'string' ? result.data.content : '',
                    role: 'assistant',
                    reasoning_content: result.data.reasoning
                };
                if (shouldCache) {
                    await this.deps.cacheService.set(messages as Message[], model, response, 3600000, options as Record<string, RuntimeValue>);
                }
                return response;
            }
        }

        const response = await this.executeChatRoute(effectiveProvider, model, messages, tools, options);

        if (shouldCache) {
            await this.deps.cacheService.set(messages as Message[], model, response, 3600000, options as JsonObject);
        }

        return response;
    }

    private async executeChatRoute(provider: string, model: string, messages: Array<Message | ChatMessage>, tools?: ToolDefinition[], options?: { temperature?: number; workspaceRoot?: string; n?: number; metadata?: JsonObject; accountId?: string; stream?: boolean }): Promise<OpenAIResponse> {
        const p = provider.toLowerCase();
        const routedMessages = this.applyUserPromptOverrides(messages, model);

        const config = await this.getRouteConfig(p, model, tools, options);
        return this.chatOpenAI(routedMessages, {
            ...config,
            stream: options?.stream,
            n: options?.n,
            metadata: options?.metadata,
            accountId: options?.accountId,
            numCtx: (config as { numCtx?: number }).numCtx,
        });
    }

    private isImageGenerationModel(model: string): boolean {
        return /(\$?imagegen|gpt[-_]?image|dall[-_ ]?e|image[-_ ]?generation)/i.test(model);
    }

    // --- Embeddings (delegates to LLMEmbeddingsService) ---

    /** Generates an embedding vector for the given input text. */
    async getEmbeddings(input: string, model?: string): Promise<number[]> {
        return this.embeddingsService.getEmbeddings(input, model);
    }

    // --- Model discovery ---

    /** Searches HuggingFace models. */
    async searchHFModels(query: string = '', limit: number = 20, page: number = 0, sort: string = 'downloads'): Promise<{ models: HFModel[]; total: number }> {
        const normalizedQuery = query.trim();
        const boundedLimit = Math.max(1, Math.min(limit, 100));
        const boundedPage = Math.max(0, Math.floor(page));
        const normalizedSort = sort.trim() || 'downloads';
        return this.deps.huggingFaceService.searchModels(normalizedQuery, boundedLimit, boundedPage, normalizedSort);
    }

    /** Lists available OpenAI models. */
    async getOpenAIModels(): Promise<OpenAIModelDefinition[]> {
        try {
            const key = this.deps.keyRotationService.getCurrentKey('openai') ?? await this.getApiKey('openai');
            const headers: Record<string, string> = { 'Authorization': `Bearer ${key}` };
            const response = await this.deps.httpService.fetch(`${this.openaiBaseUrl}/models`, { method: 'GET', headers, retryCount: 1 });
            if (!response.ok) { return []; }
            const json = await response.json() as { data: OpenAIModelDefinition[] };
            return json.data;
        } catch { return []; }
    }

    // --- Health ---

    /** Returns health metrics for the LLM service. */
    getHealthMetrics(): {
        status: 'healthy' | 'degraded';
        uiState: 'ready' | 'empty' | 'failure';
        messageKey: string;
        performanceBudget: typeof LLMService.PERFORMANCE_BUDGET;
        openAiRequests: number;
        openAiFailures: number;
        lastRequestAt: number;
        lastSuccessAt: number;
        lastError: string | null;
        recentEvents: Array<{ name: string; timestamp: number; provider: string }>;
    } {
        const uiState = this.usageStats.openAiFailures > 0
            ? 'failure'
            : this.usageStats.openAiRequests === 0
                ? 'empty'
                : 'ready';
        return {
            status: this.usageStats.openAiFailures > 0 ? 'degraded' : 'healthy',
            uiState,
            messageKey: LLMService.UI_MESSAGE_KEYS[uiState],
            performanceBudget: LLMService.PERFORMANCE_BUDGET,
            openAiRequests: this.usageStats.openAiRequests,
            openAiFailures: this.usageStats.openAiFailures,
            lastRequestAt: this.usageStats.lastRequestAt,
            lastSuccessAt: this.usageStats.lastSuccessAt,
            lastError: this.usageStats.lastError,
            recentEvents: [...this.usageStats.recentEvents],
        };
    }

    /**
     * MARCH1-COL-04: Get list of currently connected/available providers
     */
    async getAvailableProviders(): Promise<string[]> {
        const providers: string[] = [];
        if (this.isOpenAIConnected()) { providers.push('openai'); }
        if (this.deps.keyRotationService.getCurrentKey('anthropic') || (await this.deps.authService.getActiveToken('anthropic'))) { providers.push('anthropic'); }
        if (this.deps.keyRotationService.getCurrentKey('groq') || (await this.deps.authService.getActiveToken('groq'))) { providers.push('groq'); }
        if (this.deps.keyRotationService.getCurrentKey('nvidia') || (await this.deps.authService.getActiveToken('nvidia'))) { providers.push('nvidia'); }
        if (this.deps.keyRotationService.getCurrentKey('kimi') || (await this.deps.authService.getActiveToken('kimi'))) { providers.push('kimi'); }
        if (await this.deps.authService.getActiveToken('mistral')) { providers.push('mistral'); }
        if (await this.deps.authService.getActiveToken('xai')) { providers.push('xai'); }
        if (await this.deps.authService.getActiveToken('deepseek')) { providers.push('deepseek'); }
        if (await this.deps.authService.getActiveToken('openrouter')) { providers.push('openrouter'); }

        const proxyKey = await this.deps.proxyService.getProxyKey().catch(() => null);
        if (proxyKey) {
            providers.push('antigravity');
            providers.push('codex');
            providers.push('cursor');
        }

        return providers;
    }

    // --- Private helpers ---

    private recordUsageStatsEvent(name: string, provider: string): void {
        this.usageStats.recentEvents.push({ name, provider, timestamp: Date.now() });
        if (this.usageStats.recentEvents.length > 20) {
            this.usageStats.recentEvents.shift();
        }
    }

    private normalizeModelName(model: string, provider?: string): string {
        const lowerProvider = (provider ?? '').toLowerCase();
        let target = model;

        if (lowerProvider === 'antigravity') {
            const lowerTarget = target.toLowerCase();
            if (lowerTarget.endsWith('-antigravity')) {
                target = target.slice(0, -'-antigravity'.length);
            }
            if (lowerTarget.startsWith('antigravity/')) {
                target = target.slice('antigravity/'.length);
            }
        }

        const prefixes: Record<string, string[]> = {
            'ollama': ['ollama/'],
            'anthropic': ['anthropic/', 'claude/'],
            'claude': ['anthropic/', 'claude/'],
            'openai': ['openai/'],
            'codex': ['codex/', 'openai/'],
            'huggingface': ['huggingface/'],
            'kimi': ['kimi/', 'moonshot/'],
            'google': ['google/', 'gemini/'],
            'nvidia': ['nvidia/'],
            'gemini': ['google/', 'gemini/'],
            'cursor': ['cursor/'],
        };

        const providerPrefixes = (prefixes as Record<string, string[] | undefined>)[lowerProvider];
        if (providerPrefixes !== undefined) {
            for (const prefix of providerPrefixes) {
                if (target.startsWith(prefix)) {
                    target = target.slice(prefix.length);
                    break;
                }
            }
        }

        if (lowerProvider === 'antigravity' && !target.startsWith('antigravity/')) {
            target = `antigravity/${target}`;
        }

        return target;
    }

    private resolveProvider(model: string, provider?: string): string {
        const normalizedProvider = provider?.trim().toLowerCase();
        if (normalizedProvider) {
            if (normalizedProvider === 'claude') { return 'anthropic'; }
            if (normalizedProvider === 'moonshot') { return 'kimi'; }
            return normalizedProvider;
        }

        const normalizedModel = model.trim().toLowerCase();
        if (normalizedModel.includes('codex') || normalizedModel.startsWith('gpt-5') || normalizedModel.startsWith('o1') || normalizedModel.startsWith('o3')) {
            return 'codex';
        }
        if (normalizedModel.startsWith('claude-') || normalizedModel.startsWith('anthropic/')) {
            return 'anthropic';
        }
        if (normalizedModel.startsWith('gemini-') || normalizedModel.startsWith('google/')) {
            return 'google';
        }
        if (normalizedModel.startsWith('kimi-') || normalizedModel.startsWith('moonshot/')) {
            return 'kimi';
        }
        if (normalizedModel.startsWith('cursor/')) {
            return 'cursor';
        }
        if (normalizedModel.startsWith('ollama/')) {
            return 'ollama';
        }
        if (normalizedModel.startsWith('local/')) {
            return 'local';
        }
        if (normalizedModel.startsWith('mistral/')) {
            return 'mistral';
        }
        if (normalizedModel.startsWith('groq/')) {
            return 'groq';
        }
        if (normalizedModel.startsWith('xai/') || normalizedModel.startsWith('grok/')) {
            return 'xai';
        }
        if (normalizedModel.startsWith('deepseek/')) {
            return 'deepseek';
        }
        if (normalizedModel.startsWith('opencode/')) {
            return 'opencode';
        }
        return 'openai';
    }

    private async getOpenAISettings(baseUrlOverride?: string, apiKeyOverride?: string, provider?: string) {
        const baseUrl = baseUrlOverride ?? this.openaiBaseUrl;
        const keyProvider = (provider === 'openai' || !provider) ? 'openai' : provider;
        const apiKey = apiKeyOverride ?? this.deps.keyRotationService.getCurrentKey(keyProvider) ?? await this.getApiKey(keyProvider);

        if (!apiKey && !baseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }
        return { baseUrl, apiKey };
    }

    private async getApiKey(provider: string): Promise<string> {
        // 1. Rotation service (DB accounts are loaded here)
        const rotatedKey = this.deps.keyRotationService.getCurrentKey(provider);
        if (rotatedKey) { return rotatedKey; }

        // 2. Opencode fallback
        if (provider.toLowerCase() === 'opencode') { return 'public'; }

        return '';
    }

    private prepareMessagesForContextWindow(messages: Message[], model: string): Message[] {
        const contextService = getContextWindowService();
        const compaction = contextService.compactMessages(messages, model, {
            reservedTokens: 1000,
            keepSystemMessages: true,
            keepRecentMessages: 12,
            strategy: 'recent-first'
        });

        if (compaction.removedCount > 0) {
            const mode = compaction.compacted ? 'compacted' : 'truncated';
            appLogger.info(
                'LLMService',
                `Context ${mode} for ${model}. removed=${compaction.removedCount} passes=${compaction.passes} utilization=${compaction.info.utilizationPercent.toFixed(1)}%`
            );
        }

        return compaction.messages;
    }

    private async getRouteConfig(provider: string, model: string, tools?: ToolDefinition[], options?: { temperature?: number; workspaceRoot?: string; n?: number; metadata?: JsonObject; accountId?: string; numCtx?: number }) {
        const p = provider.toLowerCase();
        const temp = options?.temperature;
        const workspaceRoot = options?.workspaceRoot;
        const numCtx = options?.numCtx;

        const buildProxyBaseUrl = () => {
            const proxyStatus = this.deps.proxyService.getEmbeddedProxyStatus();
            const port = proxyStatus.port ?? 8317;
            return `http://127.0.0.1:${port}/v1`;
        };

        if (p.includes('antigravity') || p.includes('gemini') || p.includes('google')) {
            const proxyUrl = buildProxyBaseUrl();
            const proxyKey = await this.deps.proxyService.getProxyKey();
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider: p.includes('antigravity') ? provider : 'gemini', temperature: temp, workspaceRoot };
        }

        if (p.includes('ollama')) {
            const settings = this.deps.settingsService.getSettings();
            const ollamaUrl = (settings['ollama'] as JsonObject | undefined)?.url ?? 'http://127.0.0.1:11434';
            const ollamaBaseUrl = `${(ollamaUrl as string).replace(/\/$/, '')}/v1`;
            const resolvedNumCtx = numCtx ?? (settings['ollama'] as JsonObject | undefined)?.numCtx ?? 8192;
            return { model, tools, baseUrl: ollamaBaseUrl, apiKey: 'ollama', provider, temperature: temp, workspaceRoot, numCtx: resolvedNumCtx };
        }

        if (p.includes('huggingface')) {
            const target = await resolveHuggingFaceLocalRouteTarget(model, this.deps.huggingFaceService);
            const baseUrl = await resolveLocalRuntimeBaseUrl(target, this.deps.llamaService);
            return {
                model: target.modelId,
                tools,
                baseUrl,
                apiKey: 'llama-cpp',
                provider: 'huggingface',
                runtimeProvider: target.runtimeProvider,
                temperature: temp,
                workspaceRoot
            };
        }

        if (p.includes('codex') || p.includes('openai')) {
            const proxyUrl = buildProxyBaseUrl();
            const proxyKey = await this.deps.proxyService.getProxyKey();
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider, temperature: temp, workspaceRoot };
        }

        if (p.includes('copilot')) {
            const proxyUrl = buildProxyBaseUrl();
            const proxyKey = await this.deps.proxyService.getProxyKey();
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider: 'copilot', temperature: temp, workspaceRoot };
        }

        if (p.includes('cursor')) {
            const proxyUrl = buildProxyBaseUrl();
            const proxyKey = await this.deps.proxyService.getProxyKey();
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider: 'cursor', temperature: temp, workspaceRoot };
        }

        if (['mistral', 'groq', 'xai', 'deepseek', 'openrouter', 'opencode', 'claude', 'anthropic', 'nvidia', 'kimi', 'moonshot'].some(ext => p.includes(ext))) {
            const proxyUrl = buildProxyBaseUrl();
            const proxyKey = await this.deps.proxyService.getProxyKey();
            const normalizedProvider = p.includes('anthropic') || p.includes('claude') ? 'claude' : 
                                      p.includes('kimi') || p.includes('moonshot') ? 'kimi' : p;
            
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider: normalizedProvider, temperature: temp, workspaceRoot };
        }

        if (p.includes('local')) {
            const account = await this.deps.authService.getActiveAccount(p);
            let baseUrl = (account?.metadata as JsonObject | undefined)?.base_url as string || 'http://localhost:8080/v1';
            if (baseUrl.endsWith('/chat/completions')) {
                baseUrl = baseUrl.replace(/\/chat\/completions$/, '');
            }
            const apiKey = await this.getApiKey(p);
            return { model, tools, baseUrl, apiKey: apiKey || 'local', provider: p, temperature: temp, workspaceRoot };
        }

        return { model, tools, provider, temperature: temp, workspaceRoot, baseUrl: undefined, apiKey: undefined };
    }

    private shouldIncludeProviderHint(baseUrl: string, provider?: string): boolean {
        if (!provider) {
            return false;
        }
        return /^https?:\/\/(localhost|127\.0\.0\.1):\d+\/v1$/i.test(baseUrl);
    }
}


