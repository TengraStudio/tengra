/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CircuitBreaker } from '@main/core/circuit-breaker';
import { appLogger } from '@main/logging/logger';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { HttpRequestOptions, HttpService } from '@main/services/external/http.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { TokenService } from '@main/services/security/token.service';
import { ChatMessage, OpenAIResponse, ToolCall } from '@main/types/llm.types';
import { MessageNormalizer } from '@main/utils/message-normalizer.util';
import { StreamChunk, StreamParser } from '@main/utils/stream-parser.util';
import { XmlToolParser } from '@main/utils/xml-tool-parser.util';
import { Message, SystemMode, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import {
    OpenAIChatCompletion,
    OpenAIContentPartImage,
    OpenAIMessage,
} from '@shared/types/llm-provider-types';
import { ApiError, AppErrorCode, getErrorMessage } from '@shared/utils/error.util';
import { Agent } from 'undici';

import { applyReasoningEffort } from './llm-reasoning.service';

/** Configuration required by LLMOpenAIChatService. */
export interface OpenAIChatDeps {
    httpService: HttpService;
    keyRotationService: KeyRotationService;
    tokenService?: TokenService;
}

/** Options for building an OpenAI request body. */
export interface OpenAIBodyOptions {
    model: string;
    tools?: ToolDefinition[];
    provider?: string;
    stream?: boolean;
    n?: number;
    temperature?: number;
    systemMode?: SystemMode;
    reasoningEffort?: string;
    workspaceRoot?: string;
    accountId?: string;
}

/** Request context for OpenAI-compatible calls. */
export interface OpenAIRequestContext {
    endpoint: string;
    apiKey: string;
    signal?: AbortSignal;
    provider?: string;
    includeProviderHint?: boolean;
    workspaceRoot?: string;
    accountId?: string;
}

const OPENAI_RETRY_POLICY = {
    requestRetryCount: 2,
} as const;

const PROVIDER_DEFAULT_MAX_TOKENS: Record<string, number> = {
    nvidia: 4096,
    huggingface: 16384,
    'local-ai': 4096,
    opencode: 32768,
};

const ERROR_CODES = {
    OPENAI_HTTP_FAILURE: 'LLM_OPENAI_HTTP_FAILURE',
    OPENAI_STREAM_FAILURE: 'LLM_OPENAI_STREAM_FAILURE',
} as const;

const normalizeToolCalls = (toolCalls: OpenAIMessage['tool_calls']): ToolCall[] | undefined => {
    if (!toolCalls) {
        return undefined;
    }

    return toolCalls.map((toolCall, index) => ({
        id: toolCall.id && toolCall.id.trim().length > 0
            ? toolCall.id
            : `${toolCall.function.name || 'tool'}-${index}`,
        type: 'function',
        function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
            thought_signature: toolCall.function.thought_signature,
        },
    }));
};

/** Stream chunk yield type for OpenAI streaming. */
export interface OpenAIStreamYield {
    content?: string;
    reasoning?: string;
    images?: string[];
    tool_calls?: ToolCall[];
    type?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    index?: number;
}

/**
 * Handles OpenAI-compatible chat completions (both streaming and non-streaming).
 */
export class LLMOpenAIChatService {
    private imagePersistence: ImagePersistenceService;

    constructor(
        private deps: OpenAIChatDeps,
        private breaker: CircuitBreaker,
        private getNormalizedModelName: (model: string, provider?: string) => string,
        private getDispatcher: () => Agent | null
    ) {
        this.imagePersistence = new ImagePersistenceService();
    }

