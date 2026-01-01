import { ServiceResponse } from '../../shared/types';

export class GeminiService {
    private apiKey: string = '';

    setApiKey(key: string) {
        this.apiKey = key;
    }

    async chat(messages: any[], model: string = 'gemini-1.5-pro'): Promise<ServiceResponse> {
        if (!this.apiKey) return { success: false, error: 'Gemini API connection not configured' };

        try {
            // Mapping messages to Google's format
            const contents = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contents })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            return {
                success: true,
                result: data.candidates[0].content.parts[0].text
            };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
