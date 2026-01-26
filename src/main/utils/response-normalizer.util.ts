/**
 * API Response Normalizer
 * Standardizes responses from different LLM providers
 */

import { JsonObject, JsonValue } from '@shared/types/common';

export interface NormalizedResponse {
    content: string
    role: 'assistant' | 'system' | 'user'
    provider: string
    model: string
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error'
    usage?: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
    }
    toolCalls?: NormalizedToolCall[]
    reasoning?: string
    images?: string[]
    metadata?: JsonObject
    rawResponse?: JsonValue
}

export interface NormalizedToolCall {
    id: string
    type: 'function'
    function: {
        name: string
        arguments: string
    }
}

export interface NormalizedStreamChunk {
    content?: string
    reasoning?: string
    images?: string[]
    toolCalls?: NormalizedToolCall[]
    finishReason?: string
    done: boolean
}

/**
 * Normalize OpenAI response
 */
export function normalizeOpenAIResponse(response: JsonValue, model: string): NormalizedResponse {
    const res = asObject(response) ?? {};
    const choice = asArray(res.choices)?.[0] as JsonObject | undefined;
    const message = asObject(choice?.message) ?? { role: 'assistant', content: '' };

    return {
        content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? ''),
        role: 'assistant',
        provider: 'openai',
        model,
        finishReason: normalizeFinishReason(choice?.finish_reason as string | undefined),
        usage: normalizeOpenAIUsage(asObject(res.usage)),
        toolCalls: normalizeOpenAIToolCalls(message.tool_calls),
        reasoning: (message.reasoning_content as string | undefined) ?? (message.reasoning as string | undefined),
        metadata: extractOpenAIMetadata(res),
        rawResponse: response
    };
}

function normalizeOpenAIUsage(usage: JsonObject | null): NormalizedResponse['usage'] {
    if (!usage) { return undefined; }
    return {
        promptTokens: Number(usage.prompt_tokens ?? 0),
        completionTokens: Number(usage.completion_tokens ?? 0),
        totalTokens: Number(usage.total_tokens ?? 0)
    };
}

function normalizeOpenAIToolCalls(toolCalls: JsonValue | undefined): NormalizedToolCall[] | undefined {
    if (!toolCalls) { return undefined; }
    return (asArray(toolCalls) ?? []).map((t) => normalizeToolCall(t));
}

function extractOpenAIMetadata(res: JsonObject): NormalizedResponse['metadata'] {
    return {
        id: res.id as string,
        created: res.created as number,
        systemFingerprint: res.system_fingerprint as string
    };
}

/**
 * Normalize Anthropic response
 */
export function normalizeAnthropicResponse(response: JsonValue, model: string): NormalizedResponse {
    const res = asObject(response) ?? {};
    const content = asArray(res.content) ?? [];
    const textPart = asObject(content.find((c) => asObject(c)?.type === 'text'));
    const textContent = (textPart?.text as string | undefined) ?? '';
    const toolUseContent = content.filter((c) => asObject(c)?.type === 'tool_use');
    const usage = asObject(res.usage);

    return {
        content: textContent,
        role: 'assistant',
        provider: 'anthropic',
        model,
        finishReason: normalizeFinishReason(res.stop_reason as string | undefined),
        usage: usage ? {
            promptTokens: Number(usage.input_tokens ?? 0),
            completionTokens: Number(usage.output_tokens ?? 0),
            totalTokens: Number(usage.input_tokens ?? 0) + Number(usage.output_tokens ?? 0)
        } : undefined,
        toolCalls: toolUseContent.map((t) => normalizeAnthropicToolCall(asObject(t) ?? {})),
        metadata: {
            id: res.id as string,
            model: res.model as string
        },
        rawResponse: response
    };
}

function normalizeAnthropicToolCall(block: JsonObject): NormalizedToolCall {
    return {
        id: (block.id as string | undefined) ?? `tool-${Date.now()}`,
        type: 'function' as const,
        function: {
            name: (block.name as string | undefined) ?? '',
            arguments: JSON.stringify(block.input ?? {})
        }
    };
}



/**
 * Normalize Ollama response
 */
export function normalizeOllamaResponse(response: JsonValue, model: string): NormalizedResponse {
    const res = asObject(response) ?? {};
    const message = asObject(res.message);
    const content = message ? (message.content as string | undefined) : (res.response as string | undefined);

    return {
        content: content ?? '',
        role: 'assistant',
        provider: 'ollama',
        model,
        finishReason: res.done ? 'stop' : undefined,
        usage: normalizeOllamaUsage(res),
        metadata: extractOllamaMetadata(res),
        rawResponse: response
    };
}

function normalizeOllamaUsage(res: JsonObject): NormalizedResponse['usage'] {
    if (!res.eval_count) { return undefined; }
    return {
        promptTokens: Number(res.prompt_eval_count ?? 0),
        completionTokens: Number(res.eval_count ?? 0),
        totalTokens: Number(res.prompt_eval_count ?? 0) + Number(res.eval_count ?? 0)
    };
}

function extractOllamaMetadata(res: JsonObject): NormalizedResponse['metadata'] {
    return {
        totalDuration: res.total_duration as number,
        loadDuration: res.load_duration as number,
        evalDuration: res.eval_duration as number
    };
}

/**
 * Normalize any provider response
 */