    /**
     * Executes a non-streaming OpenAI chat completion.
     * @param messages - Prepared messages array.
     * @param options - Body build options.
     * @param requestContext - Endpoint/auth context for the request.
     */
    async executeChat(
        messages: Array<Message | ChatMessage>,
        options: OpenAIBodyOptions,
        requestContext: OpenAIRequestContext
    ): Promise<OpenAIResponse> {
        const { endpoint, apiKey, signal, provider, includeProviderHint, workspaceRoot, accountId } = requestContext;
        const body = this.buildOpenAIBody(messages, options);
        if (includeProviderHint && provider) {
            body.provider = provider;
        }
        if (includeProviderHint && typeof workspaceRoot === 'string' && workspaceRoot.trim().length > 0) {
            body.workspaceRoot = workspaceRoot;
        }
        if (includeProviderHint && typeof accountId === 'string' && accountId.trim().length > 0) {
            body.metadata = {
                ...(body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, RuntimeValue> : {}),
                accountId,
            };
        }
        const requestInit = this.createOpenAIRequest(body, apiKey);
        if (signal) { requestInit.signal = signal; }

        const response = await this.breaker.execute(() =>
            this.deps.httpService.fetch(endpoint, {
                ...requestInit,
                retryCount: OPENAI_RETRY_POLICY.requestRetryCount,
                timeoutMs: 300000
            } as HttpRequestOptions)
        );

        if (response.status === 429) {
            const errorText = await response.clone().text();
            const resetMatch = errorText.match(/reset after (\d+)s/i);
            const waitTime = resetMatch ? parseInt(resetMatch[1], 10) * 1000 : 2000;
            
            appLogger.warn('LLMOpenAIChatService', `Rate limited (429). Retrying after ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            return this.executeChat(messages, options, requestContext);
        }

        if (!response.ok) {
            await this.handleOpenAIError(response);
        }

        const json = await response.json() as OpenAIChatCompletion;
        return this.processOpenAIResponse(json);
    }

    /**
     * Executes a streaming OpenAI chat completion.
     * @param messages - Prepared messages array.
     * @param options - Body build options.
     * @param requestContext - Endpoint/auth context for the request.
     */
    async *executeChatStream(
        messages: Array<Message | ChatMessage>,
        options: OpenAIBodyOptions,
        requestContext: OpenAIRequestContext
    ): AsyncGenerator<OpenAIStreamYield> {
        const { endpoint, apiKey, signal, provider, includeProviderHint, workspaceRoot, accountId } = requestContext;
        const body = this.buildOpenAIBody(messages, options);
        if (includeProviderHint && provider) {
            body.provider = provider;
        }
        if (includeProviderHint && typeof workspaceRoot === 'string' && workspaceRoot.trim().length > 0) {
            body.workspaceRoot = workspaceRoot;
        }
        if (includeProviderHint && typeof accountId === 'string' && accountId.trim().length > 0) {
            body.metadata = {
                ...(body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, RuntimeValue> : {}),
                accountId,
            };
        }
        const acceptHeader = provider === 'nvidia' ? 'application/json' : 'text/event-stream';
        const requestInit = this.createOpenAIRequest(body, apiKey, { 'Accept': acceptHeader });
        if (signal) { requestInit.signal = signal; }

        const response = await this.deps.httpService.fetch(endpoint, {
            ...requestInit,
            retryCount: OPENAI_RETRY_POLICY.requestRetryCount,
            timeoutMs: 300000
        });

        if (response.status === 429) {
            const errorText = await response.clone().text();
            const resetMatch = errorText.match(/reset after (\d+)s/i);
            const waitTime = resetMatch ? parseInt(resetMatch[1], 10) * 1000 : 1000;
            
            appLogger.warn('LLMOpenAIChatService', `Rate limited (429) in stream. Retrying after ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            yield* this.executeChatStream(messages, options, requestContext);
            return;
        }

        if (!response.ok) {
            await this.handleOpenAIStreamError(response, options.model, provider);
        }

        yield* this.handleStreamResponse(response);
    }

    /**
     * Builds the OpenAI-compatible request body.
     * @param messages - The chat messages.
     * @param options - Build options.
     */
    buildOpenAIBody(messages: Array<Message | ChatMessage>, options: OpenAIBodyOptions): Record<string, RuntimeValue> {
        const { model, tools, provider, stream = false, n = 1, temperature, systemMode, reasoningEffort } = options;
        const normalizedMessages = MessageNormalizer.normalizeOpenAIMessages(messages, model);
        const finalModel = this.getNormalizedModelName(model, provider);

        const body: Record<string, RuntimeValue> = {
            model: finalModel,
            messages: normalizedMessages,
            stream
        };

        applyReasoningEffort(body, finalModel, systemMode, reasoningEffort);
        this.applyStreamOptions(body, stream, provider);
        this.applyOptionalOpenAIParams(body, n, provider, temperature);
        this.applyTools(body, tools);

        return body;
    }

    /**
     * Creates a fetch-compatible request init object for OpenAI endpoints.
     * @param body - The JSON body.
     * @param apiKey - The API key.
     * @param extraHeaders - Additional headers to include.
     */
    createOpenAIRequest(body: RuntimeValue, apiKey: string, extraHeaders: Record<string, string> = {}): RequestInit & { dispatcher?: Agent } {
        const dispatcher = this.getDispatcher();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...extraHeaders
        };

        const requestInit: RequestInit & { dispatcher?: Agent } = {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        };
        if (dispatcher) { requestInit.dispatcher = dispatcher; }
        return requestInit;
    }

