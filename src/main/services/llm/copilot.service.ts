import { randomUUID } from 'node:crypto';
import { Message, ToolCall, JsonValue, JsonObject, ToolDefinition } from '../../../shared/types';
import { getErrorMessage } from '../../../shared/utils/error.util';

const USER_AGENT = 'GithubCopilot/1.250.0';
const API_VERSION = '2023-07-07';
const EDITOR_PLUGIN_VERSION = 'copilot/1.250.0';
const FALLBACK_VSCODE_VERSION = '1.107';



export interface CopilotTokenResponse {
    token: string;
    expires_at: number;
}

export interface CopilotUsageData {
    copilot_plan?: 'individual' | 'business' | 'enterprise';
}

export interface CopilotToolFunction {
    name: string;
    description?: string;
    parameters: JsonObject;
}

export interface CopilotTool {
    type: 'function';
    function: CopilotToolFunction;
}



interface CopilotPayload {
    model: string;
    messages?: Message[];
    prompt?: string;
    input?: string; // For /responses endpoint
    stream: boolean;
    temperature?: number;
    max_tokens?: number;
    stop?: string[];
    tools?: CopilotTool[];
    tool_choice?: 'auto' | 'none' | 'required';
}

export interface CopilotChatResponse {
    choices: Array<{
        message: Message;
        text?: string;
    }>;
    type?: string;
    content?: string | Array<{ type: string; text?: string }>;
    output_text?: string;
}

interface DiagnosticResponse {
    response?: {
        output: Array<{
            type: string;
            id?: string;
            name?: string;
            arguments?: string;
            text?: string;
            content?: string;
        } | string>;
        output_text?: string;
        text?: string;
    };
    output?: Array<{
        type: string;
        id?: string;
        name?: string;
        arguments?: string;
        text?: string;
        content?: string;
    } | string>;
    output_text?: string;
    text?: string;
}

export class CopilotService {
    private githubToken: string | null = null;
    private copilotSessionToken: string | null = null;
    private tokenExpiresAt: number = 0;
    private vsCodeVersion: string = FALLBACK_VSCODE_VERSION;
    private accountType: 'individual' | 'business' | 'enterprise' = 'individual';
    private tokenPromise: Promise<string> | null = null;