export function normalizeResponse(response: JsonValue, provider: string, model: string): NormalizedResponse {
    const p = provider.toLowerCase();
    if (p === 'openai' || p === 'copilot' || p === 'antigravity') {
        return normalizeOpenAIResponse(response, model);
    }
    if (p === 'anthropic' || p === 'claude') {
        return normalizeAnthropicResponse(response, model);
    }
    if (p === 'ollama') {
        return normalizeOllamaResponse(response, model);
    }
    return normalizeFallbackResponse(response, provider, model);
}

function normalizeFallbackResponse(response: JsonValue, provider: string, model: string): NormalizedResponse {
    const resObj = asObject(response);
    if (resObj && Array.isArray(resObj.choices)) {
        return normalizeOpenAIResponse(response, model);
    }
    return {
        content: typeof response === 'string' ? response : JSON.stringify(response),
        role: 'assistant',
        provider,
        model,
        rawResponse: response
    };
}

/**
 * Normalize stream chunk from any provider
 */
export function normalizeStreamChunk(chunk: JsonValue, provider: string): NormalizedStreamChunk {
    switch (provider.toLowerCase()) {
        case 'openai':
        case 'copilot':
        case 'antigravity':
            return normalizeOpenAIStreamChunk(chunk);
        case 'anthropic':
        case 'claude':
            return normalizeAnthropicStreamChunk(chunk);
        case 'ollama':
            return normalizeOllamaStreamChunk(chunk);
        default:
            return normalizeDefaultStreamChunk(chunk);
    }
}

function normalizeOpenAIStreamChunk(chunk: JsonValue): NormalizedStreamChunk {
    const resObj = asObject(chunk);
    const choiceObj = asArray(resObj?.choices)?.[0] as JsonObject | undefined;
    const delta = asObject(choiceObj?.delta);

    const finishReason = typeof choiceObj?.finish_reason === 'string' ? choiceObj.finish_reason : undefined;

    return {
        content: typeof delta?.content === 'string' ? delta.content : undefined,
        reasoning: getOpenAIReasoning(delta),
        toolCalls: delta && Array.isArray(delta.tool_calls) ? delta.tool_calls.map(normalizeToolCall) : undefined,
        finishReason,
        done: finishReason !== undefined
    };
}

function getOpenAIReasoning(delta: JsonObject | null): string | undefined {
    if (typeof delta?.reasoning_content === 'string') {
        return delta.reasoning_content;
    }
    return typeof delta?.reasoning === 'string' ? delta.reasoning : undefined;
}

function normalizeAnthropicStreamChunk(chunk: JsonValue): NormalizedStreamChunk {
    const resObj = asObject(chunk);
    if (resObj?.type === 'content_block_delta') {
        const delta = asObject(resObj.delta);
        return {
            content: typeof delta?.text === 'string' ? delta.text : undefined,
            done: false
        };
    }
    return { done: resObj?.type === 'message_stop' };
}

function normalizeOllamaStreamChunk(chunk: JsonValue): NormalizedStreamChunk {
    const resObj = asObject(chunk);
    const message = resObj ? asObject(resObj.message) : null;
    return {
        content: typeof message?.content === 'string'
            ? message.content
            : (typeof resObj?.response === 'string' ? resObj.response : undefined),
        done: typeof resObj?.done === 'boolean' ? resObj.done : false
    };
}

function normalizeDefaultStreamChunk(chunk: JsonValue): NormalizedStreamChunk {
    const resObj = asObject(chunk);
    const delta = asObject(resObj?.delta);
    const content = getStandardContent(resObj, delta);
    const isDone = typeof resObj?.done === 'boolean' ? resObj.done : resObj?.finish_reason !== undefined;

    return {
        content,
        done: isDone
    };
}

function getStandardContent(res: JsonObject | null, delta: JsonObject | null): string | undefined {
    if (typeof res?.content === 'string') { return res.content; }
    if (typeof res?.text === 'string') { return res.text; }
    return typeof delta?.content === 'string' ? delta.content : undefined;
}

// Helpers

function normalizeFinishReason(reason: string | undefined | null): NormalizedResponse['finishReason'] {
    if (!reason) { return undefined; }

    const lower = reason.toLowerCase();
    const mapping: Record<string, NormalizedResponse['finishReason']> = {
        stop: 'stop',
        end_turn: 'stop',
        stop_sequence: 'stop',
        length: 'length',
        max_tokens: 'length',
        tool_calls: 'tool_calls',
        tool_use: 'tool_calls',
        function_call: 'tool_calls',
        content_filter: 'content_filter',
        safety: 'content_filter'
    };

    return mapping[lower] ?? 'stop';
}

function normalizeToolCall(toolCall: JsonValue): NormalizedToolCall {
    const tc = asObject(toolCall) ?? {};
    const fn = asObject(tc.function) ?? {};

    // Fallback logic for function details
    const rawArgs = fn.arguments ?? tc.arguments;
    const name = typeof fn.name === 'string' ? fn.name : (typeof tc.name === 'string' ? tc.name : '');
    const id = typeof tc.id === 'string' ? tc.id : `tool-${Date.now()}`;

    return {
        id,
        type: 'function',
        function: {
            name,
            arguments: typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs ?? {})
        }
    };
}

function asObject(value: JsonValue | undefined): JsonObject | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { return null; }
    return value as JsonObject;
}

function asArray(value: JsonValue | undefined): JsonValue[] | null {
    if (!Array.isArray(value)) { return null; }
    return value;
}
