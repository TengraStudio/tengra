
export interface OpenAIResponse {
    content: string;
    role: string;
}

export class OpenAIService {
    private apiKey: string = '';
    private baseUrl: string = 'https://api.openai.com/v1';

    constructor() { }

    setApiKey(key: string) {
        this.apiKey = key;
    }

    setBaseUrl(url: string) {
        // Remove trailing slash if present
        this.baseUrl = url.replace(/\/$/, '');
    }

    async chat(messages: any[], model: string = 'gpt-3.5-turbo'): Promise<OpenAIResponse> {
        // Allow empty API key if using local proxy (some proxies don't require it, or use dummy)
        if (!this.apiKey && this.baseUrl.includes('api.openai.com')) {
            throw new Error('OpenAI API Key is not set.');
        }

        console.log(`[OpenAIService] Fetching: ${this.baseUrl}/chat/completions`)

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey || 'dummy'}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                })
            });

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
                return {
                    content: json.choices[0].message.content,
                    role: json.choices[0].message.role,
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

        // Reusing non-streaming for now as per original implementation
        // TODO: Implement true streaming for proxy support
        const response = await this.chat(messages, model);
        yield response.content;
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
