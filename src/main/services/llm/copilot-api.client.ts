import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { Message, ToolDefinition } from '@shared/types/chat';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

import {
    COPILOT_DEFAULT_MAX_TOKENS,
    COPILOT_DEFAULT_TEMPERATURE,
    COPILOT_GATEWAY_BUSINESS,
    COPILOT_GATEWAY_DEFAULT,
    COPILOT_GATEWAY_INDIVIDUAL,
    CopilotChatResponse,
    CopilotNotificationService,
    CopilotPayload,
    CopilotState,
    DiagnosticResponse,
    GatewayRequestOptions
} from './copilot.types';
import { CopilotRateLimitManager } from './copilot-rate-limit.manager';
import { CopilotRequestBuilder } from './copilot-request.builder';
import { CopilotResponseParser } from './copilot-response.parser';
import { CopilotTokenManager } from './copilot-token.manager';

const SERVICE_NAME = 'CopilotApiClient';

/**
 * Handles Copilot API communication including chat, streaming, and gateway fallbacks.
 */
/** Options for constructing a CopilotApiClient. */
interface CopilotApiClientOptions {
    state: CopilotState;
    tokenManager: CopilotTokenManager;
    rateLimitManager: CopilotRateLimitManager;
    requestBuilder: CopilotRequestBuilder;
    responseParser: CopilotResponseParser;
    notificationService?: CopilotNotificationService;
}

export class CopilotApiClient {
    private state: CopilotState;
    private tokenManager: CopilotTokenManager;
    private rateLimitManager: CopilotRateLimitManager;
    private requestBuilder: CopilotRequestBuilder;
    private responseParser: CopilotResponseParser;
    private notificationService?: CopilotNotificationService;

    constructor(options: CopilotApiClientOptions) {
        this.state = options.state;
        this.tokenManager = options.tokenManager;
        this.rateLimitManager = options.rateLimitManager;
        this.requestBuilder = options.requestBuilder;
        this.responseParser = options.responseParser;
        this.notificationService = options.notificationService;
    }

    /** Sends a non-streaming chat request */
    async chat(messages: Message[], model: string = 'gpt-4o', tools?: ToolDefinition[]): Promise<Message | null> {
        try {
            const result = await this.executeChatRequest(messages, model, tools, false);
            if (result && !(result instanceof ReadableStream)) {
                return result as Message;
            }
            return null;
        } catch (error) {
            this.handleError(error as Error, 'chat');
            return null;
        }
    }

    /** Sends a streaming chat request */
    async streamChat(messages: Message[], model: string, tools?: ToolDefinition[]): Promise<ReadableStream<Uint8Array> | null> {
        try {
            const result = await this.executeChatRequest(messages, model, tools, true);
            if (result instanceof ReadableStream) {
                return result;
            }
            if (result) {
                appLogger.warn(SERVICE_NAME, 'streamChat received non-stream response');
                return null;
            }
            return null;
        } catch (error) {
            this.handleError(error as Error, 'streamChat');
            return null;
        }
    }

    /** Returns the base URL for the current account type */
    getBaseUrl(): string {
        if (this.state.accountType === 'individual') {
            return COPILOT_GATEWAY_DEFAULT;
        }
        return `https://api.${this.state.accountType}.githubcopilot.com`;
    }

    private async executeChatRequest(
        messages: Message[],
        model: string,
        tools: ToolDefinition[] | undefined,
        stream: boolean
    ): Promise<Message | ReadableStream<Uint8Array> | null> {
        return this.rateLimitManager.enqueueRequest(stream ? 'stream' : 'chat', async () => {
            await this.rateLimitManager.checkRateLimit(true);
            if (this.state.remainingCalls <= 0) {
                this.notificationService?.showNotification(
                    'Copilot Request Blocked',
                    'GitHub API rate limit is exhausted. Please wait for reset.',
                    false
                );
                throw new Error('GitHub API rate limit exhausted');
            }

            const token = await this.tokenManager.ensureCopilotToken();
            const { headers, payload, finalModel } = this.requestBuilder.buildChatPayload(messages, model, stream, token, tools);

            const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                return this.handleCopilotError({ response, finalModel, messages, headers, payload, stream, tools });
            }

            if (stream) { return response.body; }
            const json = await response.json() as CopilotChatResponse;
            return this.responseParser.parseChatResponse(json);
        });
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