    constructor(private authService?: { getToken: (p: string) => string | undefined }) {
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
            const response = await fetch('https://raw.githubusercontent.com/microsoft/vscode/main/package.json', { signal: controller.signal });
            const packageJson = await response.json() as { version: string };
            if (packageJson.version) this.vsCodeVersion = packageJson.version;
            clearTimeout(timeout);
        } catch (error) {
            console.warn('[CopilotService] Failed to fetch latest VSCode version, using fallback:', FALLBACK_VSCODE_VERSION, getErrorMessage(error as Error));
        }
    }

    isConfigured(): boolean {
        // fast check
        if (this.githubToken || this.copilotSessionToken) return true;
        // deep check via AuthService - ONLY use copilot_token, no fallback
        if (this.authService) {
            return !!this.authService.getToken('copilot_token');
        }
        return false;
    }

    private async ensureCopilotToken(): Promise<string> {
        if (this.copilotSessionToken && Date.now() < this.tokenExpiresAt - 60000) {
            return this.copilotSessionToken;
        }

        if (this.tokenPromise) return this.tokenPromise;

        this.tokenPromise = (async () => {
            try {
                if (!this.githubToken) {
                    // Try to recover from AuthService if available - ONLY use copilot_token, no fallback
                    if (this.authService) {
                        console.log('[CopilotService] No token set, attempting to recover copilot_token from AuthService...');
                        const copilotToken = this.authService.getToken('copilot_token');
                        console.log(`[CopilotService] copilot_token: ${copilotToken ? `found (length: ${copilotToken.length})` : 'NOT FOUND'}`);
                        if (copilotToken) {
                            console.log('[CopilotService] Recovered copilot_token from AuthService');
                            this.githubToken = copilotToken;
                        }
                    }

                    if (!this.githubToken) {
                        throw new Error('Copilot Authentication failed: No copilot_token found. Please login via Settings.');
                    }
                } else {
                    console.log(`[CopilotService] Using existing token, length: ${this.githubToken.length}`);
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
                        const usageData = await usageRes.json() as CopilotUsageData;
                        this.accountType = usageData.copilot_plan || 'individual';
                        console.log(`[CopilotService] Detected Plan: ${this.accountType} -> Endpoint: ${this.getBaseUrl()}`);
                    }
                } catch (error) {
                    console.warn('[CopilotService] Failed to detect account type, defaulting to individual', getErrorMessage(error as Error));
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
                        console.warn('[CopilotService] v2/token 404, attempting fallback to v1/token');
                        const v1Response = await fetch('https://api.github.com/copilot_internal/token', {
                            headers: {
                                'Authorization': `token ${this.githubToken}`,
                                'Accept': 'application/json',
                                'Editor-Version': `vscode/${this.vsCodeVersion}`,
                                'Editor-Plugin-Version': EDITOR_PLUGIN_VERSION,
                                'User-Agent': USER_AGENT,
                                'X-GitHub-Api-Version': API_VERSION // Ensure version is sent
                            }
                        });

                        if (v1Response.ok) {
                            const data = await v1Response.json() as CopilotTokenResponse;
                            this.copilotSessionToken = data.token;
                            this.tokenExpiresAt = (data.expires_at || (Date.now() / 1000 + 1200)) * 1000;
                            return this.copilotSessionToken;
                        } else {
                            const v1ErrorText = await v1Response.text();
                            console.error(`[CopilotService] v1 fallback failed: ${v1Response.status} ${v1ErrorText}`);
                            
                            // 404 on both endpoints usually means token is invalid/expired/revoked or doesn't have Copilot permissions
                            if (v1Response.status === 404) {
                                console.error(`[CopilotService] Token appears invalid (404 on both v2 and v1 endpoints). This usually means:`);
                                console.error(`[CopilotService] 1. Token is expired/revoked`);
                                console.error(`[CopilotService] 2. Token doesn't have Copilot permissions`);
                                console.error(`[CopilotService] 3. User doesn't have Copilot access`);
                                console.error(`[CopilotService] Please re-login to get a new token.`);
                                // Don't clear token automatically - let user re-login manually
                            }
                        }
                    }

                    const errorText = await response.text();
                    // If Unauthorized (401), the token is definitely bad. 
                    // For 403 (Forbidden) or 404 (Not Found), it might be plan-related or API changes, don't delete yet.
                    if (response.status === 401) {
                        console.warn(`[CopilotService] Token unauthorized (401). Clearing token.`);
                        this.githubToken = null;
                        this.copilotSessionToken = null;
                        if (this.authService && 'deleteToken' in this.authService) {
                            (this.authService as any).deleteToken?.('github_token');
                        }
                    } else if (response.status === 404) {
                        console.error(`[CopilotService] Token not found (404). This usually means:`);
                        console.error(`[CopilotService] 1. Token is expired/revoked`);
                        console.error(`[CopilotService] 2. Token doesn't have Copilot permissions`);
                        console.error(`[CopilotService] 3. User doesn't have Copilot access`);
                        console.error(`[CopilotService] Please re-login to get a new token.`);
                    }

                    throw new Error(`Failed to get Copilot token: ${response.status} ${errorText}`);
                }

                const data = await response.json() as CopilotTokenResponse;
                this.copilotSessionToken = data.token;
                this.tokenExpiresAt = (data.expires_at || (Date.now() / 1000 + 1200)) * 1000;
                return this.copilotSessionToken;
            } finally {
                this.tokenPromise = null;
            }
        })();

        return this.tokenPromise!;
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

    private prepareTools(tools?: ToolDefinition[]): CopilotTool[] | undefined {
        if (!tools || tools.length === 0) return undefined;
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.function.name,
                description: tool.function.description || '',
                parameters: tool.function.parameters || {}
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

    private async diagnosticCodexRequest(
        messages: Message[],
        finalModel: string,
        headers: Record<string, string>,
        stream: boolean = false,
        tools?: ToolDefinition[]
    ): Promise<Message | ReadableStream<Uint8Array> | null> {
        const prompt = this.formatCodexPrompt(messages);

        const completionPayload: CopilotPayload = {
            model: finalModel,
            prompt,
            stream,
            max_tokens: 4096,
            temperature: 0.7,
            stop: ['\nUser:', '\nSystem:']
        };

        const chatPayload: CopilotPayload = {
            model: finalModel,
            messages,
            stream,
            temperature: 0.7
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

                    let currentPayload: CopilotPayload;
                    const currentHeaders = { ...headers };

                    if (isResponsesPath) {
                        currentPayload = {
                            model: finalModel,
                            input: prompt.replace(/Assistant:$/, ''),
                            stream
                        };
                        currentHeaders['Openai-Intent'] = 'conversation-panel';

                        if (tools && tools.length > 0) {
                            currentPayload.tools = tools.map(t => ({
                                type: 'function',
                                function: {
                                    name: t.function.name,
                                    description: t.function.description || '',
                                    parameters: t.function.parameters || {}
                                }
                            }));
                            currentPayload.tool_choice = 'auto';
                        }
                    } else {
                        currentPayload = isChatPath ? chatPayload : completionPayload;
                        currentHeaders['Openai-Intent'] = isChatPath ? 'conversation-panel' : 'completions';

                        if (isChatPath && tools && tools.length > 0) {
                            currentPayload.tools = this.prepareTools(tools);
                            currentPayload.tool_choice = 'auto';
                        }
                    }

                    const res = await fetch(url, {
                        method: 'POST',
                        headers: currentHeaders,
                        body: JSON.stringify(currentPayload)
                    });

                    if (res.ok) {
                        if (isResponsesPath) {
                            if (stream && res.body) return res.body;

                            const data = await res.json() as DiagnosticResponse;
                            const responseData = data.response || data;
                            const outputItems = Array.isArray(responseData.output) ? responseData.output : [];

                            const toolCalls: ToolCall[] = outputItems
                                .filter((item): item is { type: 'function_call'; id?: string; name: string; arguments: string } =>
                                    typeof item === 'object' && item.type === 'function_call' && typeof item.name === 'string' && typeof item.arguments === 'string'
                                )
                                .map(item => ({
                                    id: item.id || randomUUID(),
                                    type: 'function',
                                    function: {
                                        name: item.name,
                                        arguments: item.arguments
                                    }
                                }));

                            let contentText: string | null = null;
                            if (typeof responseData.output_text === 'string') contentText = responseData.output_text;
                            else if (typeof responseData.text === 'string') contentText = responseData.text;
                            else if (outputItems.length > 0) {
                                contentText = outputItems
                                    .filter((item) => typeof item === 'string' || (typeof item === 'object' && item.type !== 'function_call'))
                                    .map((item) => {
                                        if (typeof item === 'string') return item;
                                        if (typeof item === 'object') return item.text || item.content || JSON.stringify(item);
                                        return '';
                                    })
                                    .join('');
                            }

                            const message: Message = {
                                id: randomUUID(),
                                role: 'assistant',
                                content: contentText || `[Unknown format] ${JSON.stringify(responseData).substring(0, 100)}`,
                                timestamp: new Date()
                            };
                            if (toolCalls.length > 0) message.toolCalls = toolCalls;
                            return message;
                        }

                        if (stream && res.body) return res.body;

                        const json = await res.json() as CopilotChatResponse;
                        if (isChatPath) return json.choices[0].message;
                        return {
                            id: randomUUID(),
                            role: 'assistant',
                            content: json.choices[0].text?.trim() || '',
                            timestamp: new Date()
                        };
                    }
                } catch (error) {
                    // continue to next gateway/endpoint
                    console.debug(`[CopilotService] Gateway ${gateway} endpoint ${endpoint} failed:`, getErrorMessage(error as Error));
                }
            }
        }
        return null;
    }

    async chat(messages: Message[], model: string = 'gpt-4o', tools?: ToolDefinition[]): Promise<Message | null> {
        try {
            const token = await this.ensureCopilotToken();
            const hasImages = messages.some(m => {
                if (Array.isArray(m.content)) {
                    return m.content.some(c => c.type === 'image_url');
                }
                return false;
            });

            let finalModel = model;
            if (model.startsWith('copilot-')) finalModel = model.replace('copilot-', '');
            if (model.startsWith('github-')) finalModel = model.replace('github-', '');

            const isAgentCall = messages.some(msg => ['assistant', 'tool'].includes(msg.role));
            const headers = this.getHeaders(token, hasImages);
            headers['X-Initiator'] = isAgentCall ? 'agent' : 'user';

            const payload: CopilotPayload = {
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

            const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
                method: 'POST', headers, body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                let errorBody: { error?: { code?: string } } | undefined;
                try { errorBody = JSON.parse(errText); } catch { /* ignore */ }

                if (errorBody?.error?.code === 'unsupported_api_for_model' || (response.status === 400 && finalModel.toLowerCase().includes('codex'))) {
                    const result = await this.diagnosticCodexRequest(messages, finalModel, headers, false, tools);
                    if (result && !(result instanceof ReadableStream)) return result;
                }

                if (response.status === 404 && this.accountType === 'individual') {
                    const bizRes = await fetch('https://api.business.githubcopilot.com/chat/completions', { method: 'POST', headers, body: JSON.stringify(payload) });
                    if (bizRes.ok) return ((await bizRes.json()) as CopilotChatResponse).choices[0].message;
                }
                throw new Error(`Copilot API Error: ${response.status} - ${errText}`);
            }

            const json = await response.json() as CopilotChatResponse;
            if (json.choices && json.choices[0]?.message) return json.choices[0].message;

            if (json.type === 'message' && Array.isArray(json.content)) {
                const contentArr = json.content;
                const textContent = contentArr.map((item) => item.text || '').join('');
                return {
                    id: randomUUID(),
                    role: 'assistant',
                    content: textContent,
                    timestamp: new Date()
                };
            }

            if (json.output_text) return { id: randomUUID(), role: 'assistant', content: json.output_text, timestamp: new Date() };
            if (typeof json.content === 'string') return { id: randomUUID(), role: 'assistant', content: json.content, timestamp: new Date() };

            return { id: randomUUID(), role: 'assistant', content: JSON.stringify(json), timestamp: new Date() };
        } catch (error) {
            this.handleError(error as Error, 'chat');
            return null;
        }
    }

    async streamChat(messages: Message[], model: string, tools?: ToolDefinition[]): Promise<ReadableStream<Uint8Array> | null> {
        try {
            const token = await this.ensureCopilotToken();
            const hasImages = messages.some(m => {
                if (Array.isArray(m.content)) {
                    return m.content.some(c => c.type === 'image_url');
                }
                return false;
            });

            let finalModel = model;
            if (model.startsWith('copilot-')) finalModel = model.replace('copilot-', '');
            if (model.startsWith('github-')) finalModel = model.replace('github-', '');

            const isAgentCall = messages.some(msg => ['assistant', 'tool'].includes(msg.role));
            const headers = this.getHeaders(token, hasImages);
            headers['X-Initiator'] = isAgentCall ? 'agent' : 'user';

            const payload: CopilotPayload = {
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

            const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
                method: 'POST', headers, body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                let errorBody: { error?: { code?: string } } | undefined;
                try { errorBody = JSON.parse(errText); } catch { /* ignore */ }

                if (errorBody?.error?.code === 'unsupported_api_for_model' || (response.status === 400 && finalModel.toLowerCase().includes('codex'))) {
                    const body = await this.diagnosticCodexRequest(messages, finalModel, headers, true, tools);
                    if (body instanceof ReadableStream) return body;
                }

                if (response.status === 404 && this.accountType === 'individual') {
                    const bizRes = await fetch('https://api.business.githubcopilot.com/chat/completions', { method: 'POST', headers, body: JSON.stringify(payload) });
                    if (bizRes.ok) return bizRes.body;
                }
                throw new Error(`Copilot API Error: ${response.status} - ${errText}`);
            }

            return response.body;
        } catch (error) {
            this.handleError(error as Error, 'streamChat');
            return null;
        }
    }

    async getModels(): Promise<{ data: JsonValue[] }> {
        if (!this.isConfigured()) return { data: [] };

        try {
            const token = await this.ensureCopilotToken();
            const response = await fetch(`${this.getBaseUrl()}/models`, { headers: this.getHeaders(token) });
            if (!response.ok) return { data: [] };
            return await response.json() as { data: JsonValue[] };
        } catch (error) {
            console.error('[CopilotService] Failed to get models:', getErrorMessage(error as Error));
            return { data: [] };
        }
    }

    private handleError(error: Error | string | unknown, context: string): never {
        const message = getErrorMessage(error as Error);
        console.error(`[CopilotService] Error in ${context}:`, message);
        if (error instanceof Error) throw error;
        throw new Error(`Error in ${context}: ${message}`);
    }
}