    /**
     * Processes a non-streaming OpenAI chat completion response.
     * @param json - The parsed OpenAI response.
     */
    async processOpenAIResponse(json: OpenAIChatCompletion): Promise<OpenAIResponse> {
        if (json.choices.length > 0) {
            const choice = json.choices[0];
            const message = choice.message;

            let completion = this.extractTextFromOpenAIMessage(message);
            const variantSummaries = await this.extractVariantsFromChoices(json.choices, json.model);

            // [NEW] XML Tool Call Fallback
            const parsed = XmlToolParser.parse(completion);
            if (parsed.toolCalls.length > 0) {
                appLogger.info('LLMOpenAIChatService', `Extracted ${parsed.toolCalls.length} XML tool calls from completion`);
                message.tool_calls = [
                    ...(message.tool_calls || []),
                    ...parsed.toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function' as const,
                        function: {
                            name: tc.function.name,
                            arguments: tc.function.arguments
                        }
                    }))
                ];
                completion = parsed.cleanedText;
            }

            const validatedCompletion = completion;
            const savedImages = await this.saveImagesFromOpenAIMessage(message);

            const result: OpenAIResponse = {
                content: validatedCompletion,
                role: message.role,
                images: savedImages,
                variants: variantSummaries.length > 1 ? variantSummaries : undefined
            };

            if (message.tool_calls) { result.tool_calls = normalizeToolCalls(message.tool_calls); }
            if (json.usage) {
                result.promptTokens = json.usage.prompt_tokens;
                result.completionTokens = json.usage.completion_tokens;
                result.totalTokens = json.usage.total_tokens;
            }

            const reasoning = message.reasoning_content ?? message.reasoning;
            if (reasoning) { result.reasoning_content = reasoning; }

            return result;
        }
        throw new ApiError('No choices returned from model', 'openai', 200, false);
    }

    /**
     * Processes a single stream chunk, saving any embedded images.
     * @param chunk - The parsed stream chunk.
     */
    async processStreamChunk(chunk: StreamChunk): Promise<OpenAIStreamYield> {
        const savedImages = await this.saveImagesFromStreamChunk(chunk.images);
        return {
            ...(chunk.index !== undefined ? { index: chunk.index } : {}),
            ...(chunk.content ? { content: chunk.content } : {}),
            ...(chunk.reasoning ? { reasoning: chunk.reasoning } : {}),
            images: savedImages,
            ...(chunk.type ? { type: chunk.type } : {}),
            ...(chunk.tool_calls ? { tool_calls: chunk.tool_calls } : {}),
            ...(chunk.usage ? { usage: chunk.usage } : {})
        };
    }

    /**
     * Handles a non-streaming OpenAI error response.
     * @param response - The failed HTTP response.
     */
    async handleOpenAIError(response: Response): Promise<never> {
        const errorText = await response.text();
        if (response.status === 401 || response.status === 403) {
            this.deps.keyRotationService.rotateKey('openai');
        }
        throw new ApiError(
            errorText || `HTTP ${response.status}`,
            'openai',
            response.status,
            response.status >= 500 || response.status === 429,
            {
                code: ERROR_CODES.OPENAI_HTTP_FAILURE,
                appCode: AppErrorCode.API_ERROR,
            }
        );
    }

    /**
     * Handles a streaming OpenAI error response.
     * @param response - The failed HTTP response.
     * @param model - The model identifier.
     * @param provider - The provider name.
     */
    async handleOpenAIStreamError(response: Response, model: string, provider?: string): Promise<never> {
        const errorText = await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403) {
            this.deps.keyRotationService.rotateKey('openai');
        }

        if (response.status === 429) {
            this.logDetailedQuotaError(model, provider, errorText);
        }

        throw new ApiError(
            errorText || `HTTP ${response.status}`,
            'openai-stream',
            response.status,
            response.status >= 500 || response.status === 429,
            {
                code: ERROR_CODES.OPENAI_STREAM_FAILURE,
                appCode: AppErrorCode.API_ERROR,
            }
        );
    }

    // --- Private helpers ---

    private applyStreamOptions(body: Record<string, RuntimeValue>, stream: boolean, provider?: string): void {
        if (stream && provider !== 'nvidia') {
            body.stream_options = { include_usage: true };
        }
    }

    private applyOptionalOpenAIParams(body: Record<string, RuntimeValue>, n: number, provider?: string, temperature?: number): void {
        if (temperature !== undefined) {
            body.temperature = temperature;
        }
        if (n > 1) {
            body.n = n;
        }
        const normalizedProvider = (provider ?? '').toLowerCase();
        if (body.max_tokens === undefined) {
            const providerDefault = PROVIDER_DEFAULT_MAX_TOKENS[normalizedProvider];
            if (providerDefault !== undefined) {
                body.max_tokens = providerDefault;
            }
        }
    }

    private applyTools(body: Record<string, RuntimeValue>, tools?: ToolDefinition[]): void {
        if (tools && tools.length > 0) {
            body.tools = this.sanitizeTools(tools);
            body.tool_choice = 'auto';
        }
    }

    private sanitizeTools(tools: ToolDefinition[]): RuntimeValue[] {
        return tools.map(tool => {
            const params = tool.function.parameters ? { ...tool.function.parameters as JsonObject } : {};
            // AGT-LLM-01: DO NOT delete mandatory 'required' parameters.
            // Models rely on this to know which arguments are necessary.
            // if (params.required) {
            //    delete params.required;
            // }
            return {
                ...tool,
                function: {
                    ...tool.function,
                    parameters: params
                }
            };
        });
    }

    private async *handleStreamResponse(response: Response): AsyncGenerator<OpenAIStreamYield> {
        try {
            for await (const chunk of StreamParser.parseChatStream(response)) {
                const processedChunk = await this.processStreamChunk(chunk);
                yield processedChunk;
            }
        } catch (e) {
            appLogger.error('LLMOpenAIChatService', `Stream Loop Error: ${getErrorMessage(e as Error)}`);
            throw e;
        }
    }


    private extractTextFromOpenAIMessage(message: OpenAIMessage): string {
        if (typeof message.content === 'string') {
            return message.content;
        }
        if (Array.isArray(message.content)) {
            return message.content
                .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                .map(part => part.text)
                .join('');
        }
        return '';
    }

    private async saveImagesFromOpenAIMessage(message: OpenAIMessage): Promise<string[]> {
        const contentParts = Array.isArray(message.content) ? message.content : [];
        const rawImages: Array<string | OpenAIContentPartImage> = [];

        for (const part of contentParts) {
            if (part.type === 'image_url') {
                rawImages.push(part);
            }
        }

        if (Array.isArray(message.images)) {
            for (const image of message.images) {
                if (typeof image === 'string') {
                    rawImages.push(image);
                    continue;
                }
                if (image?.type === 'image_url' && image.image_url?.url) {
                    rawImages.push(image);
                }
            }
        }

        return this.saveRawImages(rawImages);
    }

    private async saveRawImages(rawImages: Array<string | OpenAIContentPartImage>): Promise<string[]> {
        const savedImages: string[] = [];
        if (rawImages.length > 0) {
            await Promise.all(rawImages.map(async (img) => {
                const url = typeof img === 'string' ? img : img.image_url.url;
                if (url) {
                    try {
                        const localPath = await this.imagePersistence.saveImage(url);
                        savedImages.push(localPath);
                    } catch (e) {
                        appLogger.warn('LLMOpenAIChatService', `Failed to save image: ${getErrorMessage(e as Error)}`);
                    }
                }
            }));
        }
        return savedImages;
    }

    private async saveImagesFromStreamChunk(images: Array<string | { image_url: { url: string } }> | undefined): Promise<string[]> {
        if (!images || images.length === 0) { return []; }

        const savedImages: string[] = [];
        await Promise.all(images.map(async (img) => {
            const url = (typeof img === 'string') ? img : img.image_url.url;
            if (url) {
                try {
                    const localPath = await this.imagePersistence.saveImage(url);
                    savedImages.push(localPath);
                } catch (e) {
                    appLogger.warn('LLMOpenAIChatService', `Failed to save image in stream: ${getErrorMessage(e as Error)}`);
                }
            }
        }));
        return savedImages;
    }

    private async extractVariantsFromChoices(choices: OpenAIChatCompletion['choices'], model: string) {
        return Promise.all(choices.map(async (c) => {
            const cMsg = c.message;
            const cContent = this.extractTextFromOpenAIMessage(cMsg);
            return {
                content: cContent,
                role: cMsg.role,
                model
            };
        }));
    }

    private logDetailedQuotaError(model: string, provider: string | undefined, errorText: string): void {
        appLogger.error('LLMOpenAIChatService', `429 Error for model ${model}, provider ${provider}`);
        appLogger.error('LLMOpenAIChatService', `Error details: ${errorText}`);

        try {
            if (typeof errorText === 'string' && errorText.includes('quota')) {
                appLogger.warn('LLMOpenAIChatService', 'Possible quota exhaustion detected despite individual model capacity.');
            }
        } catch {
            // Not JSON parseable
        }
    }
}