        if (response.status === 404 && this.state.accountType === 'individual') {
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

    private async tryBusinessFallback(
        headers: Record<string, string>,
        payload: CopilotPayload,
        stream: boolean
    ): Promise<Message | ReadableStream<Uint8Array> | null> {
        const bizRes = await fetch(`${COPILOT_GATEWAY_BUSINESS}/chat/completions`, {
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

    private async diagnosticCodexRequest(
        messages: Message[],
        finalModel: string,
        headers: Record<string, string>,
        stream: boolean = false,
        tools?: ToolDefinition[]
    ): Promise<Message | ReadableStream<Uint8Array> | null> {
        const prompt = this.requestBuilder.formatCodexPrompt(messages);
        const completionPayload: CopilotPayload = {
            model: finalModel, prompt, stream,
            max_tokens: COPILOT_DEFAULT_MAX_TOKENS,
            temperature: COPILOT_DEFAULT_TEMPERATURE,
            stop: ['\nUser:', '\nSystem:']
        };
        const chatPayload: CopilotPayload = {
            model: finalModel, messages, stream, temperature: COPILOT_DEFAULT_TEMPERATURE
        };

        const gateways = [COPILOT_GATEWAY_INDIVIDUAL, COPILOT_GATEWAY_DEFAULT, COPILOT_GATEWAY_BUSINESS];
        const endpoints = ['/responses', '/v1/completions', '/completions', '/chat/completions', '/v1/chat/completions'];

        for (const gateway of gateways) {
            for (const endpoint of endpoints) {
                const result = await this.tryGatewayRequest({
                    gateway, endpoint, finalModel, prompt, headers, chatPayload, completionPayload, stream, tools
                });
                if (result) { return result; }
            }
        }
        return null;
    }

    private async tryGatewayRequest(options: GatewayRequestOptions): Promise<Message | ReadableStream<Uint8Array> | null> {
        const { gateway, endpoint, finalModel, prompt, headers, chatPayload, completionPayload, stream, tools } = options;
        const url = `${gateway}${endpoint}`;
        try {
            const isChatPath = endpoint.includes('/chat/');
            const isResponsesPath = endpoint === '/responses';

            const { payload, headers: currentHeaders } = this.prepareGatewayPayload({
                endpoint, finalModel, prompt, stream, tools, headers, chatPayload, completionPayload
            });

            const res = await fetch(url, { method: 'POST', headers: currentHeaders, body: JSON.stringify(payload) });

            if (res.ok) {
                return await this.handleGatewayResponse(res, isResponsesPath, isChatPath, stream);
            }
        } catch (error) {
            appLogger.info(SERVICE_NAME, `Gateway ${gateway} endpoint ${endpoint} failed: ${getErrorMessage(error as Error)}`);
        }
        return null;
    }

    private prepareGatewayPayload(options: {
        endpoint: string; finalModel: string; prompt: string; stream: boolean;
        tools: ToolDefinition[] | undefined; headers: Record<string, string>;
        chatPayload: CopilotPayload; completionPayload: CopilotPayload;
    }): { payload: CopilotPayload; headers: Record<string, string> } {
        const { endpoint, finalModel, prompt, stream, tools, headers, chatPayload, completionPayload } = options;
        const isResponsesPath = endpoint === '/responses';
        const isChatPath = endpoint.includes('/chat/');
        const currentHeaders = { ...headers };

        if (isResponsesPath) {
            const payload: CopilotPayload = { model: finalModel, input: prompt.replace(/Assistant:$/, ''), stream };
            currentHeaders['Openai-Intent'] = 'conversation-panel';
            if (tools && tools.length > 0) {
                payload.tools = this.requestBuilder.prepareTools(tools);
                payload.tool_choice = 'auto';
            }
            return { payload, headers: currentHeaders };
        }

        const payload = isChatPath ? chatPayload : completionPayload;
        currentHeaders['Openai-Intent'] = isChatPath ? 'conversation-panel' : 'completions';
        if (isChatPath && tools && tools.length > 0) {
            payload.tools = this.requestBuilder.prepareTools(tools);
            payload.tool_choice = 'auto';
        }
        return { payload, headers: currentHeaders };
    }

    private async handleGatewayResponse(
        res: Response, isResponsesPath: boolean, isChatPath: boolean, stream: boolean
    ): Promise<Message | ReadableStream<Uint8Array> | null> {
        if (stream && res.body) { return res.body; }

        if (isResponsesPath) {
            const data = await res.json() as DiagnosticResponse;
            return this.responseParser.parseDiagnosticResponse(data);
        }

        const json = await res.json() as CopilotChatResponse;
        const choice = json.choices[0];
        if (isChatPath) { return choice.message; }
        return { id: randomUUID(), role: 'assistant', content: choice.text?.trim() ?? '', timestamp: new Date() };
    }

    private handleError(error: Error | string | RuntimeValue, context: string): never {
        const message = getErrorMessage(error as Error);
        appLogger.error(SERVICE_NAME, `Error in ${context}: ${message}`);
        if (error instanceof Error) { throw error; }
        throw new Error(`Error in ${context}: ${message}`);
    }
}
