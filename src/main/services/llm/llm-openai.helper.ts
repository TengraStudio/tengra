import { appLogger } from '@main/logging/logger';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { filterContent } from '@main/services/llm/content-filter.service';
import { ChatMessage, OpenAIResponse, ToolCall } from '@main/types/llm.types';
import { MessageNormalizer } from '@main/utils/message-normalizer.util';
import { StreamChunk } from '@main/utils/stream-parser.util';
import { Message, SystemMode, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { OpenAIChatCompletion, OpenAIContentPartImage, OpenAIMessage } from '@shared/types/llm-provider-types';
import { ApiError, AppErrorCode } from '@shared/utils/error.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { Agent } from 'undici';

/** Error codes used by OpenAI operations. */
const OPENAI_ERROR_CODES = {
    OPENAI_HTTP_FAILURE: 'LLM_OPENAI_HTTP_FAILURE',
    OPENAI_STREAM_FAILURE: 'LLM_OPENAI_STREAM_FAILURE',
} as const;

const normalizeToolCalls = (toolCalls: OpenAIMessage['tool_calls']): ToolCall[] | undefined => {
    if (!toolCalls) {
        return undefined;
    }

    return toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: 'function',
        function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
        },
    }));
};

/**
 * SEC-013-2: Content Filtering - Validate LLM output against safety policies.
 */
export function validateLLMContent(content: string): string {
    const result = filterContent(content);
    if (result.blocked) {
        appLogger.warn('LLMService', `Content filtering blocked unsafe pattern(s): ${result.matchedPatterns.join(', ')}`);
    }
    return result.content;
}

/**
 * Builds the OpenAI-compatible request body.
 */
export function buildOpenAIBody(
    messages: Array<Message | ChatMessage>,
    options: {
        model: string;
        tools?: ToolDefinition[];
        provider?: string;
        stream?: boolean;
        n?: number;
        temperature?: number;
        systemMode?: SystemMode;
        reasoningEffort?: string;
    },
    normalizeModelName: (model: string, provider?: string) => string
): Record<string, RuntimeValue> {
    const { model, tools, provider, stream = false, n = 1, temperature, systemMode, reasoningEffort } = options;
    const normalizedMessages = MessageNormalizer.normalizeOpenAIMessages(messages, model);
    const finalModel = normalizeModelName(model, provider);

    const body: Record<string, RuntimeValue> = {
        model: finalModel,
        messages: normalizedMessages,
        stream
    };

    applyReasoningEffort(body, finalModel, systemMode, reasoningEffort);
    applyStreamOptions(body, stream, provider);
    applyOptionalOpenAIParams(body, n, provider, temperature);
    applyTools(body, tools);

    return body;
}

/** Adds stream_options when streaming (except nvidia). */
function applyStreamOptions(body: Record<string, RuntimeValue>, stream: boolean, provider?: string): void {
    if (stream && provider !== 'nvidia') {
        body.stream_options = { include_usage: true };
    }
}

/** Applies optional parameters like temperature and n. */
function applyOptionalOpenAIParams(body: Record<string, RuntimeValue>, n: number, provider?: string, temperature?: number): void {
    if (temperature !== undefined) { body.temperature = temperature; }
    if (n > 1) { body.n = n; }
    if (provider === 'nvidia' && !body.max_tokens) { body.max_tokens = 4096; }
}

/** Applies tool definitions to the request body. */
function applyTools(body: Record<string, RuntimeValue>, tools?: ToolDefinition[]): void {
    if (tools && tools.length > 0) {
        body.tools = sanitizeTools(tools);
        body.tool_choice = 'auto';
    }
}

/** Strips `required` from tool parameters for provider compatibility. */
function sanitizeTools(tools: ToolDefinition[]): RuntimeValue[] {
    return tools.map(tool => {
        const params = tool.function.parameters ? { ...tool.function.parameters as JsonObject } : {};
        if (params.required) { delete params.required; }
        return { ...tool, function: { ...tool.function, parameters: params } };
    });
}

/**
 * Applies reasoning effort configuration based on model type.
 */
