import { Agent } from 'undici';
import { ImagePersistenceService } from '../image-persistence.service';
import { MessageNormalizer } from '../../utils/message-normalizer.util';
import { StreamParser } from '../../utils/stream-parser.util';
import { ApiError, NetworkError, AuthenticationError } from '../../utils/error.util';
import { ChatMessage, ToolCall } from '../../types/llm.types';
import { Message, ToolDefinition } from '../../../shared/types/chat';
import { CircuitBreaker } from '../../core/circuit-breaker';
import { HttpService } from '../http.service';
import { ConfigService } from '../config.service';
import { KeyRotationService } from '../security/key-rotation.service';
import { RateLimitService } from '../security/rate-limit.service';

/**
 * Standardized response format for OpenAI-compatible chat completions.
 */
export interface OpenAIResponse {
    content: string;
    role: string;
    tool_calls?: ToolCall[];
    completionTokens?: number;
    reasoning_content?: string;
    images?: string[];
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
                console.log('[LLMService] Dispatcher destroyed');
            } catch (e) {
                console.error('[LLMService] Error destroying dispatcher:', e);
            }
        }
    }

    // --- Chat Methods ---

    async chatOpenAI(messages: Array<Message | ChatMessage>, model: string = 'gpt-4o', tools?: ToolDefinition[], baseUrlOverride?: string, apiKeyOverride?: string): Promise<OpenAIResponse> {
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
            console.log(`[LLMService:openaiChat] Effective Base URL: ${effectiveBaseUrl}`);

            let finalModel = model;
            if (effectiveBaseUrl.includes(':8317') && !finalModel.includes('/')) {
                // ... (Proxy Routing Logic maintained) ...
                if (finalModel.includes('gpt') || finalModel.startsWith('o1')) {
                    finalModel = `openai/${finalModel}`;
                } else if (finalModel.includes('claude')) {
                    finalModel = `anthropic/${finalModel}`;

                } else {
                    finalModel = `openai/${finalModel}`;
                }
                console.log(`[LLMService] Proxy Routing: Prefixed model ${model} -> ${finalModel}`);
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

            const json = await response.json() as any;
            if (json.choices && json.choices.length > 0) {
                const choice = json.choices[0];
                const rawImages = choice.message.images || [];
                const savedImages: string[] = [];

                if (rawImages.length > 0) {
                    await Promise.all(rawImages.map(async (img: any) => {
                        const url = img.image_url?.url;
                        if (url) {
                            const localPath = await this.imagePersistence.saveImage(url);
                            savedImages.push(localPath);
                        }
                    }));
                }

                return {
                    content: choice.message.content || '',
                    role: choice.message.role || 'assistant',
                    tool_calls: choice.message.tool_calls || [],
                    completionTokens: json.usage?.completion_tokens,
                    reasoning_content: choice.message.reasoning_content || choice.message.reasoning || '',
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

    async *chatOpenAIStream(messages: Array<Message | ChatMessage>, model: string = 'gpt-4o', tools?: ToolDefinition[], baseUrlOverride?: string, apiKeyOverride?: string): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: ToolCall[]; type?: string }> {
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
            // ... (Proxy Logic) ...
            if (finalModel.includes('gpt') || finalModel.startsWith('o1')) {
                finalModel = `openai/${finalModel}`;
            } else if (finalModel.includes('claude')) {
                finalModel = `anthropic/${finalModel}`;

            } else {
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
            return this.chatOpenAI(messages, model, tools, this.proxyUrl, this.proxyKey);
        } else if (p.includes('ollama')) {
            return this.chatOpenAI(messages, model, tools, 'http://127.0.0.1:11434/v1', 'ollama');
        } else {
            return this.chatOpenAI(messages, model, tools);
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
            const data = await response.json() as any[];

            const models = data.map((m: any) => ({
                id: m.modelId,
                name: m.modelId.split('/')[1] || m.modelId,
                author: m.author,
                description: m.cardData?.short_description || `A ${m.pipeline_tag || 'LLM'} model by ${m.author}`,
                downloads: m.downloads || 0,
                likes: m.likes || 0,
                tags: m.tags || [],
                lastModified: m.lastModified
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
