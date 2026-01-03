
export interface OpenAIResponse {
    content: string;
    role: string;
    tool_calls?: any[];
    completionTokens?: number;
    reasoning_content?: string;
}

export class OpenAIService {
    private apiKey: string = '';
    private baseUrl: string = 'https://api.openai.com/v1';
    private dispatcher: any = null;

    constructor() { }

    setApiKey(key: string) {
        this.apiKey = key;
    }

    setBaseUrl(url: string) {
        // Remove trailing slash if present
        this.baseUrl = url.replace(/\/$/, '');
    }

    private getDispatcher() {
        if (this.dispatcher) return this.dispatcher;
        try {
            // Lazy load undici Agent so we can tune timeouts.
            const undici = require('undici');
            if (undici?.Agent) {
                this.dispatcher = new undici.Agent({
                    connectTimeout: 30000,
                    headersTimeout: 120000,
                    bodyTimeout: 120000
                });
            }
        } catch (e) {
            // Ignore if undici is unavailable; fallback to default fetch.
        }
        return this.dispatcher;
    }

    private normalizeMessages(messages: any[]): any[] {
        if (!Array.isArray(messages)) return messages;
        return messages.map((message) => {
            if (!message || typeof message !== 'object') return message;
            if (Array.isArray(message.content)) return message;
            const images = Array.isArray(message.images) ? message.images.filter(Boolean) : [];
            if (images.length === 0) return message;
            const parts: any[] = [];
            const text = typeof message.content === 'string' ? message.content : (message.content == null ? '' : String(message.content));
            if (text.trim()) {
                parts.push({ type: 'text', text });
            }
            for (const img of images) {
                const url = typeof img === 'string' && img.startsWith('data:image/')
                    ? img
                    : `data:image/jpeg;base64,${img}`;
                parts.push({ type: 'image_url', image_url: { url } });
            }
            const { images: _ignored, content: _content, ...rest } = message;
            return { ...rest, content: parts };
        });
    }

