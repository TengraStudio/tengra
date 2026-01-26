import { CircuitBreaker } from '@main/core/circuit-breaker';
import { appLogger } from '@main/logging/logger';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { HttpRequestOptions, HttpService } from '@main/services/external/http.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { TokenService } from '@main/services/security/token.service';
import { ConfigService } from '@main/services/system/config.service';
import { ChatMessage, OpenAIResponse, ToolCall } from '@main/types/llm.types';
import { ApiError, AuthenticationError, NetworkError } from '@main/utils/error.util';
import { MessageNormalizer } from '@main/utils/message-normalizer.util';
import { StreamParser } from '@main/utils/stream-parser.util';
import { Message, SystemMode, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { OpenAIChatCompletion, OpenAIContentPartImage, OpenAIMessage } from '@shared/types/llm-provider-types';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { Agent } from 'undici';

export interface LLMChatOptions {
    model?: string;
    tools?: ToolDefinition[];
    baseUrl?: string;
    apiKey?: string;
    provider?: string;
    n?: number; // Number of completions to generate
    temperature?: number; // Temperature for response randomness (0-2)
    systemMode?: SystemMode;
    projectRoot?: string;
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

/**
 * Service for interacting with multiple Large Language Model providers.
 */
export class LLMService {
    private openaiApiKey: string = '';
    private openaiBaseUrl: string = 'https://api.openai.com/v1';
    private anthropicApiKey: string = '';

    private groqApiKey: string = '';
    private proxyUrl: string = 'http://localhost:8317/v1';
    private proxyKey: string = 'connected';
    private dispatcher: Agent | null = null;
    private imagePersistence: ImagePersistenceService;

    // Circuit Breakers
    private breakers: Record<string, CircuitBreaker>;

    constructor(
        private httpService: HttpService,
        private configService: ConfigService,
        private keyRotationService: KeyRotationService,
        private rateLimitService: RateLimitService,
        private tokenService?: TokenService
    ) {
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

        // Initialize config from env if available (ConfigService waterfall)
        this.openaiApiKey = this.configService.get('OPENAI_API_KEY', '');
        this.anthropicApiKey = this.configService.get('ANTHROPIC_API_KEY', '');

        this.groqApiKey = this.configService.get('GROQ_API_KEY', '');
    }

    // --- Configuration ---

    // Note: Setters are kept for runtime updates from settings UI.
    // Ideally, changes should propagate to KeyRotationService as well.

    setOpenAIApiKey(key: string) {
        this.openaiApiKey = key;
        this.keyRotationService.initializeProviderKeys('openai', key);
    }
    setOpenAIBaseUrl(url: string) { this.openaiBaseUrl = url.replace(/\/$/, ''); }
    setAnthropicApiKey(key: string) {
        this.anthropicApiKey = key;
        this.keyRotationService.initializeProviderKeys('anthropic', key);
    }

    setGroqApiKey(key: string) {
        this.groqApiKey = key;
        this.keyRotationService.initializeProviderKeys('groq', key);
    }
    setProxySettings(url: string, key: string) {
        this.proxyUrl = url.replace(/\/$/, '');
        this.proxyKey = key;
    }

    isOpenAIConnected(): boolean {
        return !!this.openaiApiKey || !!this.keyRotationService.getCurrentKey('openai');
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
        const { model = 'gpt-4o', tools, baseUrl: baseUrlOverride, apiKey: apiKeyOverride, provider, n } = options;
        const config = this.getOpenAISettings(baseUrlOverride, apiKeyOverride);
        const endpoint = `${config.baseUrl}/chat/completions`;

        await this.rateLimitService.waitForToken(provider ?? 'openai');

        const execute = async () => {
            const body = this.buildOpenAIBody(messages, { model, tools, provider, stream: false, n });
            const requestInit = this.createOpenAIRequest(body, config.apiKey);

            const response = await this.breakers.openai.execute(() =>
                this.httpService.fetch(endpoint, {
                    ...requestInit,
                    retryCount: 2,
                    timeoutMs: 300000
                } as HttpRequestOptions)
            );

            if (!response.ok) {
                // Seamless retry for 401/403
                if ((response.status === 401 || response.status === 403) && provider && this.tokenService) {
                    appLogger.info('LLMService', `Unauthorized (${response.status}) for ${provider}, attempting proactive refresh and retry...`);
                    try {
                        await this.tokenService.ensureFreshToken(provider, true);
                        const retryResponse = await this.httpService.fetch(endpoint, {
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
        const { model = 'gpt-4o', tools, baseUrl: baseUrlOverride, apiKey: apiKeyOverride, provider } = options;
        const config = this.getOpenAISettings(baseUrlOverride, apiKeyOverride);
        const endpoint = `${config.baseUrl}/chat/completions`;

        await this.rateLimitService.waitForToken(provider ?? 'openai');

        const body = this.buildOpenAIBody(messages, { model, tools, provider, stream: true });
        const requestInit = this.createOpenAIRequest(body, config.apiKey);

        const response = await this.httpService.fetch(endpoint, {
            ...requestInit,
            retryCount: 2,
            timeoutMs: 300000
        });

        if (!response.ok) {
            // Seamless retry for 401/403
            if ((response.status === 401 || response.status === 403) && provider && this.tokenService) {
                appLogger.info('LLMService', `Unauthorized (${response.status}) for ${provider}, attempting proactive refresh and retry...`);
                try {
                    await this.tokenService.ensureFreshToken(provider, true);
                    const retryResponse = await this.httpService.fetch(endpoint, {
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

        yield* this.handleOpenAIStreamResponse(response);
    }

    private async *handleOpenAIStreamResponse(response: Response) {
        try {
            for await (const chunk of StreamParser.parseChatStream(response)) {
                const savedImages = await this.saveImagesFromStreamChunk(chunk.images);

                yield {
                    ...(chunk.index !== undefined ? { index: chunk.index } : {}),
                    ...(chunk.content ? { content: chunk.content } : {}),
                    ...(chunk.reasoning ? { reasoning: chunk.reasoning } : {}),
                    images: savedImages,
                    ...(chunk.type ? { type: chunk.type } : {}),
                    ...(chunk.tool_calls ? { tool_calls: chunk.tool_calls } : {}),
                    ...(chunk.usage ? { usage: chunk.usage } : {})
                };
            }
        } catch (e) {
            appLogger.error('LLMService', `Stream Loop Error: ${getErrorMessage(e as Error)}`);
            throw e;
        }
    }

    async chatOpenCode(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[]): Promise<OpenAIResponse> {
        return this.chatOpenCodeRequest(messages, model, tools) as Promise<OpenAIResponse>;
    }

    private async chatOpenCodeRequest(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[]): Promise<OpenAIResponse> {
        const apiKey = 'public';
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
            this.httpService.fetch(endpoint, {
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

    async * chatOpenCodeStream(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[]): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: ToolCall[]; type?: string }> {
        const apiKey = 'public';
        const baseUrl = 'https://opencode.ai/zen/v1';

        if (model === 'gpt-5-nano') {
            yield* this.handleOpenCodeZenStream(messages, model, apiKey, baseUrl);
        } else {
            yield* this.chatOpenAIStream(messages, { model, tools, baseUrl, apiKey, provider: 'opencode' });
        }
    }

    private async * handleOpenCodeZenStream(messages: Array<Message | ChatMessage>, model: string, apiKey: string, baseUrl: string): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: ToolCall[]; type?: string }> {
        const endpoint = `${baseUrl}/responses`;
        const normalized = MessageNormalizer.normalizeOpenCodeResponsesMessages(messages);
        const body = { model, input: normalized, stream: true };

        const response = await this.httpService.fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            retryCount: 2,
            timeoutMs: 300000
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new ApiError(errorText || `HTTP ${response.status}`, 'opencode-stream', response.status);
        }

        try {
            for await (const chunk of StreamParser.parseChatStream(response)) {
                yield {
                    ...(chunk.content ? { content: chunk.content } : {}),
                    ...(chunk.reasoning ? { reasoning: chunk.reasoning } : {}),
                    ...(chunk.type ? { type: chunk.type } : {}),
                    ...(chunk.tool_calls ? { tool_calls: chunk.tool_calls } : {}),
                    ...(chunk.images ? { images: chunk.images.map(img => typeof img === 'string' ? img : img.image_url.url) } : {})
                };
            }
        } catch (e) {
            appLogger.error('LLMService', `[LLMService:OpenCode] Stream Loop Error: ${getErrorMessage(e as Error)}`);
            throw e;
        }
    }

    async chatAnthropic(messages: Array<Message | ChatMessage>, model: string = 'claude-3-5-sonnet-20240620'): Promise<OpenAIResponse> {
        const key = this.keyRotationService.getCurrentKey('anthropic') ?? this.anthropicApiKey;
        if (!key) { throw new AuthenticationError('Anthropic API Key not set'); }
        await this.rateLimitService.waitForToken('anthropic');

        try {
            const body = this.buildAnthropicBody(messages, model);
            const response = await this.breakers.anthropic.execute(() =>
                this.httpService.fetch('https://api.anthropic.com/v1/messages', {
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
            if (response.status === 401) { this.keyRotationService.rotateKey('anthropic'); }
            throw new ApiError((error['message'] as string) || 'Anthropic API Error', 'anthropic', response.status, false, { type: error['type'] ?? null });
        }
        const content = data['content'] as Array<{ text: string }> | undefined;
        return { content: content?.[0]?.text ?? '', role: 'assistant' };
    }



    async chatGroq(messages: Array<Message | ChatMessage>, model: string = 'llama3-70b-8192'): Promise<OpenAIResponse> {
        const key = this.getGroqKey();
        if (!key) { throw new AuthenticationError('Groq API Key not set'); }
        await this.rateLimitService.waitForToken('groq');

        try {
            const body = this.buildOpenAIBody(messages, { model, provider: 'groq' });
            const response = await this.breakers.groq.execute(() =>
                this.httpService.fetch('https://api.groq.com/openai/v1/chat/completions', {
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

    private getGroqKey(): string {
        const key = this.keyRotationService.getCurrentKey('groq') ?? this.groqApiKey;
        if (!key) { throw new AuthenticationError('Groq API Key not set'); }
        return key;
    }

    private handleGroqError(error: unknown): Error {
        if (error instanceof ApiError || error instanceof AuthenticationError) { return error; }
        return new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'groq' });
    }

    async chat(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], provider?: string, options?: { temperature?: number }): Promise<OpenAIResponse> {
        const p = (provider ?? '').toLowerCase();
        const temp = options?.temperature;
        if (p.includes('anthropic') || p.includes('claude')) {
            return this.chatAnthropic(messages, model);
        } else if (p.includes('groq')) {
            return this.chatGroq(messages, model);
        } else if (p.includes('antigravity')) {
            return this.chatOpenAI(messages, { model, tools, baseUrl: this.proxyUrl, apiKey: this.proxyKey, provider, temperature: temp });
        } else if (p.includes('ollama')) {
            return this.chatOpenAI(messages, { model, tools, baseUrl: 'http://127.0.0.1:11434/v1', apiKey: 'ollama', provider, temperature: temp });
        } else {
            return this.chatOpenAI(messages, { model, tools, provider, temperature: temp });
        }
    }

    async searchHFModels(query: string = '', limit: number = 20, page: number = 0, sort: string = 'downloads'): Promise<{ models: HFModel[], total: number }> {
        try {
            const { searchQuery, hfSort } = this.prepareHFSearchParams(query, sort);
            const params = new URLSearchParams({
                search: searchQuery, filter: 'gguf', limit: limit.toString(), full: 'true', sort: hfSort, direction: '-1', offset: (page * limit).toString()
            });

            const response = await this.httpService.fetch(`https://huggingface.co/api/models?${params.toString()}`, { retryCount: 2 });
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

    async getEmbeddings(input: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
        const key = this.keyRotationService.getCurrentKey('openai') ?? this.openaiApiKey;
        const baseUrl = this.openaiBaseUrl;

        if (!key && !baseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }

        try {
            const response = await this.httpService.fetch(`${baseUrl}/embeddings`, {
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

    private throwNoEmbeddingError(): never {
        throw new ApiError('No embedding data returned', 'openai-embeddings', 200);
    }

    private handleEmbeddingError(error: unknown): Error {
        appLogger.error('LLMService', `Embedding Error: ${getErrorMessage(error as Error)}`);
        if (error instanceof ApiError) { return error; }
        return new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'openai-bindings' });
    }

    async getOpenAIModels(): Promise<OpenAIModelDefinition[]> {
        try {
            const key = this.keyRotationService.getCurrentKey('openai') ?? this.openaiApiKey;
            const headers: Record<string, string> = { 'Authorization': `Bearer ${key}` };
            const response = await this.httpService.fetch(`${this.openaiBaseUrl}/models`, { method: 'GET', headers, retryCount: 1 });
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
            'google': ['google/', 'gemini/'],
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

    private getOpenAISettings(baseUrlOverride?: string, apiKeyOverride?: string) {
        const baseUrl = baseUrlOverride ?? this.openaiBaseUrl;
        const apiKey = apiKeyOverride ?? this.keyRotationService.getCurrentKey('openai') ?? this.openaiApiKey;

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
    }) {
        const { model, tools, provider, stream = false, n = 1, temperature, systemMode } = options;
        const normalizedMessages = MessageNormalizer.normalizeOpenAIMessages(messages, model);
        let finalModel = this.normalizeModelName(model, provider);

        if (finalModel.endsWith('-thinking')) {
            finalModel += '(8192)';
        }

        const body: Record<string, unknown> = {
            model: finalModel,
            messages: normalizedMessages,
            provider,
            stream
        };

        // Reasoning Effort Logic for 'o1' and 'o3' class models
        if (finalModel.startsWith('o1') || finalModel.startsWith('o3')) {
            if (systemMode === 'thinking') {
                body.reasoning_effort = 'high';
            } else if (systemMode === 'fast') {
                body.reasoning_effort = 'low';
            } else {
                body.reasoning_effort = 'medium'; // Default for Agent or unspecified
            }
        }

        if (stream) {
            body.stream_options = { include_usage: true };
        }

        if (temperature !== undefined) {
            body.temperature = temperature;
        }

        if (n > 1) {
            body.n = n;
        }

        if (tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = 'auto';
        }
        return body;
    }

    private createOpenAIRequest(body: unknown, apiKey: string) {
        const dispatcher = this.getDispatcher();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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
            this.keyRotationService.rotateKey('openai');
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
            this.keyRotationService.rotateKey('openai');
        }

        if (response.status === 429) {
            this.logDetailedQuotaError(response, model, provider, errorText);
        }

        throw new ApiError(errorText || `HTTP ${response.status}`, 'openai-stream', response.status, response.status >= 500 || response.status === 429);
    }

    private logDetailedQuotaError(response: Response, model: string, provider: string | undefined, errorText: string) {
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

        return {
            content: content || (output['text'] as string) || '',
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
            id: (call['id'] as string) || `call_${Math.random().toString(36).substring(2, 11)}`,
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

            const savedImages = await this.saveImagesFromOpenAIMessage(message);
            const messageContent = this.extractTextFromOpenAIMessage(message);


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
