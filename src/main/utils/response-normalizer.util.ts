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
    const res = asObject(response) || {};
    const choices = asArray(res.choices) || [];
    const choice = asObject(choices[0]);
    const message = asObject(choice?.message) || { role: 'assistant', content: '' };
    const usage = asObject(res.usage);

    return {
        content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content || ''),
        role: 'assistant',
        provider: 'openai',
        model,
        finishReason: normalizeFinishReason(choice?.finish_reason as string | undefined),
        usage: usage ? {
            promptTokens: Number(usage.prompt_tokens || 0),
            completionTokens: Number(usage.completion_tokens || 0),
            totalTokens: Number(usage.total_tokens || 0)
        } : undefined,
        toolCalls: message.tool_calls ? (asArray(message.tool_calls) || []).map((t) => normalizeToolCall(t)) : undefined,
        reasoning: (message.reasoning_content as string) || (message.reasoning as string),
        metadata: {
            id: res.id as string,
            created: res.created as number,
            systemFingerprint: res.system_fingerprint as string
        },
        rawResponse: response
    }
}

/**
 * Normalize Anthropic response
 */
export function normalizeAnthropicResponse(response: JsonValue, model: string): NormalizedResponse {
    const res = asObject(response) || {};
    const content = asArray(res.content) || [];
    const textPart = asObject(content.find((c) => asObject(c)?.type === 'text'));
    const textContent = (textPart?.text as string) || '';
    const toolUseContent = content.filter((c) => asObject(c)?.type === 'tool_use');
    const usage = asObject(res.usage);

    return {
        content: textContent,
        role: 'assistant',
        provider: 'anthropic',
        model,
        finishReason: normalizeFinishReason(res.stop_reason as string | undefined),
        usage: usage ? {
            promptTokens: Number(usage.input_tokens || 0),
            completionTokens: Number(usage.output_tokens || 0),
            totalTokens: Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0)
        } : undefined,
        toolCalls: toolUseContent.map((t) => {
            const block = asObject(t) || {};
            return {
                id: (block.id as string) || `tool-${Date.now()}`,
                type: 'function' as const,
                function: {
                    name: (block.name as string) || '',
                    arguments: JSON.stringify(block.input || {})
                }
            };
        }),
        metadata: {
            id: res.id as string,
            model: res.model as string
        },
        rawResponse: response
    }
}



/**
 * Normalize Ollama response
 */
export function normalizeOllamaResponse(response: JsonValue, model: string): NormalizedResponse {
    const res = asObject(response) || {};
    const message = asObject(res.message);
    return {
        content: (message?.content as string) || (res.response as string) || '',
        role: 'assistant',
        provider: 'ollama',
        model,
        finishReason: res.done ? 'stop' : undefined,
        usage: res.eval_count ? {
            promptTokens: Number(res.prompt_eval_count || 0),
            completionTokens: Number(res.eval_count || 0),
            totalTokens: Number(res.prompt_eval_count || 0) + Number(res.eval_count || 0)
        } : undefined,
        metadata: {
            totalDuration: res.total_duration as number,
            loadDuration: res.load_duration as number,
            evalDuration: res.eval_duration as number
        },
        rawResponse: response
    }
}

/**
 * Normalize any provider response
 */
export function normalizeResponse(response: JsonValue, provider: string, model: string): NormalizedResponse {
    const res = asObject(response)
    switch (provider.toLowerCase()) {
        case 'openai':
        case 'copilot':
        case 'antigravity':
            return normalizeOpenAIResponse(response, model)
        case 'anthropic':
        case 'claude':
            return normalizeAnthropicResponse(response, model)

        case 'ollama':
            return normalizeOllamaResponse(response, model)
        default:
            // Try OpenAI format as default
            if (res && Array.isArray(res.choices)) {
                return normalizeOpenAIResponse(response, model)
            }
            // Fallback
            return {
                content: typeof response === 'string' ? response : JSON.stringify(response),
                role: 'assistant',
                provider,
                model,
                rawResponse: response
            }
    }
}

