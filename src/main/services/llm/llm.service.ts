import { Agent } from 'undici';
import { ImagePersistenceService } from '../image-persistence.service';
import { MessageNormalizer } from '../../utils/message-normalizer.util';
import { StreamParser } from '../../utils/stream-parser.util';
import { ApiError, NetworkError, AuthenticationError } from '../../utils/error.util';
import { ChatMessage, ToolCall } from '../../types/llm.types';
import { Message, ToolDefinition } from '../../../shared/types/chat';
import { OpenAIChatCompletion, OpenAIContentPartImage } from '../../../shared/types/llm-provider-types';
import { CircuitBreaker } from '../../core/circuit-breaker';
import { HttpService } from '../http.service';
import { ConfigService } from '../config.service';
import { KeyRotationService } from '../security/key-rotation.service';
import { RateLimitService } from '../security/rate-limit.service';

import { OpenAIResponse } from '../../types/llm.types';

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
        // private dataService?: DataService // Unused
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
        if (this.dispatcher) return this.dispatcher;
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
            console.error('[LLMService] Failed to create undici agent:', e);
        }
        return this.dispatcher;
    }

    destroy() {
        if (this.dispatcher) {
            try {
                this.dispatcher.destroy();
                this.dispatcher = null;
            } catch (e) {
                console.error('[LLMService] Error destroying dispatcher:', e);
            }
        }
    }

    // --- Chat Methods ---

    async chatOpenAI(messages: Array<Message | ChatMessage>, model: string = 'gpt-4o', tools?: ToolDefinition[], baseUrlOverride?: string, apiKeyOverride?: string, provider?: string): Promise<OpenAIResponse> {
        const effectiveBaseUrl = baseUrlOverride || this.openaiBaseUrl;

        // Key Rotation Logic
        const effectiveApiKey = apiKeyOverride || this.keyRotationService.getCurrentKey('openai') || this.openaiApiKey;

        if (!effectiveApiKey && !effectiveBaseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }

        const endpoint = `${effectiveBaseUrl}/chat/completions`;

        // Rate Limiting
        await this.rateLimitService.waitForToken('openai');

        try {
            const normalizedMessages = MessageNormalizer.normalizeOpenAIMessages(messages, model);

            let finalModel = model;
            if (effectiveBaseUrl.includes(':8317') && !finalModel.includes('/')) {
                // Proxy Routing Logic: Prefix models based on provider and model type
                const lowerModel = finalModel.toLowerCase();
                const lowerProvider = (provider || '').toLowerCase();

                // IMPORTANT: For antigravity provider, ALL models (Gemini, Claude, etc.) 
                // should be sent WITHOUT prefix. The proxy routes internally based on model name.
                if (lowerProvider === 'antigravity') {
                    // Don't prefix antigravity models - proxy handles routing internally
                    // finalModel remains unchanged
                } else if (lowerModel.includes('gpt') || finalModel.startsWith('o1')) {
                    finalModel = `openai/${finalModel}`;
                } else if (lowerModel.includes('claude')) {
                    finalModel = `anthropic/${finalModel}`;
                } else if (lowerModel.includes('gemini')) {
                    // For other providers' Gemini models, don't prefix for now
                    // May need gemini/ prefix in future if proxy requires it
                    // finalModel = `gemini/${finalModel}`;
                } else {
                    // Default: prefix with openai for unknown model types
                    finalModel = `openai/${finalModel}`;
                }
            }

            const body: Record<string, unknown> = {
                model: finalModel,
                messages: normalizedMessages,
                stream: false
            };

            if (tools && tools.length > 0) {
                body.tools = tools;
                body.tool_choice = 'auto';
            }

            const dispatcher = this.getDispatcher();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${effectiveApiKey || 'dummy'}`
            };

            const requestInit: RequestInit & { dispatcher?: Agent } = {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            };
            if (dispatcher) requestInit.dispatcher = dispatcher;

            // Use HttpService containing Retry Logic, wrapped in Circuit Breaker
            const response = await this.breakers.openai.execute(() =>
                this.httpService.fetch(endpoint, {
                    ...requestInit,
                    retryCount: 2, // HttpService handles retries
                    timeoutMs: 60000
                })
            );

            if (!response.ok) {
                const errorText = await response.text();
                // If 401/403, might want to trigger key rotation here in future
                if (response.status === 401 || response.status === 403) {
                    this.keyRotationService.rotateKey('openai');
                }
                throw new ApiError(errorText || `HTTP ${response.status}`, 'openai', response.status, response.status >= 500 || response.status === 429);
            }

            const json = await response.json() as OpenAIChatCompletion;
            if (json.choices && json.choices.length > 0) {
                const choice = json.choices[0];
                const message = choice.message;
                // Handle images from message content if present
                const contentParts = Array.isArray(message.content) ? message.content : [];
                const rawImages = contentParts.filter((part): part is OpenAIContentPartImage =>
                    typeof part === 'object' && part !== null && 'type' in part && part.type === 'image_url'
                );
                const savedImages: string[] = [];

                if (rawImages.length > 0) {
                    await Promise.all(rawImages.map(async (img: OpenAIContentPartImage) => {
                        const url = img.image_url?.url;
                        if (url) {
                            const localPath = await this.imagePersistence.saveImage(url);
                            savedImages.push(localPath);
                        }
                    }));
                }

                const messageContent = typeof message.content === 'string'
                    ? message.content
                    : contentParts
                        .filter((part): part is { type: 'text'; text: string } =>
                            typeof part === 'object' && part !== null && 'type' in part && part.type === 'text'
                        )
                        .map(part => part.text)
                        .join('');

                return {
                    content: messageContent || '',
                    role: message.role || 'assistant',
                    tool_calls: message.tool_calls || [],
                    completionTokens: json.usage?.completion_tokens,
                    reasoning_content: message.reasoning_content || message.reasoning || '',
                    images: savedImages
                };
            }
            throw new ApiError('No choices returned from model', 'openai', 200, false);
        } catch (error) {
            console.error('[LLMService:OpenAI] Chat Error:', error);
            if (error instanceof ApiError) throw error;
            throw new NetworkError(error instanceof Error ? error.message : String(error), { originalError: error instanceof Error ? error : String(error) });
        }
    }

    async *chatOpenAIStream(messages: Array<Message | ChatMessage>, model: string = 'gpt-4o', tools?: ToolDefinition[], baseUrlOverride?: string, apiKeyOverride?: string, provider?: string): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: ToolCall[]; type?: string }> {
        const effectiveBaseUrl = baseUrlOverride || this.openaiBaseUrl;
        const effectiveApiKey = apiKeyOverride || this.keyRotationService.getCurrentKey('openai') || this.openaiApiKey;
        const endpoint = `${effectiveBaseUrl}/chat/completions`;

        if (!effectiveApiKey && !effectiveBaseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }

        // Rate Limiting
        await this.rateLimitService.waitForToken('openai');

        let finalModel = model;
        if (effectiveBaseUrl.includes(':8317') && !finalModel.includes('/')) {
            // Proxy Routing Logic: Prefix models based on provider and model type
            const lowerModel = finalModel.toLowerCase();
            const lowerProvider = (provider || '').toLowerCase();

            // IMPORTANT: For antigravity provider, ALL models (Gemini, Claude, etc.) 
            // should be sent WITHOUT prefix. The proxy routes internally based on model name.
            if (lowerProvider === 'antigravity') {
                // Don't prefix antigravity models - proxy handles routing internally
                // finalModel remains unchanged
            } else if (lowerModel.includes('gpt') || finalModel.startsWith('o1')) {
                finalModel = `openai/${finalModel}`;
            } else if (lowerModel.includes('claude')) {
                finalModel = `anthropic/${finalModel}`;
            } else if (lowerModel.includes('gemini')) {
                // For other providers' Gemini models, don't prefix for now
                // May need gemini/ prefix in future if proxy requires it
                // finalModel = `gemini/${finalModel}`;
            } else {
                // Default: prefix with openai for unknown model types
                finalModel = `openai/${finalModel}`;
            }
        }

        const normalizedMessages = MessageNormalizer.normalizeOpenAIMessages(messages, finalModel);

        const requestBody: Record<string, unknown> = {
            model: finalModel,
            messages: normalizedMessages,
            stream: true
        };
        if (tools && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = 'auto';
        }

        // Use HttpService for the request
        const response = await this.httpService.fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${effectiveApiKey || 'dummy'}`
            },
            body: JSON.stringify(requestBody),
            retryCount: 2,
            timeoutMs: 60000
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            if (response.status === 401 || response.status === 403) {
                this.keyRotationService.rotateKey('openai');
            }
            // Log detailed error for 429 to help debug quota vs rate limit issues
            if (response.status === 429) {
                console.error(`[LLMService] 429 Error for model ${finalModel}, provider ${provider}`);
                console.error(`[LLMService] Error details:`, errorText);

                // Try to parse error for more details
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.error?.message?.includes('quota')) {
                        console.error(`[LLMService] WARNING: Quota API shows available quota, but API returned quota exhaustion.`);
                        console.error(`[LLMService] This suggests the quota API may be stale or there's a shared quota pool that's exhausted.`);
                        console.error(`[LLMService] The quota check API and request API may use different quota buckets.`);
                    }
                } catch {
                    // Not JSON, ignore
                }

                console.error(`[LLMService] Possible causes:`);
                console.error(`[LLMService] 1. Rate limiting (requests per minute/hour) - separate from quota`);
                console.error(`[LLMService] 2. Shared quota pool exhausted (even if individual model shows 100%)`);
                console.error(`[LLMService] 3. Quota API is stale/cached and not reflecting actual quota`);
                console.error(`[LLMService] 4. Different quota buckets between quota check API and request API`);
            }
            throw new ApiError(errorText || `HTTP ${response.status}`, 'openai-stream', response.status, response.status >= 500 || response.status === 429);
        }

        try {
            for await (const chunk of StreamParser.parseChatStream(response)) {
                const { content, reasoning, images, tool_calls, type } = chunk;
                const savedImages: string[] = [];

                if (images && images.length > 0) {
                    await Promise.all(images.map(async (img) => {
                        const url = (typeof img === 'string') ? img : img.image_url?.url;
                        if (url && typeof url === 'string') {
                            const localPath = await this.imagePersistence.saveImage(url);
                            savedImages.push(localPath);
                        }
                    }));
                }

                yield { content, reasoning, images: savedImages, type, tool_calls };
            }
        } catch (e) {
            console.error('[LLMService] Stream Loop Error:', e);
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

            type OpenCodeContentPart =
                | { type: 'output_text'; text?: string }
                | { type: 'reasoning'; text?: string }
                | { type: 'summary_text'; text?: string }
                | { type: 'function_call'; function_call?: { id?: string; name: string; arguments: string | object } };

            type OpenCodeOutput = { type: 'message'; content: OpenCodeContentPart[]; text?: string };
            type OpenCodeResponse = { output: OpenCodeOutput[] | OpenCodeOutput };

            const json = await response.json() as OpenCodeResponse;
            const outputArray = Array.isArray(json.output) ? json.output : [json.output];
            const output = outputArray.find((o) => o?.type === 'message');

            if (output?.type === 'message') {
                let content = '';
                let reasoning = '';
                const tool_calls: ToolCall[] = [];

                if (Array.isArray(output.content)) {
                    for (const part of output.content) {
                        if (part.type === 'output_text') content += part.text || '';
                        if (part.type === 'reasoning' || part.type === 'summary_text') reasoning += part.text || '';
                        if (part.type === 'function_call' && part.function_call) {
                            tool_calls.push({
                                id: part.function_call.id || `call_${Math.random().toString(36).substring(2, 11)}`,
                                type: 'function',
                                function: {
                                    name: part.function_call.name,
                                    arguments: typeof part.function_call.arguments === 'string'
                                        ? part.function_call.arguments
                                        : JSON.stringify(part.function_call.arguments)
                                }
                            });
                        }
                    }
                }

                return {
                    content: content || (output.text || ''),
                    role: 'assistant',
                    reasoning_content: reasoning || undefined,
                    tool_calls: tool_calls.length > 0 ? tool_calls : undefined
                };
            }
            throw new ApiError('Unexpected response format from OpenCode', 'opencode', 200);
        } else {
            return this.chatOpenAI(messages, model, tools, baseUrl, apiKey, 'opencode');
        }
    }

    async *chatOpenCodeStream(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[]): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: ToolCall[]; type?: string }> {
        const apiKey = 'public';
        const baseUrl = 'https://opencode.ai/zen/v1';

        if (model === 'gpt-5-nano') {
            const endpoint = `${baseUrl}/responses`;
            const normalized = MessageNormalizer.normalizeOpenCodeResponsesMessages(messages);
            const body = { model, input: normalized, stream: true };

            const response = await this.httpService.fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(body),
                retryCount: 2,
                timeoutMs: 60000
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new ApiError(errorText || `HTTP ${response.status}`, 'opencode-stream', response.status);
            }

            try {
                for await (const chunk of StreamParser.parseChatStream(response)) {
                    yield {
                        content: chunk.content,
                        reasoning: chunk.reasoning,
                        type: chunk.type,
                        tool_calls: chunk.tool_calls,
                        images: chunk.images?.map(img => typeof img === 'string' ? img : img.image_url.url)
                    };
                }
            } catch (e) {
                console.error('[LLMService:OpenCode] Stream Loop Error:', e);
                throw e;
            }
        } else {
            yield* this.chatOpenAIStream(messages, model, tools, baseUrl, apiKey, 'opencode');
        }
    }

    async chatAnthropic(messages: Array<Message | ChatMessage>, model: string = 'claude-3-5-sonnet-20240620'): Promise<OpenAIResponse> {
        const key = this.keyRotationService.getCurrentKey('anthropic') || this.anthropicApiKey;
        if (!key) throw new AuthenticationError('Anthropic API Key not set');

        await this.rateLimitService.waitForToken('anthropic');

        try {
            const normalized = MessageNormalizer.normalizeAnthropicMessages(messages);
            const systemMessage = messages.find(m => m.role === 'system')?.content;

            const body: Record<string, unknown> = {
                model,
                messages: normalized,
                max_tokens: 4096
            };
            if (systemMessage && typeof systemMessage === 'string') body.system = systemMessage;

            const response = await this.breakers.anthropic.execute(() =>
                this.httpService.fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': key,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify(body),
                    retryCount: 2
                })
            );

            const data = await response.json() as { content: Array<{ text: string }>; error?: { message: string; type: string } };
            if (data.error) {
                if (response.status === 401) this.keyRotationService.rotateKey('anthropic');
                throw new ApiError(data.error.message, 'anthropic', response.status, false, { type: data.error.type });
            }

            return { content: data.content[0].text || '', role: 'assistant' };
        } catch (error) {
            if (error instanceof ApiError || error instanceof AuthenticationError) throw error;
            throw new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'anthropic' });
        }
    }



    async chatGroq(messages: Array<Message | ChatMessage>, model: string = 'llama3-70b-8192'): Promise<OpenAIResponse> {
        const key = this.keyRotationService.getCurrentKey('groq') || this.groqApiKey;
        if (!key) throw new AuthenticationError('Groq API Key not set');

        await this.rateLimitService.waitForToken('groq');

        try {
            const response = await this.breakers.groq.execute(() =>
                this.httpService.fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({ model, messages }),
                    retryCount: 2
                })
            );

            const data = await response.json() as { choices: Array<{ message: { content: string } }>; error?: { message: string } };
            if (data.error) throw new ApiError(data.error.message, 'groq', response.status, false);

            return { content: data.choices[0].message.content || '', role: 'assistant' };
        } catch (error) {
            if (error instanceof ApiError || error instanceof AuthenticationError) throw error;
            throw new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'groq' });
        }
    }

    async chat(messages: Array<Message | ChatMessage>, model: string, tools?: ToolDefinition[], provider?: string): Promise<OpenAIResponse> {
        const p = provider?.toLowerCase() || '';
        if (p.includes('anthropic') || p.includes('claude')) {
            return this.chatAnthropic(messages, model);

        } else if (p.includes('groq')) {
            return this.chatGroq(messages, model);
        } else if (p.includes('antigravity')) {
            return this.chatOpenAI(messages, model, tools, this.proxyUrl, this.proxyKey, provider);
        } else if (p.includes('ollama')) {
            return this.chatOpenAI(messages, model, tools, 'http://127.0.0.1:11434/v1', 'ollama', provider);
        } else {
            return this.chatOpenAI(messages, model, tools, undefined, undefined, provider);
        }
    }

    async searchHFModels(query: string = '', limit: number = 20, page: number = 0, sort: string = 'downloads'): Promise<{ models: HFModel[], total: number }> {
        // HF Search using axios still, to minimize change, or switch to httpService?
        // Let's switch to httpService.fetch if easy, but axios params are convenient.
        // For minimal breakage, keeping axios or using HttpService if preferred.
        // I'll stick to HttpService for consistency.

        try {
            let searchQuery = query.trim() || 'GGUF';
            if (searchQuery !== 'GGUF' && !searchQuery.toLowerCase().includes('gguf')) searchQuery = `${searchQuery} GGUF`;

            let hfSort = sort;
            if (sort === 'newest') hfSort = 'updated';

            // Construct Query String manually if using fetch
            const params = new URLSearchParams({
                search: searchQuery, filter: 'gguf', limit: limit.toString(), full: 'true', sort: hfSort, direction: '-1', offset: (page * limit).toString()
            });

            const response = await this.httpService.fetch(`https://huggingface.co/api/models?${params.toString()}`, { retryCount: 2 });

            const total = parseInt(response.headers.get('x-total-count') || '0') || 0;
            const data = await response.json() as HuggingFaceApiModel[];

            const models: HFModel[] = data.map((m: HuggingFaceApiModel) => ({
                id: m.modelId,
                name: m.modelId.split('/')[1] || m.modelId,
                author: m.author || 'unknown',
                description: m.cardData?.short_description || `A ${m.pipeline_tag || 'LLM'} model by ${m.author || 'unknown'}`,
                downloads: m.downloads || 0,
                likes: m.likes || 0,
                tags: m.tags || [],
                lastModified: m.lastModified || ''
            }));

            const displayTotal = total > 0 ? total : (searchQuery.toLowerCase() === 'gguf' ? 156607 : models.length);
            return { models, total: displayTotal };
        } catch { return { models: [], total: 0 }; }
    }

    async getEmbeddings(input: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
        const key = this.keyRotationService.getCurrentKey('openai') || this.openaiApiKey;

        if (!key && !this.openaiBaseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }

        const endpoint = `${this.openaiBaseUrl}/embeddings`;
        try {
            const response = await this.httpService.fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key || 'dummy'}`
                },
                body: JSON.stringify({ model, input }),
                retryCount: 3
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new ApiError(errorText, 'openai-embeddings', response.status);
            }

            const json = await response.json() as { data: Array<{ embedding: number[] }> };
            return json.data[0].embedding;
        } catch (error) {
            console.error('[LLMService] Embedding Error:', error);
            if (error instanceof ApiError || error instanceof AuthenticationError) throw error;
            throw new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'openai-bindings' });
        }
    }

    async getOpenAIModels(): Promise<OpenAIModelDefinition[]> {
        try {
            const key = this.keyRotationService.getCurrentKey('openai') || this.openaiApiKey;
            const headers: Record<string, string> = { 'Authorization': `Bearer ${key || 'dummy'}` };
            const response = await this.httpService.fetch(`${this.openaiBaseUrl}/models`, { method: 'GET', headers, retryCount: 1 });
            if (!response.ok) return [];
            const json = await response.json() as { data: OpenAIModelDefinition[] };
            return json.data || [];
        } catch { return []; }
    }
}
