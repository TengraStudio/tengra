import { randomUUID } from 'node:crypto';
import { Message } from '../../shared/types/chat';

const USER_AGENT = 'GithubCopilot/1.250.0';
const API_VERSION = '2023-07-07';
const EDITOR_PLUGIN_VERSION = 'copilot/1.250.0';
const FALLBACK_VSCODE_VERSION = '1.107';

export class CopilotService {
    private githubToken: string | null = null;
    private copilotSessionToken: string | null = null;
    private tokenExpiresAt: number = 0;
    private vsCodeVersion: string = FALLBACK_VSCODE_VERSION;
    private accountType: 'individual' | 'business' | 'enterprise' = 'individual';
    private tokenPromise: Promise<string> | null = null;

    constructor() {
        this.fetchVsCodeVersion();
    }

    setGithubToken(token: string) {
        this.githubToken = token;
        this.copilotSessionToken = null;
    }

    private async fetchVsCodeVersion() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            const response = await fetch('https://raw.githubusercontent.com/microsoft/vscode/main/pkgbuild.json', { signal: controller.signal });
            const pkgbuild = await response.text();
            const match = pkgbuild.match(/pkgver=([0-9.]+)/);
            if (match) this.vsCodeVersion = match[1];
            clearTimeout(timeout);
        } catch (e) {
            console.warn('[CopilotService] Failed to fetch latest VSCode version, using fallback:', FALLBACK_VSCODE_VERSION);
        }
    }

    private async ensureCopilotToken(): Promise<string> {
        if (this.copilotSessionToken && Date.now() < this.tokenExpiresAt - 60000) {
            return this.copilotSessionToken;
        }

        if (this.tokenPromise) return this.tokenPromise;

        this.tokenPromise = (async () => {
            try {
                if (!this.githubToken) {
                    throw new Error('GitHub Authentication failed: No token found. Please login via Settings.');
                }

                try {
                    const usageRes = await fetch('https://api.github.com/copilot_internal/user', {
                        headers: {
                            'Authorization': `token ${this.githubToken}`,
                            'Accept': 'application/json',
                            'User-Agent': USER_AGENT
                        }
                    });
                    if (usageRes.ok) {
                        const usageData = await usageRes.json() as any;
                        if (usageData.copilot_plan === 'business') this.accountType = 'business';
                        else if (usageData.copilot_plan === 'enterprise') this.accountType = 'enterprise';
                        else this.accountType = 'individual';
                        console.log(`[CopilotService] Detected Plan: ${usageData.copilot_plan} -> Endpoint: ${this.getBaseUrl()}`);
                    }
                } catch (e) {
                    console.warn('[CopilotService] Failed to detect account type, defaulting to individual');
                }

                const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
                    headers: {
                        'Authorization': `token ${this.githubToken}`,
                        'Accept': 'application/json',
                        'Editor-Version': `vscode/${this.vsCodeVersion}`,
                        'Editor-Plugin-Version': EDITOR_PLUGIN_VERSION,
                        'User-Agent': USER_AGENT,
                        'X-GitHub-Api-Version': API_VERSION,
                    }
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        console.warn('[CopilotService] v2/token returned 404, trying v1/token...');
                        const v1Response = await fetch('https://api.github.com/copilot_internal/token', {
                            headers: {
                                'Authorization': `token ${this.githubToken}`,
                                'Accept': 'application/json',
                                'Editor-Version': `vscode/${this.vsCodeVersion}`,
                                'Editor-Plugin-Version': EDITOR_PLUGIN_VERSION,
                                'User-Agent': USER_AGENT
                            }
                        });
                        if (v1Response.ok) {
                            const data = await v1Response.json() as any;
                            this.copilotSessionToken = data.token;
                            this.tokenExpiresAt = (data.expires_at || (Date.now() / 1000 + 1200)) * 1000;
                            return this.copilotSessionToken!;
                        }
                    }
                    throw new Error(`Failed to get Copilot token: ${response.status} ${await response.text()}`);
                }

                const data = await response.json() as any;
                this.copilotSessionToken = data.token;
                this.tokenExpiresAt = (data.expires_at || (Date.now() / 1000 + 1200)) * 1000;
                return this.copilotSessionToken!;
            } finally {
                this.tokenPromise = null;
            }
        })();

        return this.tokenPromise;
    }

    private getBaseUrl(): string {
        if (this.accountType === 'individual') return 'https://api.githubcopilot.com';
        return `https://api.${this.accountType}.githubcopilot.com`;
    }

    private getHeaders(token: string, hasImages: boolean = false) {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Copilot-Integration-Id': 'vscode-chat',
            'Editor-Version': `vscode/${this.vsCodeVersion}`,
            'Editor-Plugin-Version': EDITOR_PLUGIN_VERSION,
            'User-Agent': USER_AGENT,
            'Openai-Intent': 'conversation-panel',
            'X-GitHub-Api-Version': API_VERSION,
            'X-Request-Id': randomUUID(),
            'X-Vscode-User-Agent-Library-Version': 'electron-fetch',
            'Openai-Organization': 'github-copilot'
        };

        if (hasImages) {
            headers['X-Copilot-Chat-Capability-Image-Vision'] = 'true';
        }

        return headers;
    }

    private prepareTools(tools?: any[]) {
        if (!tools || tools.length === 0) return undefined;
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name || tool.function?.name,
                description: tool.description || tool.function?.description,
                parameters: tool.parameters || tool.function?.parameters
            }
        }));
    }

    private formatCodexPrompt(messages: Message[]): string {
        return messages.map(msg => {
            const role = msg.role === 'user' ? 'User' : (msg.role === 'system' ? 'System' : 'Assistant');
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return `${role}: ${content}`;
        }).join('\n') + '\nAssistant:';
    }

    private async diagnosticCodexRequest(messages: Message[], finalModel: string, headers: any, stream: boolean = false, tools?: any[]): Promise<any> {
        console.warn(`[CopilotService] ${finalModel} diagnostic mode (${stream ? 'stream' : 'chat'}): testing all possible paths...`);
        const prompt = this.formatCodexPrompt(messages);

        const completionPayload = {
            model: finalModel,
            prompt,
            stream,
            max_tokens: 4096,
            temperature: 0.7,
            stop: ['\nUser:', '\nSystem:']
        };

        const chatPayload: any = {
            model: finalModel,
            messages,
            stream,
            temperature: 0.7,
        };

        const gateways = [
            'https://api.individual.githubcopilot.com',
            'https://api.githubcopilot.com',
            'https://api.business.githubcopilot.com'
        ];

        const endpoints = [
            '/responses',
            '/v1/completions',
            '/completions',
            '/chat/completions',
            '/v1/chat/completions'
        ];

        for (const gateway of gateways) {
            for (const endpoint of endpoints) {
                const url = `${gateway}${endpoint}`;
                try {
                    const isChatPath = endpoint.includes('/chat/');
                    const isResponsesPath = endpoint === '/responses';

                    let currentPayload: any;
                    let currentHeaders = { ...headers };

                    if (isResponsesPath) {
                        currentPayload = {
                            model: finalModel,
                            input: prompt.replace(/Assistant:$/, ''), // Remove trailing Assistant
                            stream
                        };
                        currentHeaders['Openai-Intent'] = 'conversation-panel';

                        if (tools && tools.length > 0) {
                            // Flatten tools for /responses endpoint
                            currentPayload.tools = tools.map(t => ({
                                name: t.name || t.function?.name,
                                description: t.description || t.function?.description,
                                type: 'function',
                                parameters: t.parameters || t.function?.parameters
                            }));
                            currentPayload.tool_choice = 'auto'; // Or 'function_call': 'auto' if legacy
                        }
                    } else {
                        currentPayload = isChatPath ? chatPayload : completionPayload;
                        currentHeaders['Openai-Intent'] = isChatPath ? 'conversation-panel' : 'completions';

                        if (isChatPath && tools && tools.length > 0) {
                            currentPayload.tools = this.prepareTools(tools);
                            currentPayload.tool_choice = 'auto';
                        }
                    }

                    console.log(`[CopilotService] Diagnostic: Testing ${url} ...`);

                    const res = await fetch(url, {
                        method: 'POST',
                        headers: currentHeaders,
                        body: JSON.stringify(currentPayload)
                    });

                    if (res.ok) {
                        console.log(`[CopilotService] HIT! Successfully reached ${finalModel} via ${url}`);

                        if (isResponsesPath) {
                            // Map /responses output to standard format
                            let data: any = {};
                            try {
                                if (stream) {
                                    console.log(`[CopilotService] Returning stream body from ${url}`);
                                    // Log first chunk to see format
                                    const clonedRes = res.clone();
                                    const reader = clonedRes.body?.getReader();
                                    if (reader) {
                                        const { value } = await reader.read();
                                        if (value) {
                                            const sample = new TextDecoder().decode(value);
                                            console.log(`[CopilotService] Stream sample (first 500 chars): ${sample.substring(0, 500)}`);
                                        }
                                        reader.releaseLock();
                                    }
                                    return res.body;
                                }
                                data = await res.json() as any;
                                console.log(`[CopilotService] Non-stream response:`, JSON.stringify(data).substring(0, 500));
                            } catch (e) {
                                console.log(`[CopilotService] Parse error:`, e);
                                return null;
                            }

                            // Parse /responses format - might be nested under 'response' key
                            const responseData = data.response || data;

                            // Check for tool calls in output
                            const outputItems = Array.isArray(responseData.output) ? responseData.output : [];
                            const toolCalls = outputItems
                                .filter((item: any) => item.type === 'function_call')
                                .map((item: any) => ({
                                    id: item.id || randomUUID(),
                                    type: 'function',
                                    function: {
                                        name: item.name,
                                        arguments: item.arguments
                                    }
                                }));

                            // Try multiple possible content locations - ensure string type
                            let contentText: string | null = null;

                            if (typeof responseData.output_text === 'string') contentText = responseData.output_text;
                            else if (typeof responseData.text === 'string') contentText = responseData.text;
                            else if (typeof responseData.content === 'string') contentText = responseData.content;
                            else if (outputItems.length > 0) {
                                contentText = outputItems
                                    .filter((item: any) => item.type !== 'function_call')
                                    .map((item: any) => {
                                        if (typeof item === 'string') return item;
                                        if (typeof item.text === 'string') return item.text;
                                        if (typeof item.content === 'string') return item.content;
                                        return JSON.stringify(item);
                                    })
                                    .join('');
                            }

                            // Fallback: stringify the whole response for debugging
                            if (!contentText) {
                                contentText = `[/responses format unknown] ${JSON.stringify(responseData).substring(0, 500)}`;
                            }

                            console.log(`[CopilotService] Extracted content: ${contentText.substring(0, 100)}`);

                            const message: any = { role: 'assistant', content: contentText };
                            if (toolCalls.length > 0) {
                                message.tool_calls = toolCalls;
                            }
                            return message;
                        }

                        if (stream) return res.body;
                        const json = await res.json() as any;
                        return isChatPath ? json.choices[0].message : { role: 'assistant', content: json.choices[0].text.trim() };
                    } else {
                        const err = await res.text();
                        console.log(`[CopilotService] MISS: ${url} returned ${res.status} - ${err.substring(0, 100)}`);
                    }
                } catch (e: any) {
                    console.log(`[CopilotService] ERROR: ${url} failed: ${e.message}`);
                }
            }
        }
        return null;
    }

    async chat(messages: Message[], model: string = 'gpt-4o', tools?: any[]): Promise<any> {
        try {
            const token = await this.ensureCopilotToken();
            const hasImages = messages.some(m => Array.isArray(m.content) && (m.content as any).some((c: any) => c.type === 'image_url'));

            let finalModel = model;
            if (model.startsWith('copilot-')) finalModel = model.replace('copilot-', '');
            if (model.startsWith('github-')) finalModel = model.replace('github-', '');

            const isAgentCall = messages.some(msg => ['assistant', 'tool'].includes(msg.role));
            const headers = this.getHeaders(token, hasImages);
            headers['X-Initiator'] = isAgentCall ? 'agent' : 'user';

            const chatUrl = `${this.getBaseUrl()}/chat/completions`;

            const payload: any = {
                messages,
                model: finalModel,
                stream: false,
                temperature: 0.7
            };

            const preparedTools = this.prepareTools(tools);
            if (preparedTools && preparedTools.length > 0) {
                payload.tools = preparedTools;
                payload.tool_choice = 'auto';
            }

            let response = await fetch(chatUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                let errorBody: any = {};
                try { errorBody = JSON.parse(errText); } catch { }

                const isUnsupported = errorBody?.error?.code === 'unsupported_api_for_model';
                const is400Codex = response.status === 400 && finalModel.toLowerCase().includes('codex');

                if (isUnsupported || is400Codex) {
                    const result = await this.diagnosticCodexRequest(messages, finalModel, headers, false, tools);
                    if (result) return result;
                }

                if (response.status === 404 && this.accountType === 'individual') {
                    const bizUrl = 'https://api.business.githubcopilot.com/chat/completions';
                    const bizRes = await fetch(bizUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
                    if (bizRes.ok) return ((await bizRes.json()) as any).choices[0].message;
                }
                throw new Error(`Copilot API Error: ${response.status} - ${errText}`);
            }

            const json = await response.json() as any;

            // Handle standard OpenAI format
            if (json.choices && json.choices[0]?.message) {
                return json.choices[0].message;
            }

            // Handle new Copilot format: {content: [{type: 'output_text', text: '...'}], type: 'message'}
            if (json.type === 'message' && Array.isArray(json.content)) {
                const textContent = json.content
                    .filter((item: any) => item.type === 'output_text' || item.text)
                    .map((item: any) => item.text || '')
                    .join('');
                return { role: 'assistant', content: textContent };
            }

            // Handle output_text directly in response
            if (json.output_text) {
                return { role: 'assistant', content: json.output_text };
            }

            // Fallback - return content as-is if it's a string
            if (typeof json.content === 'string') {
                return { role: 'assistant', content: json.content };
            }

            // Last resort - stringify and return for debugging
            console.warn('[CopilotService] Unknown response format:', JSON.stringify(json).substring(0, 200));
            return { role: 'assistant', content: JSON.stringify(json) };

        } catch (error) {
            this.handleError(error, 'chat');
        }
    }

    async streamChat(messages: Message[], model: string, tools?: any[]): Promise<ReadableStream<Uint8Array> | null> {
        try {
            const token = await this.ensureCopilotToken();
            const hasImages = messages.some(m => Array.isArray(m.content) && (m.content as any).some((c: any) => c.type === 'image_url'));

            let finalModel = model;
            if (model.startsWith('copilot-')) finalModel = model.replace('copilot-', '');
            if (model.startsWith('github-')) finalModel = model.replace('github-', '');

            const isAgentCall = messages.some(msg => ['assistant', 'tool'].includes(msg.role));
            const headers = this.getHeaders(token, hasImages);
            headers['X-Initiator'] = isAgentCall ? 'agent' : 'user';

            const payload: any = {
                messages,
                model: finalModel,
                stream: true,
                temperature: 0.7
            };

            const preparedTools = this.prepareTools(tools);
            if (preparedTools && preparedTools.length > 0) {
                payload.tools = preparedTools;
                payload.tool_choice = 'auto';
            }

            const chatUrl = `${this.getBaseUrl()}/chat/completions`;

            const response = await fetch(chatUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                let errorBody: any = {};
                try { errorBody = JSON.parse(errText); } catch { }

                const isUnsupported = errorBody?.error?.code === 'unsupported_api_for_model';
                const is400Codex = response.status === 400 && finalModel.toLowerCase().includes('codex');

                if (isUnsupported || is400Codex) {
                    const body = await this.diagnosticCodexRequest(messages, finalModel, headers, true, tools);
                    if (body) return body as ReadableStream<Uint8Array>;
                }

                if (response.status === 404 && this.accountType === 'individual') {
                    const bizRes = await fetch('https://api.business.githubcopilot.com/chat/completions', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(payload)
                    });
                    if (bizRes.ok) return bizRes.body as ReadableStream<Uint8Array>;
                }
                throw new Error(`Copilot API Error: ${response.status} - ${errText}`);
            }

            return response.body as ReadableStream<Uint8Array>;

        } catch (error) {
            this.handleError(error, 'streamChat');
            return null;
        }
    }

    async getModels(): Promise<any> {
        try {
            const token = await this.ensureCopilotToken();
            const url = `${this.getBaseUrl()}/models`;
            const response = await fetch(url, { headers: this.getHeaders(token) });
            if (!response.ok) return { data: [] };
            return await response.json();
        } catch (error) {
            console.error('[CopilotService] Failed to fetch models:', error);
            return { data: [] };
        }
    }

    private handleError(error: any, context: string) {
        console.error(`[CopilotService] Error in ${context}:`, error);
        throw error;
    }
}
