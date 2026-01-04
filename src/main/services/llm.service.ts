import axios from 'axios';


export interface OpenAIResponse {
    content: string;
    role: string;
    tool_calls?: any[];
    completionTokens?: number;
    reasoning_content?: string;
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
    private dispatcher: any = null;

    constructor() { }

    // --- Configuration ---

    setOpenAIApiKey(key: string) { this.openaiApiKey = key; }
    setOpenAIBaseUrl(url: string) { this.openaiBaseUrl = url.replace(/\/$/, ''); }
    setAnthropicApiKey(key: string) { this.anthropicApiKey = key; }
    setGeminiApiKey(key: string) { this.geminiApiKey = key; }
    setGroqApiKey(key: string) { this.groqApiKey = key; }

    private getDispatcher() {
        if (this.dispatcher) return this.dispatcher;
        try {
            const undici = require('undici');
            if (undici?.Agent) {
                this.dispatcher = new undici.Agent({
                    connectTimeout: 30000,
                    headersTimeout: 120000,
                    bodyTimeout: 120000
                });
            }
        } catch (e) { }
        return this.dispatcher;
    }

    // --- Message Normalization ---

    private normalizeOpenAIMessages(messages: any[]): any[] {
        if (!Array.isArray(messages)) return messages;
        return messages.map((message) => {
            if (!message || typeof message !== 'object') return message;
            if (Array.isArray(message.content)) return message;
            const images = Array.isArray(message.images) ? message.images.filter(Boolean) : [];
            if (images.length === 0) return message;
            const parts: any[] = [];
            const text = typeof message.content === 'string' ? message.content : (message.content == null ? '' : String(message.content));
            if (text.trim()) parts.push({ type: 'text', text });
            for (const img of images) {
                const url = typeof img === 'string' && img.startsWith('data:image/') ? img : `data:image/jpeg;base64,${img}`;
                parts.push({ type: 'image_url', image_url: { url } });
            }
            const { images: _ignored, content: _content, ...rest } = message;
            return { ...rest, content: parts };
        });
    }

    // --- Chat Methods ---

    async openaiChat(messages: any[], model: string = 'gpt-4o', tools?: any[], baseUrlOverride?: string, apiKeyOverride?: string): Promise<OpenAIResponse> {
        const effectiveBaseUrl = baseUrlOverride || this.openaiBaseUrl;
        const effectiveApiKey = apiKeyOverride || this.openaiApiKey;
        const endpoint = `${effectiveBaseUrl}/chat/completions`;

        try {
            const normalizedMessages = this.normalizeOpenAIMessages(messages);
            const body: any = {
                model,
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

            const response = await fetch(endpoint, requestInit);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `HTTP ${response.status}`);
            }

            const json = await response.json();
            if (json.choices && json.choices.length > 0) {
                const choice = json.choices[0];
                return {
                    content: choice.message.content || '',
                    role: choice.message.role || 'assistant',
                    tool_calls: choice.message.tool_calls || [],
                    completionTokens: json.usage?.completion_tokens,
                    reasoning_content: choice.message.reasoning_content
                };
            }
            throw new Error('No choices returned from model');
        } catch (error: any) {
            console.error('[LLMService:OpenAI] Chat Error:', error);
            throw error;
        }
    }

    async *openaiStreamChat(messages: any[], model: string = 'gpt-4o', baseUrlOverride?: string, apiKeyOverride?: string): AsyncGenerator<string> {
        const effectiveBaseUrl = baseUrlOverride || this.openaiBaseUrl;
        const effectiveApiKey = apiKeyOverride || this.openaiApiKey;
        const endpoint = `${effectiveBaseUrl}/chat/completions`;
        const normalizedMessages = this.normalizeOpenAIMessages(messages);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${effectiveApiKey || 'dummy'}`
            },
            body: JSON.stringify({ model, messages: normalizedMessages, stream: true })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

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
                    try {
                        const json = JSON.parse(data);
                        const content = json.choices?.[0]?.delta?.content;
                        if (content) yield content;
                    } catch { }
                }
            }
        } finally { reader.releaseLock(); }
    }

    async anthropicChat(messages: any[], model: string = 'claude-3-5-sonnet-20240620'): Promise<OpenAIResponse> {
        if (!this.anthropicApiKey) throw new Error('Anthropic API Key not set');
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.anthropicApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({ model, messages, max_tokens: 4096 })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return {
            content: data.content[0].text || '',
            role: 'assistant'
        };
    }

    async geminiChat(messages: any[], model: string = 'gemini-1.5-pro'): Promise<OpenAIResponse> {
        if (!this.geminiApiKey) throw new Error('Gemini API Key not set');
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return {
            content: data.candidates[0].content.parts[0].text || '',
            role: 'assistant'
        };
    }

    async groqChat(messages: any[], model: string = 'llama3-70b-8192'): Promise<OpenAIResponse> {
        if (!this.groqApiKey) throw new Error('Groq API Key not set');
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.groqApiKey}`
            },
            body: JSON.stringify({ model, messages })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return {
            content: data.choices[0].message.content || '',
            role: 'assistant'
        };
    }

    // --- Search & Misc ---

    async searchHFModels(query: string = '', limit: number = 20, page: number = 0): Promise<HFModel[]> {
        try {
            const searchQuery = query ? `${query} GGUF` : 'GGUF';
            const response = await axios.get('https://huggingface.co/api/models', {
                params: { search: searchQuery, limit, full: true, sort: 'downloads', direction: -1, offset: page * limit }
            });
            return response.data.map((m: any) => ({
                id: m.modelId,
                name: m.modelId.split('/')[1] || m.modelId,
                author: m.author,
                description: m.cardData?.short_description || `A model by ${m.author}`,
                downloads: m.downloads || 0,
                likes: m.likes || 0,
                tags: m.tags || [],
                lastModified: m.lastModified
            }));
        } catch { return []; }
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