export function applyReasoningEffort(
    body: Record<string, RuntimeValue>,
    model: string,
    systemMode?: SystemMode,
    reasoningEffort?: string
): void {
    const modelType = detectReasoningModelType(model);
    if (!modelType) { return; }

    const effort = resolveEffortLevel(reasoningEffort, systemMode);

    switch (modelType) {
        case 'openai': body.reasoning_effort = effort; break;
        case 'gemini3': body.thinking_level = effort; break;
        case 'gemini25': body.thinking_budget = getGeminiBudget(effort); break;
        case 'claude': body.thinking = { type: 'enabled', budget_tokens: getClaudeBudget(effort) }; break;
    }
}

/** Detects reasoning model type from model name. */
function detectReasoningModelType(model: string): 'openai' | 'gemini3' | 'gemini25' | 'claude' | null {
    const m = model.toLowerCase();
    if (isOpenAIReasoningModel(m)) { return 'openai'; }
    if (/gemini-3\.?/.test(m)) { return 'gemini3'; }
    if (/gemini-2[.-]5/.test(m)) { return 'gemini25'; }
    if (isClaudeThinkingModel(m)) { return 'claude'; }
    return null;
}

function isOpenAIReasoningModel(m: string): boolean {
    return /^o[134](-|$)/.test(m) ||
        (m.startsWith('gpt-5') && !m.includes('mini')) ||
        (m.includes('grok') && m.includes('code'));
}

function isClaudeThinkingModel(m: string): boolean {
    if (!m.includes('claude')) { return false; }
    return /opus-4|sonnet-4|haiku-4\.5|4-[15]-|4\.[15]-/.test(m);
}

function resolveEffortLevel(reasoningEffort?: string, systemMode?: SystemMode): string {
    if (reasoningEffort) { return reasoningEffort; }
    const modeMap: Record<string, string> = { 'thinking': 'high', 'fast': 'low' };
    return modeMap[systemMode ?? ''] ?? 'medium';
}

function getGeminiBudget(effort: string): number {
    const budgetMap: Record<string, number> = { 'minimal': 128, 'low': 2048, 'medium': 8192, 'high': 16384 };
    return budgetMap[effort] ?? 8192;
}

function getClaudeBudget(effort: string): number {
    const budgetMap: Record<string, number> = { 'low': 2048, 'medium': 8192, 'high': 16384 };
    return budgetMap[effort] ?? 8192;
}

/**
 * Creates the HTTP request init for OpenAI-compatible endpoints.
 */
export function createOpenAIRequest(
    body: RuntimeValue,
    apiKey: string,
    dispatcher: Agent | null,
    extraHeaders: Record<string, string> = {}
): RequestInit & { dispatcher?: Agent; signal?: AbortSignal } {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...extraHeaders
    };

    const requestInit: RequestInit & { dispatcher?: Agent; signal?: AbortSignal } = {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    };
    if (dispatcher) { requestInit.dispatcher = dispatcher; }
    return requestInit;
}

/** Extracts text content from an OpenAI message. */
function extractTextFromOpenAIMessage(message: OpenAIMessage): string {
    if (typeof message.content === 'string') { return message.content; }
    if (Array.isArray(message.content)) {
        return message.content
            .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
            .map(part => part.text)
            .join('');
    }
    return '';
}

/**
 * Processes a complete OpenAI chat completion response.
 */
