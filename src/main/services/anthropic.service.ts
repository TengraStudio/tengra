import { ServiceResponse } from '../../shared/types';

export class AnthropicService {
    private apiKey: string = '';

    setApiKey(key: string) {
        this.apiKey = key;
    }

    async chat(messages: any[], model: string = 'claude-3-5-sonnet-20240620'): Promise<ServiceResponse> {
        if (!this.apiKey) return { success: false, error: 'Anthropic API connection not configured' };

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model,
                    messages,
                    max_tokens: 4096
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            return {
                success: true,
                result: data.content[0].text
            };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
