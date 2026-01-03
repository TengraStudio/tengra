import { BaseLLMService, ChatMessage } from './base-llm.service';

export class CopilotService extends BaseLLMService {
    private githubToken: string = '';

    constructor() {
        super();
    }

    setGithubToken(token: string) {
        this.githubToken = token;
    }

    async chat(messages: ChatMessage[], model: string = 'gpt-4'): Promise<any> {
        try {
            const token = this.githubToken;
            if (!token) throw new Error('GitHub Token not set');

            let startModel = model;
            if (model.startsWith('copilot-')) startModel = model.replace('copilot-', '');
            if (model.startsWith('github-')) startModel = model.replace('github-', '');
            console.log({
                model, startModel, body: JSON.stringify({
                    messages,
                    model: startModel,
                    stream: false,
                    temperature: 0.7
                })
            })
            console.log(`[CopilotService] Routing ${startModel} to https://models.github.ai/inference/chat/completions`);

            const response = await fetch('https://models.github.ai/inference/chat/completions', {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${token}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json'
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
                throw new Error(`Copilot API Error: ${response.status} - ${errorText}`);
            }

            const json = await response.json();
            return json.choices[0].message;

        } catch (error) {
            this.handleError(error, 'chat');
        }
    }

    async streamChat(messages: ChatMessage[], model: string, tools?: any[]): Promise<ReadableStream<Uint8Array> | null> {
        try {
            const token = this.githubToken;
            if (!token) throw new Error('GitHub Token not set');

            let startModel = model;
            if (model.startsWith('copilot-')) startModel = model.replace('copilot-', '');
            if (model.startsWith('github-')) startModel = model.replace('github-', '');

            // Use Standard Endpoint
            const endpoint = 'https://models.github.ai/inference/chat/completions';
            console.log(`[CopilotService] Streaming ${startModel} from ${endpoint}`);

            const body: any = {
                messages,
                model: startModel,
                stream: true,
                temperature: 0.7
            };

            console.log({ body })

            const preparedTools = this.prepareTools(tools);
            if (preparedTools && preparedTools.length > 0) {
                body.tools = preparedTools;
                body.tool_choice = 'auto';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${token}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Copilot API Error: ${response.status} - ${errorText}`);
            }

            return response.body;

        } catch (error) {
            this.handleError(error, 'streamChat');
            return null;
        }
    }
}
