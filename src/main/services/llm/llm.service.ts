import { CircuitBreaker } from '@main/core/circuit-breaker';
import { appLogger } from '@main/logging/logger';
import { HttpService } from '@main/services/external/http.service';
import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { LlamaService } from '@main/services/llm/llama.service';
import { LLMAltProvidersService } from '@main/services/llm/llm-alt-providers.service';
import { LLMEmbeddingsService } from '@main/services/llm/llm-embeddings.service';
import { LLMOpenAIChatService, OpenAIStreamYield } from '@main/services/llm/llm-openai-chat.service';
import { ModelFallbackService } from '@main/services/llm/model-fallback.service';
import { ResponseCacheService } from '@main/services/llm/response-cache.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { TokenService } from '@main/services/security/token.service';
import { ConfigService } from '@main/services/system/config.service';
import { SettingsService } from '@main/services/system/settings.service';
import { ChatMessage, ContentPart, OpenAIResponse } from '@main/types/llm.types';
import { sanitizePrompt, validatePromptSafety } from '@main/utils/prompt-sanitizer.util';
import { buildLocaleReinforcementInstruction } from '@shared/instructions';
import { Message, MessageContentPart, SystemMode, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { OpenAIChatCompletion } from '@shared/types/llm-provider-types';
import { ApiError, AuthenticationError, NetworkError, ValidationError } from '@shared/utils/error.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { Agent } from 'undici';

import { getContextWindowService } from './context-window.service';

const DEFAULT_MODELS = {
    OPENAI: 'gpt-4o',
    EMBEDDING: 'text-embedding-3-small'
} as const;

export interface LLMChatOptions {
    model?: string;
    tools?: ToolDefinition[];
    baseUrl?: string;
    apiKey?: string;
    provider?: string;
    n?: number;
    temperature?: number;
    systemMode?: SystemMode;
    reasoningEffort?: string;
    workspaceRoot?: string;
    accountId?: string;
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
    rateLimitService: RateLimitService;
    settingsService: SettingsService;
    proxyService: ProxyService;
    tokenService?: TokenService;
    huggingFaceService: HuggingFaceService;
    llamaService?: LlamaService;
    fallbackService: ModelFallbackService;
    cacheService: ResponseCacheService;
}

/**
 * Service for interacting with multiple Large Language Model providers.
 * Delegates provider-specific logic to extracted sub-services.
 */
export class LLMService {
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

    private openaiApiKey: string = '';
    private openaiBaseUrl: string = 'https://api.openai.com/v1';
    private anthropicApiKey: string = '';
    private groqApiKey: string = '';
    private nvidiaApiKey: string = '';
    private kimiApiKey: string = '';
    private opencodeApiKey: string = '';
    private dispatcher: Agent | null = null;

    private telemetry = {
        openAiRequests: 0,
        openAiFailures: 0,
        lastRequestAt: 0,
        lastSuccessAt: 0,
        lastError: '' as string | null,
        recentEvents: [] as Array<{ name: string; timestamp: number; provider: string }>,
    };

    private breakers: Record<string, CircuitBreaker>;

    // Extracted sub-services
    private openaiChat: LLMOpenAIChatService;
    private altProviders: LLMAltProvidersService;
    private embeddingsService: LLMEmbeddingsService;

    constructor(private deps: LLMServiceDependencies) {
        this.breakers = {
            openai: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, serviceName: 'OpenAI' }),
            anthropic: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, serviceName: 'Anthropic' }),
            groq: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, serviceName: 'Groq' })
        };

        const { configService } = this.deps;
        this.openaiApiKey = configService.get('OPENAI_API_KEY', '');
        this.anthropicApiKey = configService.get('ANTHROPIC_API_KEY', '');
        this.groqApiKey = configService.get('GROQ_API_KEY', '');
        this.nvidiaApiKey = configService.get('NVIDIA_API_KEY', '');
        this.kimiApiKey = configService.get('KIMI_API_KEY', '');
        this.opencodeApiKey = configService.get('OPENCODE_API_KEY', 'public');

        this.openaiChat = new LLMOpenAIChatService(
            { httpService: deps.httpService, keyRotationService: deps.keyRotationService, rateLimitService: deps.rateLimitService, tokenService: deps.tokenService },
            this.breakers.openai,
            (model, provider) => this.normalizeModelName(model, provider),
            () => this.getDispatcher()
        );

        this.altProviders = new LLMAltProvidersService(
            { httpService: deps.httpService, keyRotationService: deps.keyRotationService, rateLimitService: deps.rateLimitService },
            this.breakers,
            {
                getAnthropicApiKey: () => this.anthropicApiKey,
                getGroqApiKey: () => this.groqApiKey,
                getNvidiaApiKey: () => this.nvidiaApiKey,
                getOpenCodeApiKey: () => this.opencodeApiKey,
            }
        );

        this.embeddingsService = new LLMEmbeddingsService(
            { httpService: deps.httpService, keyRotationService: deps.keyRotationService },
            () => this.openaiApiKey,
            () => this.openaiBaseUrl
        );
    }

    // --- Content safety ---

    /**
     * Sanitizes user input messages to prevent injection/XSS.
     */
    private sanitizeMessages(messages: Array<Message | ChatMessage>): Array<Message | ChatMessage> {
        return messages.map(msg => {
            if (msg.role === 'user') {
                const checkContent = (content: string) => {
                    const validation = validatePromptSafety(content);
                    if (!validation.safe) {
                        appLogger.warn('LLMService', `Prompt safety check failed: ${validation.reason}`);
                        throw new ValidationError(validation.reason ?? 'Unsafe content detected', { field: 'prompt' });
                    }
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

    // --- Configuration setters ---

    setOpenAIApiKey(key: string) {
        this.openaiApiKey = key;
        this.deps.keyRotationService.initializeProviderKeys('openai', key);
    }
    setOpenAIBaseUrl(url: string) { this.openaiBaseUrl = url.replace(/\/$/, ''); }
    setAnthropicApiKey(key: string) {
        this.anthropicApiKey = key;
        this.deps.keyRotationService.initializeProviderKeys('anthropic', key);
    }
    setGroqApiKey(key: string) {
        this.groqApiKey = key;
        this.deps.keyRotationService.initializeProviderKeys('groq', key);
    }
    setNvidiaApiKey(key: string) {
        this.nvidiaApiKey = key;
        this.deps.keyRotationService.initializeProviderKeys('nvidia', key);
    }
    setKimiApiKey(key: string) {
        this.kimiApiKey = key;
        this.deps.keyRotationService.initializeProviderKeys('kimi', key);
    }

    isOpenAIConnected(): boolean {
        return !!this.openaiApiKey || !!this.deps.keyRotationService.getCurrentKey('openai');
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
        const { model = DEFAULT_MODELS.OPENAI, tools, baseUrl: baseUrlOverride, apiKey: apiKeyOverride, provider: requestedProvider, n, signal, systemMode, reasoningEffort, workspaceRoot } = options;
        const provider = this.resolveProvider(model, requestedProvider);
        this.telemetry.openAiRequests += 1;
        this.telemetry.lastRequestAt = Date.now();
        this.recordTelemetryEvent('llm.openai.request', provider);
        const sanitized = this.applyLocaleInstructions(this.sanitizeMessages(messages));
        const preparedMessages = this.prepareMessagesForContextWindow(sanitized as Message[], model);

        const config = this.getOpenAISettings(baseUrlOverride, apiKeyOverride, provider);
        const endpoint = `${config.baseUrl}/chat/completions`;
        await this.deps.rateLimitService.waitForToken(provider ?? 'openai');

        try {
            const parsed = await this.openaiChat.executeChat(
                preparedMessages,
                { model, tools, provider, stream: false, n, systemMode, reasoningEffort },
                {
                    endpoint,
                    apiKey: config.apiKey,
                    signal,
                    provider,
                    includeProviderHint: this.shouldIncludeProviderHint(config.baseUrl, provider),
                    workspaceRoot,
                }
            );
            this.telemetry.lastSuccessAt = Date.now();
            this.telemetry.lastError = null;
            this.recordTelemetryEvent('llm.openai.success', provider);
            return parsed;
        } catch (error) {
            this.telemetry.openAiFailures += 1;
            this.telemetry.lastError = getErrorMessage(error as Error);
            this.recordTelemetryEvent('llm.openai.failure', provider);
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
        const { model = DEFAULT_MODELS.OPENAI, tools, baseUrl: baseUrlOverride, apiKey: apiKeyOverride, provider: requestedProvider, signal, systemMode, reasoningEffort, workspaceRoot } = options;
        const provider = this.resolveProvider(model, requestedProvider);
        const sanitized = this.applyLocaleInstructions(this.sanitizeMessages(messages));
        const preparedMessages = this.prepareMessagesForContextWindow(sanitized as Message[], model);

        const config = this.getOpenAISettings(baseUrlOverride, apiKeyOverride, provider);
        const endpoint = `${config.baseUrl}/chat/completions`;
        await this.deps.rateLimitService.waitForToken(provider ?? 'openai');

        yield* this.openaiChat.executeChatStream(
            preparedMessages,
            { model, tools, provider, stream: true, systemMode, reasoningEffort },
            {
                endpoint,
                apiKey: config.apiKey,
                signal,
                provider,
                includeProviderHint: this.shouldIncludeProviderHint(config.baseUrl, provider),
                workspaceRoot,
            }
        );
    }

    // --- Alt Provider Chat (delegates to LLMAltProvidersService) ---

    /** Sends a chat completion to the Anthropic API. */
    async chatAnthropic(messages: Array<Message | ChatMessage>, model?: string): Promise<OpenAIResponse> {
        return this.altProviders.chatAnthropic(messages, model);
    }

    /** Sends a chat completion to the Groq API. */
    async chatGroq(messages: Array<Message | ChatMessage>, model?: string): Promise<OpenAIResponse> {
        return this.altProviders.chatGroq(
            messages, model,
            (msgs, opts) => this.openaiChat.buildOpenAIBody(msgs, opts),
            (json) => this.openaiChat.processOpenAIResponse(json as RuntimeValue as OpenAIChatCompletion)
        );
    }

    /** Sends a chat completion to Nvidia via OpenAI-compatible endpoint. */
    async chatNvidia(messages: Array<Message | ChatMessage>, model: string): Promise<OpenAIResponse> {
        const key = this.altProviders.getNvidiaKey();
        return this.chatOpenAI(messages, { model, baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: key, provider: 'nvidia' });
    }

    /** Sends a chat completion to the OpenCode API. */
    async chatOpenCode(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[]): Promise<OpenAIResponse> {
        return this.altProviders.chatOpenCode(messages, model, tools,
            (msgs, opts) => this.chatOpenAI(msgs, opts)
        );
    }

    /** Streams a chat response from the OpenCode API. */
    async *chatOpenCodeStream(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], signal?: AbortSignal): AsyncGenerator<OpenAIStreamYield> {
        yield* this.altProviders.chatOpenCodeStream(messages, model, tools, signal,
            (msgs, opts) => this.chatOpenAIStream(msgs, opts as LLMChatOptions)
        );
    }

    // --- Unified chat routing ---

    /** Unified streaming chat across all providers. */
    async *chatStream(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], provider?: string, options?: { systemMode?: SystemMode; reasoningEffort?: string; temperature?: number; signal?: AbortSignal; workspaceRoot?: string; accountId?: string }) {
        const effectiveProvider = this.resolveProvider(model, provider);
        const p = effectiveProvider.toLowerCase();
        const config = await this.getRouteConfig(p, model, tools, options);

        if (p.includes('opencode')) {
            yield* this.chatOpenCodeStream(messages, model, tools, options?.signal);
        } else {
            yield* this.chatOpenAIStream(messages, {
                model, tools,
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                provider: config.provider,
                temperature: config.temperature,
                systemMode: options?.systemMode,
                reasoningEffort: options?.reasoningEffort,
                signal: options?.signal,
                workspaceRoot: options?.workspaceRoot,
                accountId: options?.accountId
            });
        }
    }

    /** Unified non-streaming chat across all providers. */
    async chat(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], provider?: string, options?: { temperature?: number; workspaceRoot?: string }): Promise<OpenAIResponse> {
        this.validateMessagesInput(messages);
        const effectiveProvider = this.resolveProvider(model, provider);

        if (!tools || tools.length === 0) {
            const cached = await this.deps.cacheService.get(messages as Message[], model, options as JsonObject);
            if (cached) { return cached; }
        }

        const chain = this.deps.fallbackService.getChain();
        if (chain.length > 0 && !provider) {
            const result = await this.deps.fallbackService.executeWithFallback(
                messages as Message[],
                async (p, m, ms, t, opts) => {
                    const res = await this.executeChatRoute(p, m, ms, t, opts as { temperature?: number; workspaceRoot?: string });
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
                if (!tools || tools.length === 0) {
                    await this.deps.cacheService.set(messages as Message[], model, response, 3600000, options as Record<string, RuntimeValue>);
                }
                return response;
            }
        }

        const response = await this.executeChatRoute(effectiveProvider, model, messages, tools, options);

        if (!tools || tools.length === 0) {
            await this.deps.cacheService.set(messages as Message[], model, response, 3600000, options as JsonObject);
        }

        return response;
    }

    private async executeChatRoute(provider: string, model: string, messages: Array<Message | ChatMessage>, tools?: ToolDefinition[], options?: { temperature?: number; workspaceRoot?: string }): Promise<OpenAIResponse> {
        const p = provider.toLowerCase();

        if (p.includes('anthropic') || p.includes('claude')) {
            return this.chatAnthropic(messages, model);
        } else if (p.includes('groq')) {
            return this.chatGroq(messages, model);
        } else if (p.includes('opencode')) {
            return this.chatOpenCode(messages, model, tools);
        } else if (p.includes('nvidia')) {
            return this.chatNvidia(messages, model);
        }

        const config = await this.getRouteConfig(p, model, tools, options);
        return this.chatOpenAI(messages, config);
    }

    // --- Embeddings (delegates to LLMEmbeddingsService) ---

    /** Generates an embedding vector for the given input text. */
    async getEmbeddings(input: string, model: string = DEFAULT_MODELS.EMBEDDING): Promise<number[]> {
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
            const key = this.deps.keyRotationService.getCurrentKey('openai') ?? this.openaiApiKey;
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
        const uiState = this.telemetry.openAiFailures > 0
            ? 'failure'
            : this.telemetry.openAiRequests === 0
                ? 'empty'
                : 'ready';
        return {
            status: this.telemetry.openAiFailures > 0 ? 'degraded' : 'healthy',
            uiState,
            messageKey: LLMService.UI_MESSAGE_KEYS[uiState],
            performanceBudget: LLMService.PERFORMANCE_BUDGET,
            openAiRequests: this.telemetry.openAiRequests,
            openAiFailures: this.telemetry.openAiFailures,
            lastRequestAt: this.telemetry.lastRequestAt,
            lastSuccessAt: this.telemetry.lastSuccessAt,
            lastError: this.telemetry.lastError,
            recentEvents: [...this.telemetry.recentEvents],
        };
    }

    /**
     * MARCH1-COL-04: Get list of currently connected/available providers
     */
    async getAvailableProviders(): Promise<string[]> {
        const providers: string[] = [];
        if (this.isOpenAIConnected()) { providers.push('openai'); }
        if (this.anthropicApiKey || this.deps.keyRotationService.getCurrentKey('anthropic')) { providers.push('anthropic'); }
        if (this.groqApiKey || this.deps.keyRotationService.getCurrentKey('groq')) { providers.push('groq'); }
        if (this.nvidiaApiKey || this.deps.keyRotationService.getCurrentKey('nvidia')) { providers.push('nvidia'); }
        if (this.kimiApiKey || this.deps.keyRotationService.getCurrentKey('kimi')) { providers.push('kimi'); }

        const proxyKey = await this.deps.proxyService.getProxyKey().catch(() => null);
        if (proxyKey) {
            providers.push('antigravity');
            providers.push('codex');
            providers.push('cursor');
        }

        return providers;
    }

    // --- Private helpers ---

    private recordTelemetryEvent(name: string, provider: string): void {
        this.telemetry.recentEvents.push({ name, provider, timestamp: Date.now() });
        if (this.telemetry.recentEvents.length > 20) {
            this.telemetry.recentEvents.shift();
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

    private normalizeHuggingFaceLocalModelId(model: string): string {
        const trimmed = model.trim();
        if (trimmed.toLowerCase().startsWith('huggingface/')) {
            return trimmed.slice('huggingface/'.length);
        }
        return trimmed;
    }

    private async resolveHuggingFaceInstalledPath(model: string): Promise<string> {
        const modelId = this.normalizeHuggingFaceLocalModelId(model);
        const versions = await this.deps.huggingFaceService.getModelVersions(modelId);
        const latest = versions[0];
        if (!latest?.path) {
            throw new ValidationError(`Installed Hugging Face model not found: ${modelId}`);
        }
        return latest.path;
    }

    private async ensureLlamaRoute(modelPath: string): Promise<string> {
        const llamaService = this.deps.llamaService;
        if (!llamaService) {
            throw new ValidationError('Llama service is unavailable for local Hugging Face models');
        }

        const loadedModel = llamaService.getLoadedModel();
        const isRunning = await llamaService.isServerRunning();
        if (loadedModel !== modelPath || !isRunning) {
            const result = await llamaService.loadModel(modelPath);
            if (!result.success) {
                throw new ValidationError(result.error ?? `Failed to load local Hugging Face model: ${modelPath}`);
            }
        }

        const config = llamaService.getConfig();
        const host = typeof config.host === 'string' && config.host.trim() !== '' ? config.host.trim() : '127.0.0.1';
        const port = typeof config.port === 'number' && Number.isFinite(config.port) ? config.port : 8080;
        return `http://${host}:${port}/v1`;
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
        return 'openai';
    }

    private getOpenAISettings(baseUrlOverride?: string, apiKeyOverride?: string, provider?: string) {
        const baseUrl = baseUrlOverride ?? this.openaiBaseUrl;
        const keyProvider = (provider === 'openai' || !provider) ? 'openai' : provider;
        const apiKey = apiKeyOverride ?? this.deps.keyRotationService.getCurrentKey(keyProvider) ?? this.openaiApiKey;

        if (!apiKey && !baseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }
        return { baseUrl, apiKey };
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

    private async getRouteConfig(provider: string, model: string, tools?: ToolDefinition[], options?: { temperature?: number; workspaceRoot?: string }) {
        const p = provider.toLowerCase();
        const temp = options?.temperature;
        const workspaceRoot = options?.workspaceRoot;

        const buildProxyBaseUrl = () => {
            const proxyStatus = this.deps.proxyService.getEmbeddedProxyStatus();
            const port = proxyStatus.port ?? 8317;
            return `http://localhost:${port}/v1`;
        };

        if (p.includes('nvidia')) {
            return { model, tools, baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: this.altProviders.getNvidiaKey(), provider: 'nvidia', temperature: temp, workspaceRoot };
        }

        if (p.includes('antigravity')) {
            const proxyUrl = buildProxyBaseUrl();
            const proxyKey = await this.deps.proxyService.getProxyKey();
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider, temperature: temp, workspaceRoot };
        }

        if (p.includes('ollama')) {
            const settings = this.deps.settingsService.getSettings();
            const ollamaUrl = (settings['ollama'] as JsonObject | undefined)?.url ?? 'http://localhost:11434';
            const ollamaBaseUrl = `${(ollamaUrl as string).replace(/\/$/, '')}/v1`;
            return { model, tools, baseUrl: ollamaBaseUrl, apiKey: 'ollama', provider, temperature: temp, workspaceRoot };
        }

        if (p.includes('huggingface')) {
            const normalizedModelId = this.normalizeHuggingFaceLocalModelId(model);
            const modelPath = await this.resolveHuggingFaceInstalledPath(normalizedModelId);
            const llamaBaseUrl = await this.ensureLlamaRoute(modelPath);
            return {
                model: normalizedModelId,
                tools,
                baseUrl: llamaBaseUrl,
                apiKey: 'llama-cpp',
                provider: 'huggingface',
                temperature: temp,
                workspaceRoot
            };
        }

        if (p.includes('codex') || p.includes('openai')) {
            const proxyUrl = buildProxyBaseUrl();
            const proxyKey = await this.deps.proxyService.getProxyKey();
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider, temperature: temp, workspaceRoot };
        }

        if (p.includes('kimi') || p.includes('moonshot')) {
            const apiKey = this.deps.keyRotationService.getCurrentKey('kimi') ?? this.kimiApiKey;
            return {
                model,
                tools,
                baseUrl: 'https://api.moonshot.ai/v1',
                apiKey,
                provider: 'kimi',
                temperature: temp,
                workspaceRoot
            };
        }

        if (p.includes('copilot') || p.includes('github')) {
            const proxyUrl = buildProxyBaseUrl();
            const proxyKey = await this.deps.proxyService.getProxyKey();
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider: 'copilot', temperature: temp, workspaceRoot };
        }

        if (p.includes('cursor')) {
            const proxyUrl = buildProxyBaseUrl();
            const proxyKey = await this.deps.proxyService.getProxyKey();
            // Compatibility-only integration point:
            // Cursor auth and private APIs are intentionally not reverse-engineered in this project.
            // We only route explicit "cursor" provider traffic through the local proxy path.
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider: 'cursor', temperature: temp, workspaceRoot };
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
