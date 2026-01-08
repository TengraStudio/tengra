import axios from 'axios';
import { ImagePersistenceService } from '../image-persistence.service';
import { DataService } from '../data/data.service';
import { withRetry, getErrorMessage } from '../../utils/retry.util';
import { MessageNormalizer } from '../../utils/message-normalizer.util';
import { StreamParser } from '../../utils/stream-parser.util';
import { ApiError, NetworkError, AuthenticationError } from '../../utils/error.util';
import { ChatMessage } from '../../types/llm.types';


/**
 * Standardized response format for OpenAI-compatible chat completions.
 * 
 * @interface OpenAIResponse
 * @property {string} content - The text content of the response
 * @property {string} role - The role of the responder (usually 'assistant')
 * @property {any[]} [tool_calls] - Array of tool calls if the model invoked tools
 * @property {number} [completionTokens] - Usage statistics for output tokens
 * @property {string} [reasoning_content] - Chain of thought content (for reasoning models)
 * @property {string[]} [images] - Paths to locally saved images generated or processed
 */
export interface OpenAIResponse {
    content: string;
    role: string;
    tool_calls?: any[];
    completionTokens?: number;
    reasoning_content?: string;
    images?: string[];
}

/**
 * HuggingFace model metadata structure.
 * 
 * @interface HFModel
 * @property {string} id - Unique model identifier (e.g., 'author/model-name')
 * @property {string} name - Display name of the model
 * @property {string} description - Brief description or abstract
 * @property {string} author - Model creator or organization
 * @property {number} downloads - Total download count
 * @property {number} likes - Number of likes/stars
 * @property {string[]} tags - Categorization tags (e.g., 'text-generation', 'gguf')
 * @property {string} lastModified - ISO timestamp of last update
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
 * 
 * Unified interface for OpenAI, Anthropic, Gemini, Groq, and HuggingFace.
 * Handles authentication, message normalization, error retry, and image persistence.
 * 
 * @example
 * ```typescript
 * const llm = new LLMService(dataService);
 * llm.setOpenAIApiKey('sk-...');
 * const response = await llm.chat(messages, 'gpt-4o');
 * ```
 */
export class LLMService {
    private openaiApiKey: string = '';
    private openaiBaseUrl: string = 'https://api.openai.com/v1';
    private anthropicApiKey: string = '';
    private geminiApiKey: string = '';
    private groqApiKey: string = '';
    private proxyUrl: string = 'http://localhost:8317/v1';
    private proxyKey: string = 'connected';
    private dispatcher: any = null;
    private imagePersistence: ImagePersistenceService;

    constructor(dataService?: DataService) {
        this.imagePersistence = new ImagePersistenceService(dataService);
    }

    // --- Configuration ---

    setOpenAIApiKey(key: string) { this.openaiApiKey = key; }
    setOpenAIBaseUrl(url: string) { this.openaiBaseUrl = url.replace(/\/$/, ''); }
    setAnthropicApiKey(key: string) { this.anthropicApiKey = key; }
    setGeminiApiKey(key: string) { this.geminiApiKey = key; }
    setGroqApiKey(key: string) { this.groqApiKey = key; }
    setProxySettings(url: string, key: string) {
        this.proxyUrl = url.replace(/\/$/, '');
        this.proxyKey = key;
    }

    isOpenAIConnected(): boolean {
        return !!this.openaiApiKey
    }

    /**
     * Lazily initializes and returns the undici Dispatcher.
     * 
     * Configures connection pooling and timeouts for robust HTTP requests.
     * 
     * @returns The configured undici Dispatcher or null if initialization fails
     * @private
     */
    private getDispatcher() {
        if (this.dispatcher) return this.dispatcher;
        try {
            const undici = require('undici');
            if (undici?.Agent) {
                this.dispatcher = new undici.Agent({
                    connectTimeout: 30000,
                    headersTimeout: 120000,
                    bodyTimeout: 120000,
                    keepAliveMaxTimeout: 60000, // Close idle connections after 60s
                    keepAliveTimeout: 30000,
                    connections: 10 // Limit concurrent connections
                });
            }
        } catch (e) { }
        return this.dispatcher;
    }

