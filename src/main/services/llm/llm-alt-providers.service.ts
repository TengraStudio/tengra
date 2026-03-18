import { CircuitBreaker } from '@main/core/circuit-breaker';
import { appLogger } from '@main/logging/logger';
import { HttpService } from '@main/services/external/http.service';
import { filterContent } from '@main/services/llm/content-filter.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { ChatMessage, OpenAIResponse, ToolCall } from '@main/types/llm.types';
import { MessageNormalizer } from '@main/utils/message-normalizer.util';
import { StreamParser } from '@main/utils/stream-parser.util';
import { Message, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { ApiError, AuthenticationError, NetworkError } from '@shared/utils/error.util';
import { getErrorMessage } from '@shared/utils/error.util';

const GROQ_API_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

const DEFAULT_MODELS = {
    ANTHROPIC: 'claude-3-5-sonnet-20240620',
    GROQ: 'llama3-70b-8192',
} as const;

/** Dependencies for the alt providers service. */
export interface AltProvidersDeps {
    httpService: HttpService;
    keyRotationService: KeyRotationService;
    rateLimitService: RateLimitService;
}

/** API key getter callbacks for alternate LLM providers. */
export interface AltProviderKeyGetters {
    getAnthropicApiKey: () => string;
    getGroqApiKey: () => string;
    getNvidiaApiKey: () => string;
    getOpenCodeApiKey: () => string;
}

/** Stream yield type matching the facade signature. */
export interface AltStreamYield {
    content?: string;
    reasoning?: string;
    images?: string[];
    tool_calls?: ToolCall[];
    type?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/**
 * Service handling Anthropic, Groq, Nvidia, and OpenCode provider interactions.
 */
export class LLMAltProvidersService {
    constructor(
        private deps: AltProvidersDeps,
        private breakers: Record<string, CircuitBreaker>,
        private keyGetters: AltProviderKeyGetters
    ) {}

    // --- Anthropic ---

    /**
     * Sends a chat completion to the Anthropic API.
     * @param messages - The chat messages.
     * @param model - The Anthropic model to use.
     */
    async chatAnthropic(messages: Array<Message | ChatMessage>, model: string = DEFAULT_MODELS.ANTHROPIC): Promise<OpenAIResponse> {
        const key = this.deps.keyRotationService.getCurrentKey('anthropic') ?? this.keyGetters.getAnthropicApiKey();
        if (!key) { throw new AuthenticationError('Anthropic API Key not set'); }
        await this.deps.rateLimitService.waitForToken('anthropic');

        try {
            const body = this.buildAnthropicBody(messages, model);
            const response = await this.breakers.anthropic.execute(() =>
                this.deps.httpService.fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
                    body: JSON.stringify(body),
                    retryCount: 2
                })
            );
            return await this.handleAnthropicApiResponse(response);
        } catch (error) {
            throw this.handleAnthropicError(error ?? new Error('Unknown Anthropic Error'));
        }
    }

    // --- Groq ---

    /**
     * Sends a chat completion to the Groq API.
     * @param messages - The chat messages.
     * @param model - The Groq model to use.
     * @param buildOpenAIBody - Callback to build OpenAI-compatible body.
     */
    async chatGroq(
        messages: Array<Message | ChatMessage>,
        model: string = DEFAULT_MODELS.GROQ,
        buildOpenAIBody: (messages: Array<Message | ChatMessage>, options: { model: string; provider: string }) => Record<string, RuntimeValue>,
        processOpenAIResponse: (json: JsonObject) => Promise<OpenAIResponse>
    ): Promise<OpenAIResponse> {
        const key = this.getGroqKey();
        if (!key) { throw new AuthenticationError('Groq API Key not set'); }
        await this.deps.rateLimitService.waitForToken('groq');

        try {
            const body = buildOpenAIBody(messages, { model, provider: 'groq' });
            const response = await this.breakers.groq.execute(() =>
                this.deps.httpService.fetch(GROQ_API_BASE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify(body),
                    retryCount: 2
                })
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new ApiError(errorText, 'groq', response.status);
            }

            return await processOpenAIResponse(await response.json() as JsonObject);
        } catch (error) {
            throw this.handleGroqError(error ?? new Error('Unknown Groq Error'));
        }
    }

    // --- Nvidia ---

    /**
     * Returns the Nvidia API key.
     */
    getNvidiaKey(): string {
        const key = this.deps.keyRotationService.getCurrentKey('nvidia') ?? this.keyGetters.getNvidiaApiKey();
        if (!key) { throw new AuthenticationError('Nvidia API Key not set'); }
        return key;
    }

    /**
     * Returns the Groq API key.
     */
    getGroqKey(): string {
        const key = this.deps.keyRotationService.getCurrentKey('groq') ?? this.keyGetters.getGroqApiKey();
        if (!key) { throw new AuthenticationError('Groq API Key not set'); }
        return key;
    }

    // --- OpenCode ---

    /**
     * Sends a chat completion to the OpenCode API.
     * @param messages - The chat messages.
     * @param model - The model to use.
     * @param tools - Optional tool definitions.
     * @param chatOpenAI - Callback for OpenAI-compatible fallback.
     */
    async chatOpenCode(
        messages: Array<Message | ChatMessage>,
        model: string,
        tools: ToolDefinition[] | undefined,
        chatOpenAI: (messages: Array<Message | ChatMessage>, options: { model: string; tools?: ToolDefinition[]; baseUrl: string; apiKey: string; provider: string }) => Promise<OpenAIResponse>
    ): Promise<OpenAIResponse> {
        const apiKey = this.keyGetters.getOpenCodeApiKey();
        const baseUrl = 'https://opencode.ai/zen/v1';

        if (model === 'gpt-5-nano') {
            return this.executeOpenCodeGpt5Nano(messages, model, baseUrl, apiKey);
        }
        return chatOpenAI(messages, { model, tools: tools ?? undefined, baseUrl, apiKey, provider: 'opencode' });
    }

    /**
     * Streams a chat response from the OpenCode API.
     * @param messages - The chat messages.
     * @param model - The model to use.
     * @param tools - Optional tool definitions.
     * @param signal - Optional abort signal.
     * @param chatOpenAIStream - Callback for OpenAI-compatible streaming fallback.
     */
    async *chatOpenCodeStream(
        messages: Array<Message | ChatMessage>,
        model: string,
        tools: ToolDefinition[] | undefined,
        signal: AbortSignal | undefined,
        chatOpenAIStream: (messages: Array<Message | ChatMessage>, options: Record<string, RuntimeValue>) => AsyncGenerator<AltStreamYield>
    ): AsyncGenerator<AltStreamYield> {
        const apiKey = this.keyGetters.getOpenCodeApiKey();
        const baseUrl = 'https://opencode.ai/zen/v1';

        if (model === 'gpt-5-nano') {
            yield* this.handleOpenCodeZenStream(messages, model, apiKey, baseUrl, signal);
        } else {
            yield* chatOpenAIStream(messages, { model, tools, baseUrl, apiKey, provider: 'opencode', signal });
        }
    }

    /**
     * Parses an OpenCode Responses API JSON result.
     * @param json - The raw JSON object.
     */
    parseOpenCodeResponse(json: JsonObject): OpenAIResponse {
        const rawOutput = json['output'];
        const outputArray = Array.isArray(rawOutput) ? rawOutput : [rawOutput];
        const output = outputArray.find((o: RuntimeValue) => o && typeof o === 'object' && (o as JsonObject).type === 'message') as JsonObject | undefined;

        if (!output) {
            throw new ApiError('Unexpected response format from OpenCode', 'opencode', 200);
        }

        const { content, reasoning, tool_calls } = this.extractOpenCodeContent(output);
        const validatedContent = this.validateContent(content || (output['text'] as string) || '');

        return {
            content: validatedContent,
            role: 'assistant',
            reasoning_content: reasoning || undefined,
            tool_calls: tool_calls.length > 0 ? tool_calls : undefined
        } as OpenAIResponse;
    }

    // --- Private helpers ---

    private async executeOpenCodeGpt5Nano(
        messages: Array<Message | ChatMessage>,
        model: string,
        baseUrl: string,
        apiKey: string
    ): Promise<OpenAIResponse> {
        const endpoint = `${baseUrl}/responses`;
        const normalized = MessageNormalizer.normalizeOpenCodeResponsesMessages(messages);
        const body = { model, input: normalized, stream: false };

        const response = await this.breakers.openai.execute(() =>
            this.deps.httpService.fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(body),
                retryCount: 2
            })
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new ApiError(errorText || `HTTP ${response.status}`, 'opencode', response.status);
        }

        const json = await response.json() as JsonObject;
        return this.parseOpenCodeResponse(json);
    }

    private async *handleOpenCodeZenStream(
        messages: Array<Message | ChatMessage>,
        model: string,
        apiKey: string,
        baseUrl: string,
        signal?: AbortSignal
    ): AsyncGenerator<AltStreamYield> {
        const endpoint = `${baseUrl}/responses`;
        const normalized = MessageNormalizer.normalizeOpenCodeResponsesMessages(messages);
        const body = { model, input: normalized, stream: true };

        const response = await this.deps.httpService.fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            retryCount: 2,
            timeoutMs: 300000,
            signal
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new ApiError(errorText || `HTTP ${response.status}`, 'opencode-stream', response.status);
        }

        try {
            for await (const chunk of StreamParser.parseChatStream(response)) {
                const processedChunk: AltStreamYield = {
                    ...(chunk.content ? { content: this.validateContent(chunk.content) } : {}),
                    ...(chunk.reasoning ? { reasoning: chunk.reasoning } : {}),
                    ...(chunk.type ? { type: chunk.type } : {}),
                    ...(chunk.tool_calls ? { tool_calls: chunk.tool_calls } : {}),
                    ...(chunk.images ? { images: chunk.images.map(img => typeof img === 'string' ? img : img.image_url.url) } : {})
                };
                yield processedChunk;
            }
        } catch (e) {
            appLogger.error('LLMAltProvidersService', `[OpenCode] Stream Loop Error: ${getErrorMessage(e as Error)}`);
            throw e;
        }
    }

    private buildAnthropicBody(messages: Array<Message | ChatMessage>, model: string): Record<string, RuntimeValue> {
        const normalized = MessageNormalizer.normalizeAnthropicMessages(messages);
        const systemMessage = messages.find(m => m.role === 'system')?.content;

        const body: Record<string, RuntimeValue> = {
            model,
            messages: normalized,
            max_tokens: 4096
        };
        if (typeof systemMessage === 'string') { body.system = systemMessage; }
        return body;
    }

    private async handleAnthropicApiResponse(response: Response): Promise<OpenAIResponse> {
        const data = await response.json() as JsonObject;
        const error = data['error'] as JsonObject | undefined;
        if (error) {
            if (response.status === 401) { this.deps.keyRotationService.rotateKey('anthropic'); }
            throw new ApiError(
                (error['message'] as string) || 'Anthropic API Error',
                'anthropic',
                response.status,
                false,
                { type: error['type'] ?? null }
            );
        }
        const content = data['content'] as Array<{ text: string }> | undefined;
        const validatedContent = this.validateContent(content?.[0]?.text ?? '');
        return { content: validatedContent, role: 'assistant' };
    }

    private handleAnthropicError(error: RuntimeValue): Error {
        if (error instanceof ApiError || error instanceof AuthenticationError) { return error; }
        return new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'anthropic' });
    }

    private handleGroqError(error: RuntimeValue): Error {
        if (error instanceof ApiError || error instanceof AuthenticationError) { return error; }
        return new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'groq' });
    }

    private extractOpenCodeContent(output: JsonObject): { content: string; reasoning: string; tool_calls: ToolCall[] } {
        let content = '';
        let reasoning = '';
        const tool_calls: ToolCall[] = [];
        const rawContent = output['content'];

        if (Array.isArray(rawContent)) {
            for (const part of rawContent as JsonObject[]) {
                if (part['type'] === 'output_text') {
                    content += (part['text'] as string);
                } else if (part['type'] === 'reasoning' || part['type'] === 'summary_text') {
                    reasoning += (part['text'] as string);
                } else if (part['type'] === 'function_call' && part['function_call']) {
                    tool_calls.push(this.parseOpenCodeToolCall(part['function_call'] as JsonObject));
                }
            }
        }
        return { content, reasoning, tool_calls };
    }

    private parseOpenCodeToolCall(call: JsonObject): ToolCall {
        return {
            id: (call['id'] as string) || `call_${crypto.randomUUID().substring(0, 8)}`,
            type: 'function',
            function: {
                name: call['name'] as string,
                arguments: typeof call['arguments'] === 'string'
                    ? call['arguments']
                    : JSON.stringify(call['arguments'])
            }
        };
    }

    private validateContent(content: string): string {
        const result = filterContent(content);
        if (result.blocked) {
            appLogger.warn('LLMAltProvidersService', `Content filtering blocked: ${result.matchedPatterns.join(', ')}`);
        }
        return result.content;
    }
}
