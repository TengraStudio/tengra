import { randomUUID } from 'crypto';

import { BaseService } from '@main/services/base.service';
import { AuthService } from '@main/services/security/auth.service';
import { Message, ToolCall, ToolDefinition } from '@shared/types/chat';
import { JsonObject, JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';


// QUAL-002-1: Extract version constants
const COPILOT_USER_AGENT = 'GithubCopilot/1.250.0';
const COPILOT_API_VERSION = '2023-07-07';
const COPILOT_EDITOR_PLUGIN_VERSION = 'copilot/1.250.0';
const COPILOT_FALLBACK_VSCODE_VERSION = '1.107';

const USER_AGENT = COPILOT_USER_AGENT;
const API_VERSION = COPILOT_API_VERSION;
const EDITOR_PLUGIN_VERSION = COPILOT_EDITOR_PLUGIN_VERSION;
const FALLBACK_VSCODE_VERSION = COPILOT_FALLBACK_VSCODE_VERSION;

export interface CopilotTokenResponse {
    token: string;
    expires_at?: number;
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
    stream_options?: {
        include_usage: boolean;
    };
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

interface DiagnosticOutputItem {
    type?: string;
    id?: string;
    name?: string;
    arguments?: string;
    text?: string;
    content?: string;
}

interface DiagnosticResponseData {
    output?: (string | DiagnosticOutputItem)[];
    output_text?: string;
    text?: string;
}

interface DiagnosticResponse {
    response?: DiagnosticResponseData;
    output?: (string | DiagnosticOutputItem)[];
    output_text?: string;
    text?: string;
}

export class CopilotService extends BaseService {
    private githubToken: string | null = null;
    private copilotAuthToken: string | null = null;
    private copilotSessionToken: string | null = null;
    private tokenExpiresAt: number = 0;
    private vsCodeVersion: string = FALLBACK_VSCODE_VERSION;
    private accountType: 'individual' | 'business' | 'enterprise' = 'individual';
    private tokenPromise: Promise<string> | null = null;
    private rateLimitInterval: NodeJS.Timeout | null = null;
    private hasNotifiedExhaustion: boolean = false;
    private remainingCalls: number = 5000; // Default to assumed available

    // Rate limiting and caching
    protected modelsCache: { data: JsonValue[] } | null = null;
    protected modelsCacheExpiry: number = 0;
    public static readonly MODELS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private lastApiCall: number = 0;
    private static readonly MIN_API_INTERVAL = 1000; // 1 second between API calls

    constructor(
        private authService?: AuthService,
        private notificationService?: { showNotification: (t: string, b: string, silent?: boolean) => void }
    ) {
        super('CopilotService');
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing Copilot service...');

        // Delay VSCode version fetch to avoid startup rate limiting
        setTimeout(() => { void this.fetchVsCodeVersion(); }, 5000);

        // Start monitoring after initial delay
        setTimeout(() => { void this.startRateLimitMonitoring(); }, 10000);

        this.logInfo('Copilot service initialized successfully');
    }

    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up Copilot service...');

        if (this.rateLimitInterval) {
            clearInterval(this.rateLimitInterval);
            this.rateLimitInterval = null;
        }

        // Clear any pending token promises
        this.tokenPromise = null;
        this.copilotAuthToken = null;
        this.copilotSessionToken = null;

        this.logInfo('Copilot service cleanup complete');
    }

    /**
     * Checks the GitHub API rate limits for the Copilot token.
     * @param silent If true, suppresses log output unless limit is exhausted.
     */
    public async checkRateLimit(silent: boolean = false): Promise<void> {
        try {
            const tokenToCheck = await this.getRateLimitToken(silent);
            if (!tokenToCheck) { return; }

            const response = await fetch('https://api.github.com/rate_limit', {
                headers: {
                    'Authorization': `token ${tokenToCheck}`,
                    'Accept': 'application/json',
                    'User-Agent': USER_AGENT
                }
            });

            if (response.ok) {
                await this.handleRateLimitResponse(response, silent);
            } else {
                this.logWarn(`Rate limit check failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            this.logError(`Failed to check rate limit: ${getErrorMessage(error)}`);
        }
    }

    private async getRateLimitToken(silent: boolean): Promise<string | null> {
        if (!silent) {
            this.logInfo('Checking GitHub API rate limits...');
        }
        if (!this.githubToken && this.authService) {
            this.githubToken = (await this.authService.getActiveToken('github_token')) ?? null;
        }
        if (!this.githubToken) {
            this.logWarn('Cannot check rate limit: No github_token available.');
        }
        return this.githubToken;
    }

    private async handleRateLimitResponse(response: Response, silent: boolean) {
        interface RateLimitResponse {
            resources: {
                core: {
                    limit: number;
                    remaining: number;
                    reset: number;
                };
            };
        }
        const data = await response.json() as RateLimitResponse;
        const core = data.resources.core;
        this.remainingCalls = core.remaining;

        if (!silent) {
            this.logInfo(`--- GitHub API Rate Limits (Copilot Token) ---\nLimit: ${core.limit}\nRemaining: ${core.remaining}\nReset: ${new Date(core.reset * 1000).toLocaleString()}\n----------------------------------------------`);
        }

        if (core.remaining === 0) {
            this.notifyRateLimitExhausted(core.reset);
        } else {
            this.hasNotifiedExhaustion = false;
        }
    }

    private notifyRateLimitExhausted(resetTime: number) {
        if (!this.hasNotifiedExhaustion) {
            this.hasNotifiedExhaustion = true;
            this.notificationService?.showNotification(
                'Copilot Rate Limit Exhausted',
                `You have 0 requests remaining. Resets at ${new Date(resetTime * 1000).toLocaleTimeString()}`,
                false
            );
        }
    }

    setGithubToken(token: string) {
        this.githubToken = token;
        // Don't clear session token here, as github_token might be unrelated to copilot session
        this.modelsCache = null;
        this.modelsCacheExpiry = 0;
    }

    setCopilotToken(token: string) {
        this.copilotAuthToken = token;
        this.copilotSessionToken = null; // Clear session if auth token changes
        this.hasNotifiedExhaustion = false;
    }

    private startRateLimitMonitoring() {
        if (this.rateLimitInterval) {
            clearInterval(this.rateLimitInterval);
        }
        void this.checkRateLimit(true).catch(e => this.logError(`Initial rate limit check failed: ${getErrorMessage(e)}`));
        // Check every 5 minutes
        this.rateLimitInterval = setInterval(() => { void this.checkRateLimit(true); }, 5 * 60 * 1000);
    }

    // Rate limiting helper
    protected async waitForRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastApiCall;
        if (timeSinceLastCall < CopilotService.MIN_API_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, CopilotService.MIN_API_INTERVAL - timeSinceLastCall));
        }
        this.lastApiCall = Date.now();
    }

    private async fetchVsCodeVersion() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => { controller.abort(); }, 2000);
            const response = await fetch('https://raw.githubusercontent.com/microsoft/vscode/main/package.json', { signal: controller.signal });
            const packageJson = safeJsonParse<{ version: string }>(await response.text(), { version: FALLBACK_VSCODE_VERSION });
            if (packageJson.version) {
                this.vsCodeVersion = packageJson.version;
            }
            clearTimeout(timeout);
        } catch (error) {
            this.logWarn(`Failed to fetch latest VSCode version, using fallback: ${FALLBACK_VSCODE_VERSION} ${getErrorMessage(error)}`);
        }
    }

    /**
     * Checks if the Copilot service is configured with valid tokens.
     * @returns True if configured, false otherwise.
     */
    isConfigured(): boolean {
        // fast check
        if (this.copilotAuthToken || this.copilotSessionToken) {
            return true;
        }
        // deep check via AuthService - ONLY use copilot_token, no fallback
        if (this.authService) {
            // isConfigured is synchronous usually, so we might need to be careful if it returns a promise
            // but for now we'll just check if we have a token
            const token = this.authService.getActiveToken('copilot_token');
            if (token instanceof Promise) { return true; }
            return !!token;
        }
        return false;
    }

    private async recoverTokenFromAuthService(): Promise<void> {
        if (!this.authService) { return; }

        this.logInfo('No token set, attempting to recover from AuthService...');

        // 1. Recover Copilot Token
        const copilotToken = await this.authService.getActiveToken('copilot_token');
        if (copilotToken) {
            this.copilotAuthToken = copilotToken;
            this.logInfo(`Recovered copilot_token from AuthService (length: ${copilotToken.length})`);
        }

        // 2. Recover GitHub Token
        const githubToken = await this.authService.getActiveToken('github_token');
        if (githubToken) {
            this.githubToken = githubToken;
            this.logInfo(`Recovered github_token from AuthService (length: ${githubToken.length})`);
        } else {
            this.logInfo('github_token not found in AuthService');
        }

        this.logInfo(`Token recovery result: Copilot=${!!this.copilotAuthToken}, GitHub=${!!this.githubToken}`);
    }
    /**
     * Ensures a valid Copilot session token is available, refreshing if necessary.
     * @returns The active session token.
     * @throws Error if authentication fails.
     */
    public async ensureCopilotToken(): Promise<string> {
        if (this.copilotSessionToken && this.tokenExpiresAt > Date.now()) {
            return this.copilotSessionToken;
        }

        if (this.tokenPromise) {
            return this.tokenPromise;
        }

        this.tokenPromise = (async () => {
            try {
                await this.waitForRateLimit();

                // Ensure we have tokens loaded
                if (!this.copilotAuthToken) {
                    await this.recoverTokenFromAuthService();
                }

                // If still no copilot token, we can try to fallback to githubToken IF it's valid for Copilot 
                // (sometimes users put the same token in both places effectively)
                const authHeaderToken = this.copilotAuthToken ?? this.githubToken;

                if (!authHeaderToken) {
                    throw new Error('Copilot Authentication failed: No copilot_token or github_token found. Please login via Settings.');
                } else {
                    this.logInfo(`Using ${this.copilotAuthToken ? 'copilot_token' : 'github_token'} for auth, length: ${authHeaderToken.length}`);
                }

                try {
                    await this.detectAccountType(authHeaderToken);
                } catch (error) {
                    this.logWarn(`Failed to detect account type, defaulting to individual: ${getErrorMessage(error)}`);
                }

                const response = await this.fetchCopilotV2Token(authHeaderToken);

                if (!response.ok) {
                    return await this.handleTokenFetchFailure(response, authHeaderToken);
                }

                const data = await response.json() as CopilotTokenResponse;
                this.copilotSessionToken = data.token;
                this.tokenExpiresAt = (data.expires_at ?? (Date.now() / 1000 + 1200)) * 1000;
                return this.copilotSessionToken;
            } finally {
                this.tokenPromise = null;
            }
        })();

        return this.tokenPromise;
    }

    private async detectAccountType(authHeaderToken: string) {
        const usageRes = await fetch('https://api.github.com/copilot_internal/user', {
            headers: {
                'Authorization': `token ${authHeaderToken}`,
                'Accept': 'application/json',
                'User-Agent': USER_AGENT
            }
        });
        if (usageRes.ok) {
            const usageData = await usageRes.json() as CopilotUsageData;
            this.accountType = usageData.copilot_plan ?? 'individual';
            this.logInfo(`Detected Plan: ${this.accountType} -> Endpoint: ${this.getBaseUrl()}`);
        }
    }

    private async fetchCopilotV2Token(authHeaderToken: string) {
        return await fetch('https://api.github.com/copilot_internal/v2/token', {
            headers: {
                'Authorization': `token ${authHeaderToken}`,
                'Accept': 'application/json',
                'Editor-Version': `vscode/${this.vsCodeVersion}`,
                'Editor-Plugin-Version': EDITOR_PLUGIN_VERSION,
                'User-Agent': USER_AGENT,
                'X-GitHub-Api-Version': API_VERSION,
            }
        });
    }

    private async handleTokenFetchFailure(response: Response, authHeaderToken: string): Promise<string> {
        if (response.status === 404) {
            this.logWarn('v2/token 404, attempting fallback to v1/token');
            const v1Response = await fetch('https://api.github.com/copilot_internal/token', {
                headers: {
                    'Authorization': `token ${authHeaderToken}`,
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
                this.tokenExpiresAt = (data.expires_at ?? (Date.now() / 1000 + 1200)) * 1000;
                return this.copilotSessionToken;
            }

            const v1ErrorText = await v1Response.text();
            this.logError(`v1 fallback failed: ${v1Response.status} ${v1ErrorText}`);
            if (v1Response.status === 404) {
                this.logError('Token appears invalid (404 on both endpoints). Please re-login.');
            }
        }

        const errorText = await response.text();
        this.handleAuthStatusError(response.status, authHeaderToken);
        throw new Error(`Failed to get Copilot token: ${response.status} ${errorText}`);
    }

    private handleAuthStatusError(status: number, authHeaderToken: string) {
        if (status === 401) {
            this.logWarn('Token unauthorized (401). Clearing token.');
            if (authHeaderToken === this.copilotAuthToken) {
                this.copilotAuthToken = null;
            } else {
                this.githubToken = null;
            }
            this.copilotSessionToken = null;
            if (this.authService) {
                void this.authService.unlinkAllForProvider('copilot_token');
            }
        } else if (status === 404) {
            this.logError('Token not found (404). Please re-login.');
        }
    }

    private getBaseUrl(): string {
        if (this.accountType === 'individual') {
            return 'https://api.githubcopilot.com';
        }
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
        if (!tools || tools.length === 0) {
            return undefined;
        }
        return tools.map(tool => {
            // GitHub Copilot may not support full OpenAI function calling spec
            // Remove 'required' field if it causes issues
            const params = tool.function.parameters ? { ...tool.function.parameters as JsonObject } : {};
            if (params.required) {
                delete params.required;
            }

            return {
                type: 'function',
                function: {
                    name: tool.function.name,
                    description: tool.function.description ?? '',
                    parameters: params
                }
            };
        });
    }

    private parseDiagnosticResponse(data: DiagnosticResponse): Message {
        const responseData = data.response ?? data;
        const outputItems = Array.isArray(responseData.output) ? responseData.output : [];

        const toolCalls: ToolCall[] = outputItems
            .filter((item): item is DiagnosticOutputItem & { type: 'function_call'; name: string; arguments: string } =>
                typeof item === 'object' && item.type === 'function_call' && typeof item.name === 'string' && typeof item.arguments === 'string'
            )
            .map(item => ({
                id: item.id ?? randomUUID(),
                type: 'function',
                function: {
                    name: item.name,
                    arguments: item.arguments
                }
            }));

        let contentText: string | null = null;
        if (typeof responseData.output_text === 'string') {
            contentText = responseData.output_text;
        } else if (typeof responseData.text === 'string') {
            contentText = responseData.text;
        } else if (outputItems.length > 0) {
            contentText = outputItems
                .filter((item) => typeof item === 'string' || (typeof item === 'object' && item.type !== 'function_call'))
                .map((item) => {
                    if (typeof item === 'string') {
                        return item;
                    }
                    if (typeof item === 'object') {
                        return item.text ?? item.content ?? JSON.stringify(item);
                    }
                    return '';
                })
                .join('');
        }

        const message: Message = {
            id: randomUUID(),
            role: 'assistant',
            content: contentText ?? `[Unknown format] ${JSON.stringify(responseData).substring(0, 100)}`,
            timestamp: new Date()
        };
        if (toolCalls.length > 0) {
            message.toolCalls = toolCalls;
        }
        return message;
    }

    private parseChatResponse(json: CopilotChatResponse): Message {
        const firstChoice = json.choices.length > 0 ? json.choices[0] : null;
        if (firstChoice) {
            return firstChoice.message;
        }

        if (json.type === 'message' && Array.isArray(json.content)) {
            const contentArr = json.content;
            const textContent = contentArr.map((item) => (typeof item === 'string' ? item : item.text ?? '')).join('');
            return {
                id: randomUUID(),
                role: 'assistant',
                content: textContent,
                timestamp: new Date()
            };
        }

        if (json.output_text) {
            return { id: randomUUID(), role: 'assistant', content: json.output_text, timestamp: new Date() };
        }
        if (typeof json.content === 'string') {
            return { id: randomUUID(), role: 'assistant', content: json.content, timestamp: new Date() };
        }

        return { id: randomUUID(), role: 'assistant', content: JSON.stringify(json), timestamp: new Date() };
    }

    private formatCodexPrompt(messages: Message[]): string {
        return messages.map(msg => {
            const role = msg.role === 'user' ? 'User' : (msg.role === 'system' ? 'System' : 'Assistant');
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return `${role}: ${content}`;
        }).join('\n') + '\nAssistant:';
    }

    private async tryGatewayRequest(options: {
        gateway: string;
        endpoint: string;
        finalModel: string;
        prompt: string;
        headers: Record<string, string>;
        chatPayload: CopilotPayload;
        completionPayload: CopilotPayload;
        stream: boolean;
        tools?: ToolDefinition[];
    }): Promise<Message | ReadableStream<Uint8Array> | null> {
        const { gateway, endpoint, finalModel, prompt, headers, chatPayload, completionPayload, stream, tools } = options;
        const url = `${gateway}${endpoint}`;
        try {
            const isChatPath = endpoint.includes('/chat/');
            const isResponsesPath = endpoint === '/responses';

            const { payload, headers: currentHeaders } = this.prepareGatewayRequest({
                endpoint, finalModel, prompt, stream, tools, headers, chatPayload, completionPayload
            });

            const res = await fetch(url, {
                method: 'POST',
                headers: currentHeaders,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                return await this.handleGatewayResponse(res, isResponsesPath, isChatPath, stream);
            }
        } catch (error) {
            this.logInfo(`Gateway ${gateway} endpoint ${endpoint} failed: ${getErrorMessage(error as Error)}`);
        }
        return null;
    }

    private prepareGatewayRequest(options: {
        endpoint: string;
        finalModel: string;
        prompt: string;
        stream: boolean;
        tools: ToolDefinition[] | undefined;
        headers: Record<string, string>;
        chatPayload: CopilotPayload;
        completionPayload: CopilotPayload;
    }): { payload: CopilotPayload; headers: Record<string, string> } {
        const { endpoint, finalModel, prompt, stream, tools, headers, chatPayload, completionPayload } = options;
        const isResponsesPath = endpoint === '/responses';
        const isChatPath = endpoint.includes('/chat/');
        const currentHeaders = { ...headers };
        let currentPayload: CopilotPayload;

        if (isResponsesPath) {
            currentPayload = {
                model: finalModel,
                input: prompt.replace(/Assistant:$/, ''),
                stream
            };
            currentHeaders['Openai-Intent'] = 'conversation-panel';
            if (tools && tools.length > 0) {
                currentPayload.tools = this.prepareTools(tools);
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

        return { payload: currentPayload, headers: currentHeaders };
    }

    private async handleGatewayResponse(
        res: Response,
        isResponsesPath: boolean,
        isChatPath: boolean,
        stream: boolean
    ): Promise<Message | ReadableStream<Uint8Array> | null> {
        if (stream && res.body) {
            return res.body;
        }

        if (isResponsesPath) {
            const data = await res.json() as DiagnosticResponse;
            return this.parseDiagnosticResponse(data);
        }

        return await this.parseStandardGatewayResponse(res, isChatPath);
    }

    private async parseStandardGatewayResponse(res: Response, isChatPath: boolean): Promise<Message | null> {
        const json = await res.json() as CopilotChatResponse;
        const choice = json.choices[0];
        if (isChatPath) {
            return choice.message;
        }

        return {
            id: randomUUID(),
            role: 'assistant',
            content: choice.text?.trim() ?? '',
            timestamp: new Date()
        };
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
                const result = await this.tryGatewayRequest({
                    gateway,
                    endpoint,
                    finalModel,
                    prompt,
                    headers,
                    chatPayload,
                    completionPayload,
                    stream,
                    tools
                });
                if (result) {
                    return result;
                }
            }
        }
        return null;
    }

    private resolveCopilotModel(model: string): string {
        if (model.startsWith('copilot-')) { return model.replace('copilot-', ''); }
        if (model.startsWith('github-')) { return model.replace('github-', ''); }
        return model;
    }

    private async prepareChatRequest(
        messages: Message[],
        model: string,
        stream: boolean,
        tools?: ToolDefinition[]
    ): Promise<{
        headers: Record<string, string>;
        payload: CopilotPayload;
        finalModel: string;
    }> {
        const token = await this.ensureCopilotToken();
        const hasImages = messages.some(m => {
            if (Array.isArray(m.content)) {
                return m.content.some(c => c.type === 'image_url');
            }
            return false;
        });

        const finalModel = this.resolveCopilotModel(model);
        const isAgentCall = messages.some(msg => ['assistant', 'tool'].includes(msg.role));
        const headers = this.getHeaders(token, hasImages);
        headers['X-Initiator'] = isAgentCall ? 'agent' : 'user';

        const payload: CopilotPayload = {
            messages,
            model: finalModel,
            stream,
            temperature: 0.7
        };

        const preparedTools = this.prepareTools(tools);
        if (preparedTools && preparedTools.length > 0) {
            payload.tools = preparedTools;
            payload.tool_choice = 'auto';
        }

        if (stream) {
            // measurable impact? unsure, but standard OpenAI supports it
            payload.stream_options = { include_usage: true };
        }

        return { headers, payload, finalModel };
    }

    private async handleCopilotError(params: {
        response: Response;
        finalModel: string;
        messages: Message[];
        headers: Record<string, string>;
        payload: CopilotPayload;
        stream: boolean;
        tools?: ToolDefinition[];
    }): Promise<Message | ReadableStream<Uint8Array> | null> {
        const { response, finalModel, messages, headers, payload, stream, tools } = params;
        const errText = await response.text();

        if (this.shouldRequestDiagnostic(response, finalModel, errText)) {
            const result = await this.diagnosticCodexRequest(messages, finalModel, headers, stream, tools);
            if (result) { return result; }
        }

        if (response.status === 404 && this.accountType === 'individual') {
            return await this.tryBusinessFallback(headers, payload, stream);
        }
        throw new Error(`Copilot API Error: ${response.status} - ${errText}`);
    }

    private shouldRequestDiagnostic(response: Response, finalModel: string, errText: string): boolean {
        const errorBody = safeJsonParse(errText, { error: { code: '' } }) as { error?: { code?: string } };

        const isUnsupported = errorBody.error?.code === 'unsupported_api_for_model';
        const isCodexError = response.status === 400 && finalModel.toLowerCase().includes('codex');
        return isUnsupported || isCodexError;
    }

    private async tryBusinessFallback(headers: Record<string, string>, payload: CopilotPayload, stream: boolean): Promise<Message | ReadableStream<Uint8Array> | null> {
        const bizRes = await fetch('https://api.business.githubcopilot.com/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        if (bizRes.ok) {
            if (stream) { return bizRes.body; }
            const json = await bizRes.json() as CopilotChatResponse;
            return json.choices[0].message;
        }
        return null;
    }

    private async executeChatRequest(
        messages: Message[],
        model: string,
        tools: ToolDefinition[] | undefined,
        stream: boolean
    ): Promise<Message | ReadableStream<Uint8Array> | null> {
        await this.checkRateLimit(true);
        if (this.remainingCalls <= 0) {
            this.notificationService?.showNotification(
                'Copilot Request Blocked',
                'GitHub API rate limit is exhausted. Please wait for reset.',
                false
            );
            throw new Error('GitHub API rate limit exhausted');
        }

        const { headers, payload, finalModel } = await this.prepareChatRequest(messages, model, stream, tools);

        const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            return this.handleCopilotError({ response, finalModel, messages, headers, payload, stream, tools });
        }

        if (stream) {
            return response.body;
        }

        const json = await response.json() as CopilotChatResponse;
        return this.parseChatResponse(json);
    }

    async chat(messages: Message[], model: string = 'gpt-4o', tools?: ToolDefinition[]): Promise<Message | null> {
        try {
            const result = await this.executeChatRequest(messages, model, tools, false);
            if (result && !(result instanceof ReadableStream)) {
                return result as Message;
            }
            // Should not happen if stream is false
            return null;
        } catch (error) {
            this.handleError(error as Error, 'chat');
            return null;
        }
    }

    async streamChat(messages: Message[], model: string, tools?: ToolDefinition[]): Promise<ReadableStream<Uint8Array> | null> {
        try {
            const result = await this.executeChatRequest(messages, model, tools, true);
            if (result instanceof ReadableStream) {
                return result;
            }
            // Should not happen if stream is true, unless diagnosticCodexRequest returned a Message
            if (result) {
                // Convert Message to Stream? Or return null?
                // diagnosticCodexRequest might return a Message even if stream=true if it fell back to a non-streaming endpoint or parsed internal response
                // But for now let's return null to be safe or log warning
                this.logWarn('streamChat received non-stream response');
                return null;
            }
            return null;
        } catch (error) {
            this.handleError(error as Error, 'streamChat');
            return null;
        }
    }


    private handleError(error: Error | string | unknown, context: string): never {
        const message = getErrorMessage(error as Error);
        console.error(`[CopilotService] Error in ${context}:`, message);
        if (error instanceof Error) { throw error; }
        throw new Error(`Error in ${context}: ${message}`);
    }
}