    /**
     * Cleans up resources and closes open connections.
     * Should be called during application shutdown to prevent hangs.
     */
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

    // --- Message Normalization ---
    // (Delegated to MessageNormalizer utility)

    // --- Chat Methods ---

    /**
     * Executes a standard chat completion request using the OpenAI protocol.
     * 
     * Handles:
     * - Automatic retry on failures
     * - Proxy routing for custom providers (Antigravity)
     * - Image persistence for generated images
     * - Tool calling
     * 
     * @param messages - Normalized message history
     * @param model - Target model identifier
     * @param tools - Optional list of tools definitions
     * @param baseUrlOverride - Optional custom API endpoint
     * @param apiKeyOverride - Optional custom API key
     * @returns Promise resolving to standardized OpenAIResponse
     */
    async chatOpenAI(messages: ChatMessage[], model: string = 'gpt-4o', tools?: any[], baseUrlOverride?: string, apiKeyOverride?: string): Promise<OpenAIResponse> {
        const effectiveBaseUrl = baseUrlOverride || this.openaiBaseUrl;
        const effectiveApiKey = apiKeyOverride || this.openaiApiKey;

        // Allow missing key for local/proxy URLs, otherwise require it
        if (!effectiveApiKey && !effectiveBaseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }

        const endpoint = `${effectiveBaseUrl}/chat/completions`;

        try {
            const normalizedMessages = MessageNormalizer.normalizeOpenAIMessages(messages, model);
            console.log(`[LLMService:openaiChat] Effective Base URL: ${effectiveBaseUrl}`);
            console.log(`[LLMService:openaiChat] Endpoint: ${endpoint}`);

            let finalModel = model;
            // If hitting Cliproxy (8317), ensure we have a provider prefix
            if (effectiveBaseUrl.includes(':8317') && !finalModel.includes('/')) {
                // Determine best prefix
                if (finalModel.includes('gpt') || finalModel.startsWith('o1')) {
                    finalModel = `openai/${finalModel}`;
                } else if (finalModel.includes('claude')) {
                    finalModel = `anthropic/${finalModel}`;
                } else if (finalModel.includes('gemini')) {
                    finalModel = `google/${finalModel}`;
                } else {
                    finalModel = `openai/${finalModel}`; // fallback
                }
                console.log(`[LLMService] Proxy Routing: Prefixed model ${model} -> ${finalModel}`);
            }

            const body: any = {
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

            const requestInit: any = {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            };
            if (dispatcher) requestInit.dispatcher = dispatcher;

            const response = await withRetry(
                () => fetch(endpoint, requestInit),
                {
                    maxRetries: 2,
                    onRetry: (err, attempt, delay) => {
                        console.log(`[LLMService] Retrying OpenAI request (attempt ${attempt + 1}) after ${delay}ms: ${getErrorMessage(err)}`);
                    }
                }
            );
            if (!response.ok) {
                const errorText = await response.text();
                throw new ApiError(
                    errorText || `HTTP ${response.status}`,
                    'openai',
                    response.status,
                    response.status >= 500 || response.status === 429
                );
            }

            const json = await response.json();
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
        } catch (error: any) {
            console.error('[LLMService:OpenAI] Chat Error:', error);
            if (error instanceof ApiError) throw error;
            throw new NetworkError(error.message, { originalError: error });
        }
    }

    /**
     * Executes a streaming chat completion request.
     * 
     * Supports both Web Streams (browser/native) and Node.js streams.
     * Parses Server-Sent Events (SSE) and yields structured chunks.
     * 
     * @param messages - Message history
     * @param model - Target model
     * @param tools - Tools definitions
     * @returns AsyncGenerator yielding combined content/tool deltas
     */
    async *chatOpenAIStream(messages: ChatMessage[], model: string = 'gpt-4o', tools?: any[], baseUrlOverride?: string, apiKeyOverride?: string): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: any[] }> {
        const effectiveBaseUrl = baseUrlOverride || this.openaiBaseUrl;
        const effectiveApiKey = apiKeyOverride || this.openaiApiKey;
        const endpoint = `${effectiveBaseUrl}/chat/completions`;

        // Allow missing key for local/proxy URLs, otherwise require it
        if (!effectiveApiKey && !effectiveBaseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }

        let finalModel = model;
        if (effectiveBaseUrl.includes(':8317') && !finalModel.includes('/')) {
            if (finalModel.includes('gpt') || finalModel.startsWith('o1')) {
                finalModel = `openai/${finalModel}`;
            } else if (finalModel.includes('claude')) {
                finalModel = `anthropic/${finalModel}`;
            } else if (finalModel.includes('gemini')) {
                finalModel = `google/${finalModel}`;
            } else {
                finalModel = `openai/${finalModel}`;
            }
        }

        const normalizedMessages = MessageNormalizer.normalizeOpenAIMessages(messages, finalModel);

        const requestBody: any = { model: finalModel, messages: normalizedMessages, stream: true };
        if (tools && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = 'auto';
        }
        console.log('[LLMService] Stream request to:', endpoint);
        console.log('[LLMService] Request body:', JSON.stringify(requestBody, null, 2));

        const response = await withRetry(
            () => fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${effectiveApiKey || 'dummy'}`
                },
                body: JSON.stringify(requestBody)
            }),
            {
                maxRetries: 2,
                onRetry: (err, attempt, delay) => {
                    console.log(`[LLMService] Retrying stream request (attempt ${attempt + 1}) after ${delay}ms: ${getErrorMessage(err)}`);
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            console.error('[LLMService] Stream Error:', response.status, errorText)
            throw new ApiError(
                errorText || `HTTP ${response.status}`,
                'openai-stream',
                response.status,
                response.status >= 500 || response.status === 429
            );
        }

        try {
            for await (const chunk of StreamParser.parseChatStream(response)) {
                const { content, reasoning, images, tool_calls, type } = chunk;
                let savedImages: string[] = [];

                if (images && images.length > 0) {
                    // Save images concurrently
                    await Promise.all(images.map(async (img: any) => {
                        const url = img.image_url?.url || img; // Handle object or string
                        if (url && typeof url === 'string') {
                            const localPath = await this.imagePersistence.saveImage(url);
                            savedImages.push(localPath);
                        }
                    }));
                }

                yield {
                    content,
                    reasoning,
                    images: savedImages,
                    type,
                    tool_calls
                } as any;
            }
        } catch (e: any) {
            console.error('[LLMService] Stream Loop Error:', e);
            throw e;
        }
    }

    /**
     * Direct integration with Anthropic's Messages API.
     * 
     * @param messages - Message history
     * @param model - Claude model identifier
     * @returns Standardized OpenAIResponse
     * @throws Error if API key is missing or request fails
     */
    async chatAnthropic(messages: ChatMessage[], model: string = 'claude-3-5-sonnet-20240620'): Promise<OpenAIResponse> {
        if (!this.anthropicApiKey) throw new AuthenticationError('Anthropic API Key not set');

        try {
            const normalized = MessageNormalizer.normalizeAnthropicMessages(messages);
            const systemMessage = messages.find(m => m.role === 'system')?.content;

            const body: any = {
                model,
                messages: normalized,
                max_tokens: 4096
            };
            if (systemMessage) body.system = systemMessage;

            const response = await withRetry(
                () => fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.anthropicApiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify(body)
                }),
                {
                    maxRetries: 2,
                    onRetry: (err, attempt, delay) => {
                        console.log(`[LLMService] Retrying Anthropic request (attempt ${attempt + 1}) after ${delay}ms: ${getErrorMessage(err)}`);
                    }
                }
            );

            const data = await response.json();
            if (data.error) {
                throw new ApiError(data.error.message, 'anthropic', response.status, false, { type: data.error.type });
            }

            return {
                content: data.content[0].text || '',
                role: 'assistant'
            };
        } catch (error: any) {
            if (error instanceof ApiError || error instanceof AuthenticationError) throw error;
            throw new NetworkError(error.message, { provider: 'anthropic' });
        }
    }

    /**
     * Direct integration with Google's Gemini API.
     * 
     * @param messages - Message history
     * @param model - Gemini model identifier
     * @returns Standardized OpenAIResponse
     */
    async chatGemini(messages: ChatMessage[], model: string = 'gemini-1.5-pro'): Promise<OpenAIResponse> {
        if (!this.geminiApiKey) throw new AuthenticationError('Gemini API Key not set');

        try {
            const contents = MessageNormalizer.normalizeGeminiMessages(messages);
            const response = await withRetry(
                () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents })
                }),
                {
                    maxRetries: 2,
                    onRetry: (err, attempt, delay) => {
                        console.log(`[LLMService] Retrying Gemini request (attempt ${attempt + 1}) after ${delay}ms: ${getErrorMessage(err)}`);
                    }
                }
            );

            const data = await response.json();
            if (data.error) {
                throw new ApiError(data.error.message, 'gemini', response.status, true, { code: data.error.code });
            }

            return {
                content: data.candidates[0].content.parts[0].text || '',
                role: 'assistant'
            };
        } catch (error: any) {
            if (error instanceof ApiError || error instanceof AuthenticationError) throw error;
            throw new NetworkError(error.message, { provider: 'gemini' });
        }
    }

    /**
     * Direct integration with Groq's high-speed inference API.
     * 
     * @param messages - Message history
     * @param model - Llama/Mixtral model identifier
     * @returns Standardized OpenAIResponse
     */
    async chatGroq(messages: ChatMessage[], model: string = 'llama3-70b-8192'): Promise<OpenAIResponse> {
        if (!this.groqApiKey) throw new AuthenticationError('Groq API Key not set');

        try {
            const response = await withRetry(
                () => fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.groqApiKey}`
                    },
                    body: JSON.stringify({ model, messages })
                }),
                {
                    maxRetries: 2,
                    onRetry: (err, attempt, delay) => {
                        console.log(`[LLMService] Retrying Groq request (attempt ${attempt + 1}) after ${delay}ms: ${getErrorMessage(err)}`);
                    }
                }
            );

            const data = await response.json();
            if (data.error) throw new ApiError(data.error.message, 'groq', response.status, false);

            return {
                content: data.choices[0].message.content || '',
                role: 'assistant'
            };
        } catch (error: any) {
            if (error instanceof ApiError || error instanceof AuthenticationError) throw error;
            throw new NetworkError(error.message, { provider: 'groq' });
        }
    }

    /**
     * Universal chat method that routes to the appropriate provider.
     * 
     * Routes based on:
     * 1. Explicit provider argument
     * 2. Model name heuristics (e.g. 'claude' -> Anthropic)
     * 3. Configured proxy settings
     * 
     * @param messages - Message history
     * @param model - Model identifier
     * @param tools - Optional tools
     * @param provider - Optional provider hint
     * @returns Standardized response from selected provider
     */
    async chat(messages: ChatMessage[], model: string, tools?: any[], provider?: string): Promise<OpenAIResponse> {
        const p = provider?.toLowerCase() || '';
        if (p.includes('anthropic') || p.includes('claude')) {
            return this.chatAnthropic(messages, model);
        } else if (p.includes('gemini') || p.includes('google')) {
            return this.chatGemini(messages, model);
        } else if (p.includes('groq')) {
            return this.chatGroq(messages, model);
        } else if (p.includes('antigravity')) {
            return this.chatOpenAI(messages, model, tools, this.proxyUrl, this.proxyKey);
        } else if (p.includes('ollama')) {
            // Route to local Ollama server
            const ollamaUrl = 'http://127.0.0.1:11434/v1';
            return this.chatOpenAI(messages, model, tools, ollamaUrl, 'ollama');
        } else {
            return this.chatOpenAI(messages, model, tools);
        }
    }

    // --- Search & Misc ---

    /**
     * Searches HuggingFace for compatible models (GGUF format preferred).
     * 
     * @param query - Search term
     * @param limit - Max results (default 20)
     * @param page - Pagination offset
     * @param sort - Sort criteria (downloads, likes, etc.)
     * @returns List of models and total count
     */
    async searchHFModels(query: string = '', limit: number = 20, page: number = 0, sort: string = 'downloads'): Promise<{ models: HFModel[], total: number }> {
        try {
            let searchQuery = query.trim();
            // If query is empty, default to GGUF to show compatible models
            // If query is not empty, check if user already specified GGUF, if not append it for compatibility
            if (!searchQuery) {
                searchQuery = 'GGUF';
            } else if (!searchQuery.toLowerCase().includes('gguf')) {
                searchQuery = `${searchQuery} GGUF`;
            }

            let hfSort = sort;
            if (sort === 'newest') hfSort = 'updated';
            if (sort === 'name') hfSort = 'name'; // HF might not support 'name' well, but worth a try or fallback to trending

            const response = await axios.get('https://huggingface.co/api/models', {
                params: {
                    search: searchQuery,
                    filter: 'gguf',
                    limit,
                    full: true,
                    sort: hfSort,
                    direction: -1,
                    offset: page * limit
                }
            });

            const total = parseInt(response.headers['x-total-count'] || '0') || 0;
            const models = response.data.map((m: any) => ({
                id: m.modelId,
                name: m.modelId.split('/')[1] || m.modelId,
                author: m.author,
                description: m.cardData?.short_description || `A ${m.pipeline_tag || 'LLM'} model by ${m.author}`,
                downloads: m.downloads || 0,
                likes: m.likes || 0,
                tags: m.tags || [],
                lastModified: m.lastModified
            }));

            // Log both the batch size and the (missing) total count for clarity
            console.log(`[LLMService] HuggingFace Search: Fetched ${models.length} models. (Total Header: ${total}, Query: "${searchQuery}")`);

            // Fallback for total count if header is missing (156k is current GGUF library size)
            const displayTotal = total > 0 ? total : (searchQuery.toLowerCase() === 'gguf' ? 156607 : models.length);

            return { models, total: displayTotal };
        } catch { return { models: [], total: 0 }; }
    }

    /**
     * Fetches available models from the configured OpenAI-compatible endpoint.
     * 
     * @returns Array of model definition objects
     */
    /**
     * Generates embeddings for the given input using OpenAI-compatible API.
     * 
     * @param input - Text to embed
     * @param model - Embedding model (default: text-embedding-3-small)
     * @returns Array of numbers representing the embedding
     */
    async getEmbeddings(input: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
        const effectiveApiKey = this.openaiApiKey;
        // Allow missing key if using local proxy
        if (!effectiveApiKey && !this.openaiBaseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }

        const endpoint = `${this.openaiBaseUrl}/embeddings`;
        try {
            const response = await withRetry(
                () => fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${effectiveApiKey || 'dummy'}`
                    },
                    body: JSON.stringify({ model, input })
                }),
                { maxRetries: 2 }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new ApiError(errorText, 'openai-embeddings', response.status);
            }

            const json = await response.json();
            return json.data[0].embedding;
        } catch (error: any) {
            console.error('[LLMService] Embedding Error:', error);
            if (error instanceof ApiError || error instanceof AuthenticationError) throw error;
            throw new NetworkError(error.message, { provider: 'openai-bindings' });
        }
    }

    async getOpenAIModels(): Promise<any[]> {
        try {
            const headers: Record<string, string> = { 'Authorization': `Bearer ${this.openaiApiKey || 'dummy'}` };
            const response = await fetch(`${this.openaiBaseUrl}/models`, { method: 'GET', headers });
            if (!response.ok) return [];
            const json = await response.json();
            return json.data || [];
        } catch { return []; }
    }
}
