import axios from 'axios';
import { ImagePersistenceService } from './image-persistence.service';
import { DataService } from './data.service';
import { withRetry, getErrorMessage } from '../utils/retry.util';


export interface OpenAIResponse {
    content: string;
    role: string;
    tool_calls?: any[];
    completionTokens?: number;
    reasoning_content?: string;
    images?: string[];
}

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
 * Unified LLM Service handling multiple providers.
 * Merges OpenAI, Anthropic, Gemini, Groq, and HuggingFace logic.
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

    // Cleanup method - call on app shutdown
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

    private normalizeOpenAIMessages(messages: any[], model?: string): any[] {
        if (!Array.isArray(messages)) return messages;

        // Gemini 3 Thinking models (high/low) usually don't support multimodal input in history
        // or the specific endpoint they use rejects it.
        const shouldStripImages = model && (
            model.includes('gemini-3-pro-high') ||
            model.includes('gemini-3-pro-low')
        );

        return messages.map((message) => {
            if (!message || typeof message !== 'object') return message;
            if (Array.isArray(message.content)) {
                // If we need to strip images from existing structured content
                if (shouldStripImages) {
                    const textParts = message.content.filter((p: any) => p.type === 'text');
                    if (textParts.length > 0) {
                        // Return just text content or array of text parts
                        return { ...message, content: textParts };
                    }
                    // If only images, return empty content or skip?
                    // Better to keep role but empty text to avoid breaking structure
                    return { ...message, content: '' };
                }
                return message;
            }

            const images = Array.isArray(message.images) ? message.images.filter(Boolean) : [];

            // If stripping images, just return text content
            if (shouldStripImages || images.length === 0) {
                // Ensure we don't accidentally send a mixed content structure if we're stripping images
                // just return the flat text content
                return {
                    ...message,
                    content: message.content,
                    images: undefined // Explicitly remove images property
                };
            }

            const parts: any[] = [];
            const text = typeof message.content === 'string' ? message.content : (message.content == null ? '' : String(message.content));
            if (text.trim()) parts.push({ type: 'text', text });
            for (const img of images) {
                const url = typeof img === 'string' && img.startsWith('data:image/') ? img : `data:image/jpeg;base64,${img}`;
                parts.push({ type: 'image_url', image_url: { url } });
            }
            const { images: _ignored, content: _content, ...rest } = message;
            return { ...rest, content: parts };
        }).filter(msg => {
            if (!msg) return false;
            // Keep if tool_calls exist and are not empty
            if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) return true;
            // Keep if content is non-empty string
            if (typeof msg.content === 'string' && msg.content.trim() !== '') return true;
            // Keep if content is non-empty array
            if (Array.isArray(msg.content) && msg.content.length > 0) return true;

            return false;
        });
    }

    private normalizeAnthropicMessages(messages: any[]): any[] {
        if (!Array.isArray(messages)) return messages;
        // Anthropic doesn't support 'system' role in messages array (it's a top-level param)
        // We assume system messages are filtered or handled by the caller if needed.
        return messages.filter(m => m.role !== 'system').map((message) => {
            if (!message || typeof message !== 'object') return message;
            const images = Array.isArray(message.images) ? message.images.filter(Boolean) : [];
            if (images.length === 0) return { role: message.role, content: message.content };

            const content: any[] = [];
            if (message.content) content.push({ type: 'text', text: message.content });
            for (const img of images) {
                const base64 = typeof img === 'string' && img.includes(',') ? img.split(',')[1] : img;
                const mediaType = typeof img === 'string' && img.includes('image/png') ? 'image/png' : 'image/jpeg';
                content.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: mediaType,
                        data: base64
                    }
                });
            }
            return { role: message.role, content };
        });
    }

    private normalizeGeminiMessages(messages: any[]): any[] {
        if (!Array.isArray(messages)) return messages;
        return messages.map((message) => {
            if (!message || typeof message !== 'object') return message;
            const role = message.role === 'assistant' ? 'model' : 'user';
            const images = Array.isArray(message.images) ? message.images.filter(Boolean) : [];

            const parts: any[] = [];
            if (message.content) parts.push({ text: message.content });
            for (const img of images) {
                const base64 = typeof img === 'string' && img.includes(',') ? img.split(',')[1] : img;
                const mimeType = typeof img === 'string' && img.includes('image/png') ? 'image/png' : 'image/jpeg';
                parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64
                    }
                });
            }
            return { role, parts };
        });
    }

    // --- Chat Methods ---

    async openaiChat(messages: any[], model: string = 'gpt-4o', tools?: any[], baseUrlOverride?: string, apiKeyOverride?: string): Promise<OpenAIResponse> {
        const effectiveBaseUrl = baseUrlOverride || this.openaiBaseUrl;
        const effectiveApiKey = apiKeyOverride || this.openaiApiKey;
        const endpoint = `${effectiveBaseUrl}/chat/completions`;

        try {
            const normalizedMessages = this.normalizeOpenAIMessages(messages, model);
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
                throw new Error(errorText || `HTTP ${response.status}`);
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
            throw new Error('No choices returned from model');
        } catch (error: any) {
            console.error('[LLMService:OpenAI] Chat Error:', error);
            throw error;
        }
    }

    async *openaiStreamChat(messages: any[], model: string = 'gpt-4o', tools?: any[], baseUrlOverride?: string, apiKeyOverride?: string): AsyncGenerator<{ content?: string; reasoning?: string; images?: string[]; tool_calls?: any[] }> {
        const effectiveBaseUrl = baseUrlOverride || this.openaiBaseUrl;
        const effectiveApiKey = apiKeyOverride || this.openaiApiKey;
        const endpoint = `${effectiveBaseUrl}/chat/completions`;

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

        const normalizedMessages = this.normalizeOpenAIMessages(messages, finalModel);

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
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
        if (!response.body) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            // Robust Stream Handling
            const body: any = response.body;

            if (typeof body.getReader === 'function') {
                // Web Standard ReadableStream
                console.log('[LLMService] Using Web Stream Reader');
                const reader = body.getReader();

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || !trimmed.startsWith('data:')) continue;
                            const data = trimmed.slice(5).trim();

                            if (data === '[DONE]') continue;

                            // Handle nested data: prefix issue
                            let jsonData = data;
                            while (jsonData.startsWith('data:')) {
                                jsonData = jsonData.slice(5).trim();
                            }

                            if (jsonData === '[DONE]') continue;

                            try {
                                const json = JSON.parse(jsonData);
                                const delta = json.choices?.[0]?.delta;
                                if (!delta) continue;

                                const content = delta.content || '';
                                const reasoning = delta.reasoning_content || delta.reasoning || '';
                                const images = delta.images || [];

                                if (content || reasoning || images.length > 0 || delta.tool_calls) {
                                    const savedImages: string[] = [];
                                    if (images.length > 0) {
                                        // Save images concurrently
                                        await Promise.all(images.map(async (img: any) => {
                                            const url = img.image_url?.url;
                                            if (url) {
                                                const localPath = await this.imagePersistence.saveImage(url);
                                                savedImages.push(localPath);
                                            }
                                        }));
                                    }

                                    yield {
                                        content,
                                        reasoning,
                                        images: savedImages.filter(img => typeof img === 'string'),
                                        type: delta.tool_calls ? 'tool_calls' : undefined,
                                        tool_calls: delta.tool_calls
                                    } as any;
                                }
                            } catch { }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }

            } else {
                // Node.js Readable Stream (Async Iterable)
                console.log('[LLMService] Using Node Stream Iterator');
                for await (const value of body) {
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data:')) continue;
                        const data = trimmed.slice(5).trim();
                        if (data === '[DONE]') continue;
                        try {
                            const json = JSON.parse(data);
                            const delta = json.choices?.[0]?.delta;
                            if (!delta) continue;

                            const content = delta.content || '';
                            const reasoning = delta.reasoning_content || delta.reasoning || '';
                            const images = delta.images || [];

                            if (content || reasoning || images.length > 0 || delta.tool_calls) {
                                const savedImages: string[] = [];
                                if (images.length > 0) {
                                    // Save images concurrently
                                    await Promise.all(images.map(async (img: any) => {
                                        const url = img.image_url?.url;
                                        if (url) {
                                            const localPath = await this.imagePersistence.saveImage(url);
                                            savedImages.push(localPath);
                                        }
                                    }));
                                }

                                yield {
                                    content,
                                    reasoning,
                                    images: savedImages.filter(img => typeof img === 'string'),
                                    type: delta.tool_calls ? 'tool_calls' : undefined,
                                    tool_calls: delta.tool_calls
                                } as any;
                            }
                        } catch { }
                    }
                }
            }
        } catch (e: any) {
            console.error('[LLMService] Stream Loop Error:', e);
            throw e;
        }
    }

    async anthropicChat(messages: any[], model: string = 'claude-3-5-sonnet-20240620'): Promise<OpenAIResponse> {
        if (!this.anthropicApiKey) throw new Error('Anthropic API Key not set');
        const normalized = this.normalizeAnthropicMessages(messages);
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
        if (data.error) throw new Error(data.error.message);
        return {
            content: data.content[0].text || '',
            role: 'assistant'
        };
    }

    async geminiChat(messages: any[], model: string = 'gemini-1.5-pro'): Promise<OpenAIResponse> {
        if (!this.geminiApiKey) throw new Error('Gemini API Key not set');
        const contents = this.normalizeGeminiMessages(messages);
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
        if (data.error) throw new Error(data.error.message);
        return {
            content: data.candidates[0].content.parts[0].text || '',
            role: 'assistant'
        };
    }

    async groqChat(messages: any[], model: string = 'llama3-70b-8192'): Promise<OpenAIResponse> {
        if (!this.groqApiKey) throw new Error('Groq API Key not set');
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
        if (data.error) throw new Error(data.error.message);
        return {
            content: data.choices[0].message.content || '',
            role: 'assistant'
        };
    }

    async chat(messages: any[], model: string, tools?: any[], provider?: string): Promise<OpenAIResponse> {
        const p = provider?.toLowerCase() || '';
        if (p.includes('anthropic') || p.includes('claude')) {
            return this.anthropicChat(messages, model);
        } else if (p.includes('gemini') || p.includes('google')) {
            return this.geminiChat(messages, model);
        } else if (p.includes('groq')) {
            return this.groqChat(messages, model);
        } else if (p.includes('antigravity')) {
            return this.openaiChat(messages, model, tools, this.proxyUrl, this.proxyKey);
        } else if (p.includes('ollama')) {
            // Route to local Ollama server
            const ollamaUrl = 'http://127.0.0.1:11434/v1';
            return this.openaiChat(messages, model, tools, ollamaUrl, 'ollama');
        } else {
            return this.openaiChat(messages, model, tools);
        }
    }

    // --- Search & Misc ---

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
