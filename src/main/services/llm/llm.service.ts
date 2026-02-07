import { CircuitBreaker } from '@main/core/circuit-breaker';
import { appLogger } from '@main/logging/logger';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { HttpRequestOptions, HttpService } from '@main/services/external/http.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { TokenService } from '@main/services/security/token.service';
import { ConfigService } from '@main/services/system/config.service';
import { SettingsService } from '@main/services/system/settings.service';
import { ChatMessage, OpenAIResponse, ToolCall } from '@main/types/llm.types';
import { ApiError, AuthenticationError, NetworkError } from '@main/utils/error.util';
import { MessageNormalizer } from '@main/utils/message-normalizer.util';
import { StreamChunk, StreamParser } from '@main/utils/stream-parser.util';
import { Message, SystemMode, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { OpenAIChatCompletion, OpenAIContentPartImage, OpenAIMessage } from '@shared/types/llm-provider-types';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { Agent } from 'undici';

import { getContextWindowService } from './context-window.service';

// QUAL-002-3, QUAL-002-4: Extract configurable provider URLs
const GROQ_API_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

const DEFAULT_MODELS = {
    OPENAI: 'gpt-4o',
    ANTHROPIC: 'claude-3-5-sonnet-20240620',
    GROQ: 'llama3-70b-8192',
    EMBEDDING: 'text-embedding-3-small'
} as const;

export interface LLMChatOptions {
    model?: string;
    tools?: ToolDefinition[];
    baseUrl?: string;
    apiKey?: string;
    provider?: string;
    n?: number; // Number of completions to generate
    temperature?: number; // Temperature for response randomness (0-2)
    systemMode?: SystemMode;
    reasoningEffort?: string;
    projectRoot?: string;
    signal?: AbortSignal;
}

export interface OpenAIModelDefinition {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

/**
 * HuggingFace API model response structure.
 */
interface HuggingFaceApiModel {
    modelId: string;
    author?: string;
    downloads?: number;
    likes?: number;
    tags?: string[];
    lastModified?: string;
    pipeline_tag?: string;
    cardData?: {
        short_description?: string;
    };
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
}

/**
 * Service for interacting with multiple Large Language Model providers.
 */
export class LLMService {
    private openaiApiKey: string = '';
    private openaiBaseUrl: string = 'https://api.openai.com/v1';
    private anthropicApiKey: string = '';

    private groqApiKey: string = '';
    private nvidiaApiKey: string = '';
    private opencodeApiKey: string = '';
    private dispatcher: Agent | null = null;
    private imagePersistence: ImagePersistenceService;

    // Circuit Breakers
    private breakers: Record<string, CircuitBreaker>;

    constructor(private deps: LLMServiceDependencies) {
        // The dataService parameter was removed, so we need to adjust the ImagePersistenceService initialization.
        // Assuming ImagePersistenceService can be initialized without dataService if it's truly unused by LLMService.
        // If dataService is still needed by ImagePersistenceService, it should not be removed from the constructor.
        this.imagePersistence = new ImagePersistenceService();

        // Initialize Circuit Breakers with reasonable defaults
        this.breakers = {
            openai: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, serviceName: 'OpenAI' }),
            anthropic: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, serviceName: 'Anthropic' }),

            groq: new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, serviceName: 'Groq' })
        };

        const { configService } = this.deps;

        // Initialize config from env if available (ConfigService waterfall)
        this.openaiApiKey = configService.get('OPENAI_API_KEY', '');
        this.anthropicApiKey = configService.get('ANTHROPIC_API_KEY', '');

        this.groqApiKey = configService.get('GROQ_API_KEY', '');
        this.nvidiaApiKey = configService.get('NVIDIA_API_KEY', '');

        // Internal default keys
        this.opencodeApiKey = configService.get('OPENCODE_API_KEY', 'public');
    }

    /**
     * SEC-013-2: Content Filtering
     * Validate LLM output against safety policies
     */
    private validateContent(content: string): string {
        // Basic filtering for sensitive patterns (placeholder)
        // In fully implemented version, this would check for:
        // - PII leaks
        // - Malicious code injection patterns
        // - System prompt leaks

        const FORBIDDEN_PATTERNS = [
            '<script>alert(',
            'javascript:alert(',
            '-----BEGIN RSA PRIVATE KEY-----'
        ];

        for (const pattern of FORBIDDEN_PATTERNS) {
            if (content.includes(pattern)) {
                appLogger.warn('LLMService', 'Content filtering blocked unsafe pattern');
                return '[CONTENT BLOCKED BY SECURITY POLICY]';
            }
        }
        return content;
    }

    // --- Configuration ---

    // Note: Setters are kept for runtime updates from settings UI.
    // Ideally, changes should propagate to KeyRotationService as well.

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

    // --- Chat Methods ---

    async chatOpenAI(messages: Array<Message | ChatMessage>, options: LLMChatOptions = {}): Promise<OpenAIResponse> {
        return this.executeChatOpenAI(messages, options);
    }

    private async executeChatOpenAI(messages: Array<Message | ChatMessage>, options: LLMChatOptions): Promise<OpenAIResponse> {
        const { model = DEFAULT_MODELS.OPENAI, tools, baseUrl: baseUrlOverride, apiKey: apiKeyOverride, provider: requestedProvider, n, signal, systemMode, reasoningEffort } = options;
        const provider = this.resolveProvider(model, requestedProvider);

        // LLM-001-3: Context overflow mitigation
        const contextService = getContextWindowService();
        const { truncated } = contextService.truncateMessages(messages as Message[], model, { reservedTokens: 1000 });

        const config = this.getOpenAISettings(baseUrlOverride, apiKeyOverride, provider);
        const endpoint = `${config.baseUrl}/chat/completions`;

        await this.deps.rateLimitService.waitForToken(provider ?? 'openai');

        const execute = async () => {
            const body = this.buildOpenAIBody(truncated, { model, tools, provider, stream: false, n, systemMode, reasoningEffort });
            const requestInit = this.createOpenAIRequest(body, config.apiKey);
            if (signal) { requestInit.signal = signal; }

            const response = await this.breakers.openai.execute(() =>
                this.deps.httpService.fetch(endpoint, {
                    ...requestInit,
                    retryCount: 2,
                    timeoutMs: 300000
                } as HttpRequestOptions)
            );

            if (!response.ok) {
                // Seamless retry for 401/403
                if ((response.status === 401 || response.status === 403) && provider && this.deps.tokenService) {
                    appLogger.info('LLMService', `Unauthorized (${response.status}) for ${provider}, attempting proactive refresh and retry...`);
                    try {
                        await this.deps.tokenService.ensureFreshToken(provider, true);
                        const retryResponse = await this.deps.httpService.fetch(endpoint, {
                            ...requestInit,
                            retryCount: 1,
                            timeoutMs: 300000
                        } as HttpRequestOptions);
                        if (retryResponse.ok) {
                            const json = await retryResponse.json() as OpenAIChatCompletion;
                            return this.processOpenAIResponse(json);
                        }
                    } catch (err) {
                        appLogger.error('LLMService', `Proactive refresh/retry failed: ${getErrorMessage(err)}`);
                    }
                }
                await this.handleOpenAIError(response);
            }

            const json = await response.json() as OpenAIChatCompletion;
            return this.processOpenAIResponse(json);
        };

        try {
            return await execute();
        } catch (error) {
            appLogger.error('LLMService', `[LLMService:OpenAI] Chat Error: ${getErrorMessage(error as Error)}`);
            if (error instanceof ApiError) { throw error; }
            throw new NetworkError(error instanceof Error ? error.message : String(error), { originalError: error instanceof Error ? error : String(error) });
        }
    }

    async *chatOpenAIStream(messages: Array<Message | ChatMessage>, options: LLMChatOptions = {}): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: ToolCall[]; type?: string, usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number } }> {
        yield* this.executeChatOpenAIStream(messages, options);
    }

    private async *executeChatOpenAIStream(messages: Array<Message | ChatMessage>, options: LLMChatOptions): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: ToolCall[]; type?: string, usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number } }> {
        const { model = DEFAULT_MODELS.OPENAI, tools, baseUrl: baseUrlOverride, apiKey: apiKeyOverride, provider: requestedProvider, signal, systemMode, reasoningEffort } = options;
        const provider = this.resolveProvider(model, requestedProvider);

        const contextService = getContextWindowService();
        const { truncated } = contextService.truncateMessages(messages as Message[], model, { reservedTokens: 1000 });

        const config = this.getOpenAISettings(baseUrlOverride, apiKeyOverride, provider);
        const endpoint = `${config.baseUrl}/chat/completions`;

        await this.deps.rateLimitService.waitForToken(provider ?? 'openai');

        const body = this.buildOpenAIBody(truncated, { model, tools, provider, stream: true, systemMode, reasoningEffort });
        const acceptHeader = provider === 'nvidia' ? 'application/json' : 'text/event-stream';
        const requestInit = this.createOpenAIRequest(body, config.apiKey, { 'Accept': acceptHeader });
        if (signal) { requestInit.signal = signal; }

        const response = await this.deps.httpService.fetch(endpoint, {
            ...requestInit,
            retryCount: 2,
            timeoutMs: 300000
        });

        if (!response.ok) {
            yield* this.handleOpenAIStreamErrorRetry(response, endpoint, requestInit, model, provider);
            return;
        }

        yield* this.handleOpenAIStreamResponse(response);
    }

    private async * handleOpenAIStreamErrorRetry(response: Response, endpoint: string, requestInit: HttpRequestOptions, model: string, provider?: string) {
        if ((response.status === 401 || response.status === 403) && provider && this.deps.tokenService) {
            appLogger.info('LLMService', `Unauthorized (${response.status}) for ${provider}, attempting proactive refresh and retry...`);
            try {
                await this.deps.tokenService.ensureFreshToken(provider, true);
                const retryResponse = await this.deps.httpService.fetch(endpoint, {
                    ...requestInit,
                    retryCount: 1,
                    timeoutMs: 300000
                });
                if (retryResponse.ok) {
                    yield* this.handleOpenAIStreamResponse(retryResponse);
                    return;
                }
                await this.handleOpenAIStreamError(retryResponse, model, provider);
            } catch (err) {
                appLogger.error('LLMService', `Proactive refresh/retry failed: ${getErrorMessage(err)}`);
            }
        }
        await this.handleOpenAIStreamError(response, model, provider);
    }

    private async * handleOpenAIStreamResponse(response: Response) {
        try {
            for await (const chunk of StreamParser.parseChatStream(response)) {
                const processedChunk = await this.processStreamChunk(chunk);
                if (processedChunk.content) {
                    processedChunk.content = this.validateContent(processedChunk.content);
                }
                yield processedChunk;
            }
        } catch (e) {
            appLogger.error('LLMService', `Stream Loop Error: ${getErrorMessage(e as Error)}`);
            throw e;
        }
    }

    private async processStreamChunk(chunk: StreamChunk) {
        const savedImages = await this.saveImagesFromStreamChunk(chunk.images);
        return {
            ...(chunk.index !== undefined ? { index: chunk.index } : {}),
            ...(chunk.content ? { content: chunk.content } : {}),
            ...(chunk.reasoning ? { reasoning: chunk.reasoning } : {}),
            images: savedImages,
            ...(chunk.type ? { type: chunk.type } : {}),
            ...(chunk.tool_calls ? { tool_calls: chunk.tool_calls } : {}),
            ...(chunk.usage ? { usage: chunk.usage } : {})
        };
    }

    async chatOpenCode(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[]): Promise<OpenAIResponse> {
        return this.chatOpenCodeRequest(messages, model, tools);
    }

    private async chatOpenCodeRequest(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[]): Promise<OpenAIResponse> {
        const apiKey = this.opencodeApiKey;
        const baseUrl = 'https://opencode.ai/zen/v1';

        if (model === 'gpt-5-nano') {
            return this.executeOpenCodeGpt5Nano(messages, model, baseUrl, apiKey);
        }
        return this.chatOpenAI(messages, { model, tools, baseUrl, apiKey, provider: 'opencode' });
    }

    private async executeOpenCodeGpt5Nano(messages: Array<Message | ChatMessage>, model: string, baseUrl: string, apiKey: string): Promise<OpenAIResponse> {
        const endpoint = `${baseUrl}/responses`;
        const normalized = MessageNormalizer.normalizeOpenCodeResponsesMessages(messages);
        const body = { model, input: normalized, stream: false };

        const response = await this.breakers.openai.execute(() =>
            this.deps.httpService.fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(body),
                retryCount: 2
            })
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new ApiError(errorText || `HTTP ${response.status}`, 'opencode', response.status);
        }

        const json = await response.json() as JsonObject;
        return this.parseOpenCodeResponse(json);
    }

    async * chatOpenCodeStream(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], signal?: AbortSignal): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: ToolCall[]; type?: string, usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number } }> {
        const apiKey = this.opencodeApiKey;
        const baseUrl = 'https://opencode.ai/zen/v1';

        if (model === 'gpt-5-nano') {
            yield* this.handleOpenCodeZenStream(messages, model, apiKey, baseUrl, signal);
        } else {
            yield* this.chatOpenAIStream(messages, { model, tools, baseUrl, apiKey, provider: 'opencode', signal });
        }
    }

    private async * handleOpenCodeZenStream(messages: Array<Message | ChatMessage>, model: string, apiKey: string, baseUrl: string, signal?: AbortSignal): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: ToolCall[]; type?: string }> {
        const endpoint = `${baseUrl}/responses`;
        const normalized = MessageNormalizer.normalizeOpenCodeResponsesMessages(messages);
        const body = { model, input: normalized, stream: true };

        const response = await this.deps.httpService.fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            retryCount: 2,
            timeoutMs: 300000,
            signal
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new ApiError(errorText || `HTTP ${response.status}`, 'opencode-stream', response.status);
        }

        try {
            for await (const chunk of StreamParser.parseChatStream(response)) {
                const processedChunk = {
                    ...(chunk.content ? { content: this.validateContent(chunk.content) } : {}),
                    ...(chunk.reasoning ? { reasoning: chunk.reasoning } : {}),
                    ...(chunk.type ? { type: chunk.type } : {}),
                    ...(chunk.tool_calls ? { tool_calls: chunk.tool_calls } : {}),
                    ...(chunk.images ? { images: chunk.images.map(img => typeof img === 'string' ? img : img.image_url.url) } : {})
                };
                yield processedChunk;
            }
        } catch (e) {
            appLogger.error('LLMService', `[LLMService:OpenCode] Stream Loop Error: ${getErrorMessage(e as Error)}`);
            throw e;
        }
    }

    async chatAnthropic(messages: Array<Message | ChatMessage>, model: string = DEFAULT_MODELS.ANTHROPIC): Promise<OpenAIResponse> {
        const key = this.deps.keyRotationService.getCurrentKey('anthropic') ?? this.anthropicApiKey;
        if (!key) { throw new AuthenticationError('Anthropic API Key not set'); }
        await this.deps.rateLimitService.waitForToken('anthropic');

        try {
            const body = this.buildAnthropicBody(messages, model);
            const response = await this.breakers.anthropic.execute(() =>
                this.deps.httpService.fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
                    body: JSON.stringify(body),
                    retryCount: 2
                })
            );
            return await this.handleAnthropicApiResponse(response);
        } catch (error) {
            throw this.handleAnthropicError(error ?? new Error('Unknown Anthropic Error'));
        }
    }

    private async handleAnthropicApiResponse(response: Response): Promise<OpenAIResponse> {
        const data = await response.json() as JsonObject;
        const error = data['error'] as JsonObject | undefined;
        if (error) {
            if (response.status === 401) { this.deps.keyRotationService.rotateKey('anthropic'); }
            throw new ApiError((error['message'] as string) || 'Anthropic API Error', 'anthropic', response.status, false, { type: error['type'] ?? null });
        }
        const content = data['content'] as Array<{ text: string }> | undefined;
        const validatedContent = this.validateContent(content?.[0]?.text ?? '');
        return { content: validatedContent, role: 'assistant' };
    }



    async chatGroq(messages: Array<Message | ChatMessage>, model: string = DEFAULT_MODELS.GROQ): Promise<OpenAIResponse> {
        const key = this.getGroqKey();
        if (!key) { throw new AuthenticationError('Groq API Key not set'); }
        await this.deps.rateLimitService.waitForToken('groq');

        try {
            const body = this.buildOpenAIBody(messages, { model, provider: 'groq' });
            const response = await this.breakers.groq.execute(() =>
                this.deps.httpService.fetch(GROQ_API_BASE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify(body),
                    retryCount: 2
                })
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new ApiError(errorText, 'groq', response.status);
            }

            const json = await response.json() as OpenAIChatCompletion;
            return await this.processOpenAIResponse(json);
        } catch (error) {
            throw this.handleGroqError(error ?? new Error('Unknown Groq Error'));
        }
    }

    async chatNvidia(messages: Array<Message | ChatMessage>, model: string): Promise<OpenAIResponse> {
        const key = this.getNvidiaKey();
        // Nvidia uses OpenAI compatible endpoint
        return this.chatOpenAI(messages, { model, baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: key, provider: 'nvidia' });
    }

    private getNvidiaKey(): string {
        const key = this.deps.keyRotationService.getCurrentKey('nvidia') ?? this.nvidiaApiKey;
        if (!key) { throw new AuthenticationError('Nvidia API Key not set'); }
        return key;
    }

    private getGroqKey(): string {
        const key = this.deps.keyRotationService.getCurrentKey('groq') ?? this.groqApiKey;
        if (!key) { throw new AuthenticationError('Groq API Key not set'); }
        return key;
    }

    private handleGroqError(error: unknown): Error {
        if (error instanceof ApiError || error instanceof AuthenticationError) { return error; }
        return new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'groq' });
    }

    async * chatStream(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], provider?: string, options?: { systemMode?: SystemMode, reasoningEffort?: string, temperature?: number, signal?: AbortSignal, projectRoot?: string }) {
        const effectiveProvider = this.resolveProvider(model, provider);
        const p = effectiveProvider.toLowerCase();
        const config = await this.getRouteConfig(p, model, tools, options);

        if (p.includes('opencode')) {
            yield* this.chatOpenCodeStream(messages, model, tools);
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
                projectRoot: options?.projectRoot
            });
        }
    }

    private async getRouteConfig(provider: string, model: string, tools?: ToolDefinition[], options?: { temperature?: number, projectRoot?: string }) {
        const p = provider.toLowerCase();
        const temp = options?.temperature;
        const projectRoot = options?.projectRoot;

        const buildProxyBaseUrl = (ampProvider: string) => {
            const proxyStatus = this.deps.proxyService.getEmbeddedProxyStatus();
            const port = proxyStatus.port ?? 8317;
            return `http://localhost:${port}/api/provider/${ampProvider}/v1`;
        };

        if (p.includes('nvidia')) {
            return { model, tools, baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: this.getNvidiaKey(), provider: 'nvidia', temperature: temp, projectRoot };
        }

        if (p.includes('antigravity')) {
            const proxyUrl = buildProxyBaseUrl('antigravity');
            const proxyKey = await this.deps.proxyService.getProxyKey();
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider, temperature: temp, projectRoot };
        }

        if (p.includes('ollama')) {
            const settings = this.deps.settingsService.getSettings();
            const ollamaUrl = (settings['ollama'] as JsonObject | undefined)?.url ?? 'http://localhost:11434';
            const ollamaBaseUrl = `${(ollamaUrl as string).replace(/\/$/, '')}/v1`;
            return { model, tools, baseUrl: ollamaBaseUrl, apiKey: 'ollama', provider, temperature: temp, projectRoot };
        }

        // Route Codex/OpenAI through embedded proxy
        if (p.includes('codex') || p.includes('openai')) {
            const proxyUrl = buildProxyBaseUrl(this.toAmpProvider(provider));
            const proxyKey = await this.deps.proxyService.getProxyKey();
            return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider, temperature: temp, projectRoot };
        }

        return { model, tools, provider, temperature: temp, projectRoot, baseUrl: undefined, apiKey: undefined };
    }

    async chat(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], provider?: string, options?: { temperature?: number, projectRoot?: string }): Promise<OpenAIResponse> {
        const effectiveProvider = this.resolveProvider(model, provider);
        const p = effectiveProvider.toLowerCase();

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

    async searchHFModels(query: string = '', limit: number = 20, page: number = 0, sort: string = 'downloads'): Promise<{ models: HFModel[], total: number }> {
        try {
            const { searchQuery, hfSort } = this.prepareHFSearchParams(query, sort);
            const params = new URLSearchParams({
                search: searchQuery, filter: 'gguf', limit: limit.toString(), full: 'true', sort: hfSort, direction: '-1', offset: (page * limit).toString()
            });

            const response = await this.deps.httpService.fetch(`https://huggingface.co/api/models?${params.toString()}`, { retryCount: 2 });
            const totalCount = parseInt(response.headers.get('x-total-count') ?? '0');
            const data = await response.json() as HuggingFaceApiModel[];

            const models = this.mapHFModels(data);
            const displayTotal = totalCount > 0 ? totalCount : (searchQuery.toLowerCase() === 'gguf' ? 156607 : models.length);

            return { models, total: displayTotal };
        } catch {
            return { models: [], total: 0 };
        }
    }

    private prepareHFSearchParams(query: string, sort: string) {
        let searchQuery = query.trim() || 'GGUF';
        if (searchQuery !== 'GGUF' && !searchQuery.toLowerCase().includes('gguf')) {
            searchQuery = `${searchQuery} GGUF`;
        }
        const hfSort = sort === 'newest' ? 'updated' : sort;
        return { searchQuery, hfSort };
    }

    private mapHFModels(data: HuggingFaceApiModel[]): HFModel[] {
        return data.map((m) => this.mapSingleHFModel(m));
    }

    private mapSingleHFModel(m: HuggingFaceApiModel): HFModel {
        return {
            id: m.modelId,
            name: m.modelId.split('/')[1] ?? m.modelId,
            author: m.author ?? 'unknown',
            description: this.getHFModelDescription(m),
            downloads: m.downloads ?? 0,
            likes: m.likes ?? 0,
            tags: m.tags ?? [],
            lastModified: m.lastModified ?? ''
        };
    }

    private getHFModelDescription(m: HuggingFaceApiModel): string {
        return m.cardData?.short_description ?? `A ${m.pipeline_tag ?? 'LLM'} model by ${m.author ?? 'unknown'}`;
    }

    async getEmbeddings(input: string, model: string = DEFAULT_MODELS.EMBEDDING): Promise<number[]> {
        const key = this.deps.keyRotationService.getCurrentKey('openai') ?? this.openaiApiKey;
        const baseUrl = this.openaiBaseUrl;

        if (!key && !baseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }

        try {
            const response = await this.deps.httpService.fetch(`${baseUrl}/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({ model, input }),
                retryCount: 3
            });

            return await this.processEmbeddingResponse(response);
        } catch (error) {
            throw this.handleEmbeddingError(error);
        }
    }

    private async processEmbeddingResponse(response: Response): Promise<number[]> {
        if (!response.ok) {
            const errorText = await response.text();
            throw new ApiError(errorText, 'openai-embeddings', response.status);
        }

        const json = await response.json() as { data: Array<{ embedding: number[] }> };
        return json.data[0].embedding;
    }



    private handleEmbeddingError(error: unknown): Error {
        appLogger.error('LLMService', `Embedding Error: ${getErrorMessage(error as Error)}`);
        if (error instanceof ApiError) { return error; }
        return new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'openai-bindings' });
    }

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

    /**
     * Normalizes a model name by stripping provider prefixes (e.g., 'ollama/')
     * when hitting direct provider endpoints.
     */
    private normalizeModelName(model: string, provider?: string): string {
        const lowerProvider = (provider ?? '').toLowerCase();
        let target = model;

        const prefixes: Record<string, string[]> = {
            'ollama': ['ollama/'],
            'anthropic': ['anthropic/', 'claude/'],
            'claude': ['anthropic/', 'claude/'],
            'openai': ['openai/'],
            'codex': ['codex/', 'openai/'],
            'google': ['google/', 'gemini/'],
            'nvidia': ['nvidia/'],
            'gemini': ['google/', 'gemini/'],
            // 'antigravity': ['antigravity/']
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

        // Fix for Antigravity: The proxy requires 'antigravity/' prefix to identify the provider.
        // If it's missing (e.g. from model-service), we must add it.
        if (lowerProvider === 'antigravity' && !target.startsWith('antigravity/')) {
            target = `antigravity/${target}`;
        }

        return target;
    }

    private resolveProvider(model: string, provider?: string): string {
        const normalizedProvider = provider?.trim().toLowerCase();
        if (normalizedProvider) {
            if (normalizedProvider === 'claude') { return 'anthropic'; }
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
        if (normalizedModel.startsWith('ollama/')) {
            return 'ollama';
        }
        return 'openai';
    }

    private toAmpProvider(provider: string): string {
        const p = provider.trim().toLowerCase();
        if (p === 'claude') { return 'anthropic'; }
        if (p === 'gemini') { return 'google'; }
        if (p === 'codex' || p === 'openai' || p === 'anthropic' || p === 'google' || p === 'antigravity') {
            return p;
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


    private buildOpenAIBody(messages: Array<Message | ChatMessage>, options: {
        model: string;
        tools?: ToolDefinition[];
        provider?: string;
        stream?: boolean;
        n?: number;
        temperature?: number;
        systemMode?: SystemMode;
        reasoningEffort?: string;
    }) {
        const { model, tools, provider, stream = false, n = 1, temperature, systemMode, reasoningEffort } = options;
        const normalizedMessages = MessageNormalizer.normalizeOpenAIMessages(messages, model);
        const finalModel = this.getPreparedModelName(model, provider);

        const body: Record<string, unknown> = {
            model: finalModel,
            messages: normalizedMessages,
            stream
        };

        this.applyReasoningEffort(body, finalModel, systemMode, reasoningEffort);
        this.applyStreamOptions(body, stream, provider);
        this.applyOptionalOpenAIParams(body, n, provider, temperature);
        this.applyTools(body, tools);

        return body;
    }

    private applyStreamOptions(body: Record<string, unknown>, stream: boolean, provider?: string): void {
        if (stream && provider !== 'nvidia') {
            body.stream_options = { include_usage: true };
        }
    }

    private applyOptionalOpenAIParams(body: Record<string, unknown>, n: number, provider?: string, temperature?: number): void {
        if (temperature !== undefined) {
            body.temperature = temperature;
        }
        if (n > 1) {
            body.n = n;
        }
        if (provider === 'nvidia' && !body.max_tokens) {
            body.max_tokens = 4096;
        }
    }

    private applyTools(body: Record<string, unknown>, tools?: ToolDefinition[]): void {
        if (tools && tools.length > 0) {
            body.tools = this.sanitizeTools(tools);
            body.tool_choice = 'auto';
        }
    }

    private getPreparedModelName(model: string, provider?: string): string {
        return this.normalizeModelName(model, provider);
    }

    private applyReasoningEffort(body: Record<string, unknown>, model: string, systemMode?: SystemMode, reasoningEffort?: string): void {
        const modelType = this.detectReasoningModelType(model);
        if (!modelType) { return; }

        const effort = this.resolveEffortLevel(reasoningEffort, systemMode);

        switch (modelType) {
            case 'openai':
                body.reasoning_effort = effort;
                break;
            case 'gemini3':
                body.thinking_level = effort;
                break;
            case 'gemini25':
                body.thinking_budget = this.getGeminiBudget(effort);
                break;
            case 'claude':
                body.thinking = { type: 'enabled', budget_tokens: this.getClaudeBudget(effort) };
                break;
        }
    }

    private detectReasoningModelType(model: string): 'openai' | 'gemini3' | 'gemini25' | 'claude' | null {
        const m = model.toLowerCase();

        if (this.isOpenAIReasoningModel(m)) { return 'openai'; }
        if (/gemini-3\.?/.test(m)) { return 'gemini3'; }
        if (/gemini-2[.-]5/.test(m)) { return 'gemini25'; }
        if (this.isClaudeThinkingModel(m)) { return 'claude'; }

        return null;
    }

    private isOpenAIReasoningModel(m: string): boolean {
        return /^o[134](-|$)/.test(m) ||
            (m.startsWith('gpt-5') && !m.includes('mini')) ||
            (m.includes('grok') && m.includes('code'));
    }

    private isClaudeThinkingModel(m: string): boolean {
        if (!m.includes('claude')) { return false; }
        return /opus-4|sonnet-4|haiku-4\.5|4-[15]-|4\.[15]-/.test(m);
    }

    private resolveEffortLevel(reasoningEffort?: string, systemMode?: SystemMode): string {
        if (reasoningEffort) { return reasoningEffort; }
        const modeMap: Record<string, string> = { 'thinking': 'high', 'fast': 'low' };
        return modeMap[systemMode ?? ''] ?? 'medium';
    }

    private getGeminiBudget(effort: string): number {
        const budgetMap: Record<string, number> = { 'minimal': 128, 'low': 2048, 'medium': 8192, 'high': 16384 };
        return budgetMap[effort] ?? 8192;
    }

    private getClaudeBudget(effort: string): number {
        const budgetMap: Record<string, number> = { 'low': 2048, 'medium': 8192, 'high': 16384 };
        return budgetMap[effort] ?? 8192;
    }

    private sanitizeTools(tools: ToolDefinition[]): unknown[] {
        return tools.map(tool => {
            const params = tool.function.parameters ? { ...tool.function.parameters as JsonObject } : {};
            if (params.required) {
                delete params.required;
            }
            return {
                ...tool,
                function: {
                    ...tool.function,
                    parameters: params
                }
            };
        });
    }

    private createOpenAIRequest(body: unknown, apiKey: string, extraHeaders: Record<string, string> = {}) {
        const dispatcher = this.getDispatcher();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...extraHeaders
        };

        const requestInit: RequestInit & { dispatcher?: Agent } = {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        };
        if (dispatcher) { requestInit.dispatcher = dispatcher; }
        return requestInit;
    }

    private async handleOpenAIError(response: Response) {
        const errorText = await response.text();
        if (response.status === 401 || response.status === 403) {
            this.deps.keyRotationService.rotateKey('openai');
        }
        throw new ApiError(errorText || `HTTP ${response.status}`, 'openai', response.status, response.status >= 500 || response.status === 429);
    }

    private async saveImagesFromOpenAIMessage(message: OpenAIMessage): Promise<string[]> {
        const contentParts = Array.isArray(message.content) ? message.content : [];
        const rawImages = contentParts.filter((part): part is OpenAIContentPartImage =>
            part.type === 'image_url'
        );
        const savedImages: string[] = [];

        if (rawImages.length > 0) {
            await Promise.all(rawImages.map(async (img) => {
                const url = img.image_url.url;
                if (url) {
                    try {
                        const localPath = await this.imagePersistence.saveImage(url);
                        savedImages.push(localPath);
                    } catch (e) {
                        appLogger.warn('LLMService', `Failed to save image: ${getErrorMessage(e as Error)}`);
                    }
                }
            }));
        }
        return savedImages;
    }

    private extractTextFromOpenAIMessage(message: OpenAIMessage): string {
        if (typeof message.content === 'string') {
            return message.content;
        }
        if (Array.isArray(message.content)) {
            return message.content
                .filter((part): part is { type: 'text'; text: string } =>
                    part.type === 'text'
                )
                .map(part => part.text)
                .join('');
        }
        return '';
    }

    private async handleOpenAIStreamError(response: Response, model: string, provider?: string) {
        const errorText = await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403) {
            this.deps.keyRotationService.rotateKey('openai');
        }

        if (response.status === 429) {
            this.logDetailedQuotaError(response, model, provider, errorText);
        }

        throw new ApiError(errorText || `HTTP ${response.status}`, 'openai-stream', response.status, response.status >= 500 || response.status === 429);
    }

    private logDetailedQuotaError(_response: Response, model: string, provider: string | undefined, errorText: string) {
        appLogger.error('LLMService', `429 Error for model ${model}, provider ${provider}`);
        appLogger.error('LLMService', `Error details: ${errorText}`);

        try {
            type OpenAIErrorBody = { error?: { message?: string } }
            const errorJson = safeJsonParse<OpenAIErrorBody>(errorText, {});
            const errorMessage = errorJson.error?.message;
            if (typeof errorMessage === 'string' && errorMessage.includes('quota')) {
                appLogger.warn('LLMService', 'Possible quota exhaustion detected despite individual model capacity.');
            }
        } catch {
            // Not JSON
        }
    }

    private async saveImagesFromStreamChunk(images: Array<string | { image_url: { url: string } }> | undefined): Promise<string[]> {
        if (!images || images.length === 0) { return []; }

        const savedImages: string[] = [];
        await Promise.all(images.map(async (img) => {
            const url = (typeof img === 'string') ? img : img.image_url.url;
            if (url) {
                try {
                    const localPath = await this.imagePersistence.saveImage(url);
                    savedImages.push(localPath);
                } catch (e) {
                    appLogger.warn('LLMService', `Failed to save image in stream: ${getErrorMessage(e as Error)}`);
                }
            }
        }));
        return savedImages;
    }

    private parseOpenCodeResponse(json: JsonObject): OpenAIResponse {
        const rawOutput = json['output'];
        const outputArray = Array.isArray(rawOutput) ? rawOutput : [rawOutput];
        const output = outputArray.find((o: unknown) => o && typeof o === 'object' && (o as JsonObject).type === 'message') as JsonObject | undefined;

        if (!output) {
            throw new ApiError('Unexpected response format from OpenCode', 'opencode', 200);
        }

        const { content, reasoning, tool_calls } = this.extractOpenCodeContent(output);
        const validatedContent = this.validateContent(content || (output['text'] as string) || '');

        return {
            content: validatedContent,
            role: 'assistant',
            reasoning_content: reasoning || undefined,
            tool_calls: tool_calls.length > 0 ? tool_calls : undefined
        } as OpenAIResponse;
    }

    private extractOpenCodeContent(output: JsonObject) {
        let content = '';
        let reasoning = '';
        const tool_calls: ToolCall[] = [];
        const rawContent = output['content'];

        if (Array.isArray(rawContent)) {
            for (const part of rawContent as JsonObject[]) {
                if (part['type'] === 'output_text') {
                    content += (part['text'] as string);
                } else if (part['type'] === 'reasoning' || part['type'] === 'summary_text') {
                    reasoning += (part['text'] as string);
                } else if (part['type'] === 'function_call' && part['function_call']) {
                    tool_calls.push(this.parseOpenCodeToolCall(part['function_call'] as JsonObject));
                }
            }
        }
        return { content, reasoning, tool_calls };
    }

    private parseOpenCodeToolCall(call: JsonObject): ToolCall {
        return {
            id: (call['id'] as string) || `call_${crypto.randomUUID().substring(0, 8)}`,
            type: 'function',
            function: {
                name: call['name'] as string,
                arguments: typeof call['arguments'] === 'string'
                    ? call['arguments']
                    : JSON.stringify(call['arguments'])
            }
        };
    }

    private buildAnthropicBody(messages: Array<Message | ChatMessage>, model: string) {
        const normalized = MessageNormalizer.normalizeAnthropicMessages(messages);
        const systemMessage = messages.find(m => m.role === 'system')?.content;

        const body: Record<string, unknown> = {
            model,
            messages: normalized,
            max_tokens: 4096
        };
        if (typeof systemMessage === 'string') { body.system = systemMessage; }
        return body;
    }

    private async processOpenAIResponse(json: OpenAIChatCompletion): Promise<OpenAIResponse> {
        if (json.choices.length > 0) {
            // Primary choice
            const choice = json.choices[0];
            const message = choice.message;

            // Apply Content Filtering
            const completion = this.extractTextFromOpenAIMessage(message);
            const validatedCompletion = this.validateContent(completion);

            const savedImages = await this.saveImagesFromOpenAIMessage(message);
            const messageContent = validatedCompletion;


            // Process all choices for variants
            const variants = await this.extractVariantsFromChoices(json.choices, json.model);

            const result: OpenAIResponse = {
                content: messageContent,
                role: message.role,
                images: savedImages,
                variants: variants.length > 1 ? variants : undefined
            };

            if (message.tool_calls) { result.tool_calls = message.tool_calls; }
            if (json.usage) {
                result.promptTokens = json.usage.prompt_tokens;
                result.completionTokens = json.usage.completion_tokens;
                result.totalTokens = json.usage.total_tokens;
            }

            const reasoning = message.reasoning_content ?? message.reasoning;
            if (reasoning) { result.reasoning_content = reasoning; }

            return result;
        }
        throw new ApiError('No choices returned from model', 'openai', 200, false);
    }

    private async extractVariantsFromChoices(choices: OpenAIChatCompletion['choices'], model: string) {
        return Promise.all(choices.map(async (c) => {
            const cMsg = c.message;
            const cContent = this.extractTextFromOpenAIMessage(cMsg);
            // Note: We are not saving images for all variants yet to avoid dupes/spam
            return {
                content: cContent,
                role: cMsg.role,
                model
            };
        }));
    }

    private handleAnthropicError(error: unknown): Error {
        if (error instanceof ApiError || error instanceof AuthenticationError) { return error; }
        return new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'anthropic' });
    }
}