/**
 * Normalize stream chunk from any provider
 */
export function normalizeStreamChunk(chunk: JsonValue, provider: string): NormalizedStreamChunk {
    switch (provider.toLowerCase()) {
        case 'openai':
        case 'copilot':
        case 'antigravity': {
            const resObj = asObject(chunk)
            const choices = resObj ? asArray(resObj.choices) : null
            const choiceObj = choices && choices.length > 0 ? asObject(choices[0]) : null
            const delta = choiceObj ? asObject(choiceObj.delta) : null
            return {
                content: typeof delta?.content === 'string' ? delta.content : undefined,
                reasoning: typeof delta?.reasoning_content === 'string'
                    ? delta.reasoning_content
                    : (typeof delta?.reasoning === 'string' ? delta.reasoning : undefined),
                toolCalls: delta && Array.isArray(delta.tool_calls) ? delta.tool_calls.map(normalizeToolCall) : undefined,
                finishReason: typeof choiceObj?.finish_reason === 'string' ? choiceObj.finish_reason : undefined,
                done: choiceObj?.finish_reason !== undefined
            }
        }
        case 'anthropic': {
            const resObj = asObject(chunk)
            if (resObj?.type === 'content_block_delta') {
                const delta = asObject(resObj.delta)
                return {
                    content: typeof delta?.text === 'string' ? delta.text : undefined,
                    done: false
                }
            }
            if (resObj?.type === 'message_stop') {
                return { done: true }
            }
            return { done: false }
        }
        case 'ollama': {
            const resObj = asObject(chunk)
            const message = resObj ? asObject(resObj.message) : null
            return {
                content: typeof message?.content === 'string'
                    ? message.content
                    : (typeof resObj?.response === 'string' ? resObj.response : undefined),
                done: typeof resObj?.done === 'boolean' ? resObj.done : false
            }
        }
        default: {
            const resObj = asObject(chunk)
            const delta = resObj ? asObject(resObj.delta) : null
            return {
                content: typeof resObj?.content === 'string'
                    ? resObj.content
                    : (typeof resObj?.text === 'string'
                        ? resObj.text
                        : (typeof delta?.content === 'string' ? delta.content : undefined)),
                done: typeof resObj?.done === 'boolean' ? resObj.done : resObj?.finish_reason !== undefined
            }
        }
    }
}

// Helpers

function normalizeFinishReason(reason: string | undefined | null): NormalizedResponse['finishReason'] {
    if (!reason) return undefined

    const lower = reason.toLowerCase()
    if (lower === 'stop' || lower === 'end_turn' || lower === 'stop_sequence') return 'stop'
    if (lower === 'length' || lower === 'max_tokens') return 'length'
    if (lower === 'tool_calls' || lower === 'tool_use' || lower === 'function_call') return 'tool_calls'
    if (lower === 'content_filter' || lower === 'safety') return 'content_filter'

    return 'stop'
}

function normalizeToolCall(toolCall: JsonValue): NormalizedToolCall {
    const tc = asObject(toolCall) || {}
    const fn = asObject(tc.function) || {}
    const argsValue = fn.arguments !== undefined ? fn.arguments : tc.arguments
    const args = typeof argsValue === 'string' ? argsValue : JSON.stringify(argsValue || {})
    return {
        id: typeof tc.id === 'string' ? tc.id : `tool-${Date.now()}`,
        type: 'function',
        function: {
            name: typeof fn.name === 'string' ? fn.name : (typeof tc.name === 'string' ? tc.name : ''),
            arguments: args
        }
    }
}

function asObject(value: JsonValue | undefined): JsonObject | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as JsonObject
}

function asArray(value: JsonValue | undefined): JsonValue[] | null {
    if (!Array.isArray(value)) return null
    return value
}
