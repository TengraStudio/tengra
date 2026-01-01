
export interface CopilotResponse {
    content: string;
    role: string;
}

export class CopilotService {
    private githubToken: string = '';
    private copilotToken: string = '';
    private tokenExpiresAt: number = 0;

    constructor() { }

    setGithubToken(token: string) {
        this.githubToken = token;
    }

    async getCopilotToken(): Promise<string> {
        if (!this.githubToken) {
            throw new Error('GitHub Token not set. Please login first.');
        }

        // Return cached token if valid (with 5 min buffer)
        if (this.copilotToken && Date.now() < this.tokenExpiresAt - 5 * 60 * 1000) {
            return this.copilotToken;
        }

        return this.refreshCopilotToken();
    }

    private async refreshCopilotToken(): Promise<string> {
        console.log('[CopilotService] Refreshing token...');
        const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
            headers: {
                'Authorization': `token ${this.githubToken}`,
                'User-Agent': 'GithubCopilot/1.155.0',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get Copilot token: ${response.status} - ${errorText}`);
        }

        const json = await response.json();
        this.copilotToken = json.token;
        this.tokenExpiresAt = json.expires_at * 1000;
        console.log('[CopilotService] Token refreshed, expires at:', new Date(this.tokenExpiresAt).toLocaleString());
        return this.copilotToken;
    }

    async chat(messages: any[], model: string = 'gpt-4'): Promise<any> {
        console.log(`[CopilotService] chat() called for model: ${model}`);
        try {
            console.log(`[CopilotService] attempting to get token...`);
            const token = await this.getCopilotToken();
            console.log(`[CopilotService] token retrieved (length: ${token.length})`);


            // Map our internal model IDs to Copilot's expected IDs if necessary
            // e.g. copilot-gpt-4 -> gpt-4
            let startModel = model;
            if (model.startsWith('copilot-')) startModel = model.replace('copilot-', '');
            if (model.startsWith('github-')) startModel = model.replace('github-', '');

            // Copilot usually expects 'gpt-4', 'gpt-3.5-turbo', etc.
            // If user selects 'gpt-5' (fictional) via proxy, we might need a fallback, 
            // but for now we pass what the user asks if valid.

            const response = await fetch('https://api.githubcopilot.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Editor-Version': 'vscode/1.85.1',
                    'Editor-Plugin-Version': 'copilot-chat/0.11.1',
                    'User-Agent': 'GitHubCopilotChat/0.11.1',
                    'Openai-Organization': 'github-copilot',
                    'Openai-Intent': 'conversation-panel'
                },
                body: JSON.stringify({
                    messages,
                    model: startModel,
                    stream: false,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[CopilotService] API Error: ${response.status} - ${errorText}`);
                throw new Error(`Copilot API Error: ${response.status} - ${errorText}`);
            }

            const json = await response.json();
            return json.choices[0].message;

        } catch (error) {
            console.error('Copilot Chat Error:', error);
            throw error;
        }
    }

    // Support streaming if we simply return a regular fetch response or handle reader
    async streamChat(messages: any[], model: string): Promise<ReadableStream<Uint8Array> | null> {
        try {
            console.log(`[CopilotService] Stream Chat request for model: ${model}`);
            const token = await this.getCopilotToken();

            let startModel = model;
            if (model.startsWith('copilot-')) startModel = model.replace('copilot-', '');
            if (model.startsWith('github-')) startModel = model.replace('github-', '');

            const response = await fetch('https://api.githubcopilot.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Editor-Version': 'vscode/1.85.1',
                    'Editor-Plugin-Version': 'copilot-chat/0.11.1',
                    'User-Agent': 'GitHubCopilotChat/0.11.1',
                    'Openai-Organization': 'github-copilot',
                    'Openai-Intent': 'conversation-panel'
                },
                body: JSON.stringify({
                    messages,
                    model: startModel,
                    stream: true,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Copilot API Error: ${response.status} - ${errorText}`);
            }

            return response.body;

        } catch (error) {
            console.error('Copilot Stream Error:', error);
            throw error;
        }
    }
}