export async function processOpenAIResponse(
    json: OpenAIChatCompletion,
    imagePersistence: ImagePersistenceService
): Promise<OpenAIResponse> {
    if (json.choices.length > 0) {
        const choice = json.choices[0];
        const message = choice.message;

        const completion = extractTextFromOpenAIMessage(message);
        const validatedCompletion = validateLLMContent(completion);
        const savedImages = await saveImagesFromOpenAIMessage(message, imagePersistence);

        const variants = await extractVariantsFromChoices(json.choices, json.model);

        const result: OpenAIResponse = {
            content: validatedCompletion,
            role: message.role,
            images: savedImages,
            variants: variants.length > 1 ? variants : undefined
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

async function extractVariantsFromChoices(choices: OpenAIChatCompletion['choices'], model: string) {
    return Promise.all(choices.map(async (c) => {
        const cContent = extractTextFromOpenAIMessage(c.message);
        return { content: cContent, role: c.message.role, model };
    }));
}

/** Saves images from an OpenAI message to local persistence. */
async function saveImagesFromOpenAIMessage(
    message: OpenAIMessage,
    imagePersistence: ImagePersistenceService
): Promise<string[]> {
    const contentParts = Array.isArray(message.content) ? message.content : [];
    const rawImages: Array<string | OpenAIContentPartImage> = [];

    for (const part of contentParts) {
        if (part.type === 'image_url') { rawImages.push(part); }
    }

    if (Array.isArray(message.images)) {
        for (const image of message.images) {
            if (typeof image === 'string') { rawImages.push(image); continue; }
            if (image?.type === 'image_url' && image.image_url?.url) { rawImages.push(image); }
        }
    }

    const savedImages: string[] = [];
    if (rawImages.length > 0) {
        await Promise.all(rawImages.map(async (img) => {
            const url = typeof img === 'string' ? img : img.image_url.url;
            if (url) {
                try {
                    const localPath = await imagePersistence.saveImage(url);
                    savedImages.push(localPath);
                } catch (e) {
                    appLogger.warn('LLMService', `Failed to save image: ${getErrorMessage(e as Error)}`);
                }
            }
        }));
    }
    return savedImages;
}

/** Saves images from a stream chunk. */
export async function saveImagesFromStreamChunk(
    images: Array<string | { image_url: { url: string } }> | undefined,
    imagePersistence: ImagePersistenceService
): Promise<string[]> {
    if (!images || images.length === 0) { return []; }

    const savedImages: string[] = [];
    await Promise.all(images.map(async (img) => {
        const url = (typeof img === 'string') ? img : img.image_url.url;
        if (url) {
            try {
                const localPath = await imagePersistence.saveImage(url);
                savedImages.push(localPath);
            } catch (e) {
                appLogger.warn('LLMService', `Failed to save image in stream: ${getErrorMessage(e as Error)}`);
            }
        }
    }));
    return savedImages;
}

/** Processes a single stream chunk, saving images. */
export async function processStreamChunk(
    chunk: StreamChunk,
    imagePersistence: ImagePersistenceService
): Promise<{
    content?: string;
    reasoning?: string;
    images?: string[];
    tool_calls?: ToolCall[];
    type?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    index?: number;
}> {
    const savedImages = await saveImagesFromStreamChunk(chunk.images, imagePersistence);
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

/** Handles non-OK OpenAI responses by throwing appropriate errors. */
export async function handleOpenAIError(response: Response, rotateKey: () => void): Promise<never> {
    const errorText = await response.text();
    if (response.status === 401 || response.status === 403) { rotateKey(); }
    throw new ApiError(
        errorText || `HTTP ${response.status}`,
        'openai',
        response.status,
        response.status >= 500 || response.status === 429,
        { code: OPENAI_ERROR_CODES.OPENAI_HTTP_FAILURE, appCode: AppErrorCode.API_ERROR }
    );
}

/** Handles non-OK stream responses. */
export async function handleOpenAIStreamError(
    response: Response,
    model: string,
    provider: string | undefined,
    rotateKey: () => void
): Promise<never> {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) { rotateKey(); }

    if (response.status === 429) {
        logDetailedQuotaError(model, provider, errorText);
    }

    throw new ApiError(
        errorText || `HTTP ${response.status}`,
        'openai-stream',
        response.status,
        response.status >= 500 || response.status === 429,
        { code: OPENAI_ERROR_CODES.OPENAI_STREAM_FAILURE, appCode: AppErrorCode.API_ERROR }
    );
}

/** Logs detailed 429 quota error info. */
function logDetailedQuotaError(model: string, provider: string | undefined, errorText: string): void {
    appLogger.error('LLMService', `429 Error for model ${model}, provider ${provider}`);
    appLogger.error('LLMService', `Error details: ${errorText}`);

    try {
        type OpenAIErrorBody = { error?: { message?: string } };
        const errorJson = safeJsonParse<OpenAIErrorBody>(errorText, {});
        const errorMessage = errorJson.error?.message;
        if (typeof errorMessage === 'string' && errorMessage.includes('quota')) {
            appLogger.warn('LLMService', 'Possible quota exhaustion detected despite individual model capacity.');
        }
    } catch {
        // Not JSON
    }
}