    async chat(messages: any[], model: string = 'gpt-3.5-turbo', tools?: any[], baseUrlOverride?: string): Promise<OpenAIResponse> {
        // Allow empty API key if using local proxy (some proxies don't require it, or use dummy)
        const effectiveBaseUrl = baseUrlOverride || this.baseUrl
        if (!this.apiKey && effectiveBaseUrl.includes('api.openai.com')) {
            throw new Error('OpenAI API Key is not set.');
        }

        const useProxy = effectiveBaseUrl.includes('8317')
        const endpoint = `${effectiveBaseUrl}/chat/completions`
        console.log(`[OpenAIService] Fetching: ${endpoint}`)

        try {
            const normalizedMessages = this.normalizeMessages(messages)
            const body: any = { model, messages: normalizedMessages }
            if (tools && tools.length > 0) {
                body.tools = tools
                body.tool_choice = 'auto'
            }
            if (useProxy) {
                console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                console.log(`[OpenAIService] Proxy Request Payload:`, JSON.stringify(body, null, 2))
                console.log(`[OpenAIService] Proxy Request Headers:`, {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey ? (this.apiKey.substring(0, 5) + '...') : 'dummy'}`
                })
                console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
            }
            const dispatcher = this.getDispatcher();
            const requestInit: any = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey || 'dummy'}`
                },
                body: JSON.stringify(body)
            };
            if (dispatcher) requestInit.dispatcher = dispatcher;
            let response;
            try {
                response = await fetch(endpoint, requestInit);
            } catch (error: any) {
                if (error?.cause?.code === 'UND_ERR_HEADERS_TIMEOUT' || error?.code === 'UND_ERR_HEADERS_TIMEOUT') {
                    console.warn('[OpenAIService] Headers timeout, retrying once...');
                    response = await fetch(endpoint, requestInit);
                } else {
                    throw error;
                }
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[OpenAIService] API Error Status:', response.status, errorText);
                try {
                    const json = JSON.parse(errorText);
                    throw new Error(json.error?.message || `HTTP ${response.status}: ${errorText}`);
                } catch (e) {
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
            }

            const json = await response.json();
            console.log('[OpenAIService] Response choices:', JSON.stringify(json.choices || []).substring(0, 200) + '...')

            if (json.choices && json.choices.length > 0) {
                const choice = json.choices[0] || {}
                const message = choice.message || {}
                const finishReason = choice.finish_reason ?? 'unknown'
                const nativeFinishReason = choice.native_finish_reason ?? 'unknown'
                const contentLen = typeof message.content === 'string' ? message.content.length : 0
                const reasoningLen = typeof message.reasoning_content === 'string' ? message.reasoning_content.length : 0
                const toolCallsCount = Array.isArray(message.tool_calls) ? message.tool_calls.length : 0
                console.log(`[OpenAIService] Finish reason: ${finishReason} (native: ${nativeFinishReason}) contentLen=${contentLen} reasoningLen=${reasoningLen} toolCalls=${toolCallsCount}`)
                const reasoning = message.reasoning_content || message.reasoning || ''
                return {
                    content: message.content || '',
                    role: message.role || 'assistant',
                    reasoning_content: reasoning || undefined,
                    tool_calls: message.tool_calls || [],
                    completionTokens: typeof json.usage?.completion_tokens === 'number' ? json.usage.completion_tokens : undefined
                };
            } else {
                throw new Error('Invalid response format: No choices found');
            }
        } catch (error: any) {
            console.error('[OpenAIService] Fetch Error:', error);
            throw error;
        }
    }

    async *streamChat(messages: any[], model: string = 'gpt-3.5-turbo'): AsyncGenerator<string> {
        if (!this.apiKey && this.baseUrl.includes('api.openai.com')) {
            throw new Error('OpenAI API Key is not set.');
        }

        const useProxy = this.baseUrl.includes('8317')
        const endpoint = `${this.baseUrl}/chat/completions`
        console.log(`[OpenAIService] Streaming: ${endpoint}`);

        const normalizedMessages = this.normalizeMessages(messages)
        const body: any = { model, messages: normalizedMessages, stream: true }
        if (useProxy) {
            console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
            console.log(`[OpenAIService] Proxy Stream Request Payload:`, JSON.stringify(body, null, 2))
            console.log(`[OpenAIService] Proxy Stream Headers:`, {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey ? (this.apiKey.substring(0, 5) + '...') : 'dummy'}`
            })
            console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        }
        const dispatcher = this.getDispatcher();
        const requestInit: any = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey || 'dummy'}`
            },
            body: JSON.stringify(body)
        };
        if (dispatcher) requestInit.dispatcher = dispatcher;
        let response;
        try {
            response = await fetch(endpoint, requestInit);
        } catch (error: any) {
            if (error?.cause?.code === 'UND_ERR_HEADERS_TIMEOUT' || error?.code === 'UND_ERR_HEADERS_TIMEOUT') {
                console.warn('[OpenAIService] Stream headers timeout, retrying once...');
                response = await fetch(endpoint, requestInit);
            } else {
                throw error;
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OpenAIService] Stream Error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        if (!response.body) {
            throw new Error('No response body');
        }

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
                        if (content) {
                            yield content;
                        }
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    async getEmbeddings(input: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
        if (!this.apiKey && this.baseUrl.includes('api.openai.com')) {
            throw new Error('OpenAI API Key is not set.');
        }

        const response = await fetch(`${this.baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey || 'dummy'}`
            },
            body: JSON.stringify({
                model,
                input,
            })
        });

        if (!response.ok) {
            throw new Error(`Embeddings Error: ${response.statusText}`);
        }

        const json = await response.json();
        return json.data[0].embedding;
    }

    async getModels(): Promise<any[]> {
        if (!this.baseUrl) return [];

        try {
            const headers: any = {};
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            console.log(`[OpenAIService] Fetching Models: ${this.baseUrl}/models`);
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                console.error('[OpenAIService] GetModels Failed:', response.status, response.statusText);
                return [];
            }

            const json = await response.json();
            return json.data || [];
        } catch (e) {
            console.error('[OpenAIService] GetModels Error:', e);
            return [];
        }
    }
}
