import { ServiceResponse } from '../../shared/types';

export class GroqService {
    private apiKey: string = '';

    setApiKey(key: string) {
        this.apiKey = key;
    }

    async chat(messages: any[], model: string = 'llama3-70b-8192'): Promise<ServiceResponse> {
        if (!this.apiKey) return { success: false, error: 'Groq API connection not configured' };

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            return {
                success: true,
                result: data.choices[0].message.content
            };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
