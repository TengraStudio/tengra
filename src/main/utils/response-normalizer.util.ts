/**
 * API Response Normalizer
 * Standardizes responses from different LLM providers
 */

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
    metadata?: Record<string, any>
    rawResponse?: any
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
export function normalizeOpenAIResponse(response: any, model: string): NormalizedResponse {
    const choice = response.choices?.[0]
    const message = choice?.message || {}

    return {
        content: message.content || '',
        role: 'assistant',
        provider: 'openai',
        model,
        finishReason: normalizeFinishReason(choice?.finish_reason),
        usage: response.usage ? {
            promptTokens: response.usage.prompt_tokens || 0,
            completionTokens: response.usage.completion_tokens || 0,
            totalTokens: response.usage.total_tokens || 0
        } : undefined,
        toolCalls: message.tool_calls?.map(normalizeToolCall),
        reasoning: message.reasoning_content || message.reasoning,
        metadata: {
            id: response.id,
            created: response.created,
            systemFingerprint: response.system_fingerprint
        },
        rawResponse: response
    }
}

/**
 * Normalize Anthropic response
 */
export function normalizeAnthropicResponse(response: any, model: string): NormalizedResponse {
    const content = response.content || []
    const textContent = content.find((c: any) => c.type === 'text')?.text || ''
    const toolUseContent = content.filter((c: any) => c.type === 'tool_use')

    return {
        content: textContent,
        role: 'assistant',
        provider: 'anthropic',
        model,
        finishReason: normalizeFinishReason(response.stop_reason),
        usage: response.usage ? {
            promptTokens: response.usage.input_tokens || 0,
            completionTokens: response.usage.output_tokens || 0,
            totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
        } : undefined,
        toolCalls: toolUseContent.map((t: any) => ({
            id: t.id,
            type: 'function' as const,
            function: {
                name: t.name,
                arguments: JSON.stringify(t.input)
            }
        })),
        metadata: {
            id: response.id,
            model: response.model
        },
        rawResponse: response
    }
}

/**
 * Normalize Gemini response
 */
export function normalizeGeminiResponse(response: any, model: string): NormalizedResponse {
    const candidate = response.candidates?.[0]
    const content = candidate?.content
    const textPart = content?.parts?.find((p: any) => p.text)?.text || ''

    return {
        content: textPart,
        role: 'assistant',
        provider: 'gemini',
        model,
        finishReason: normalizeFinishReason(candidate?.finishReason),
        usage: response.usageMetadata ? {
            promptTokens: response.usageMetadata.promptTokenCount || 0,
            completionTokens: response.usageMetadata.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata.totalTokenCount || 0
        } : undefined,
        metadata: {
            safetyRatings: candidate?.safetyRatings
        },
        rawResponse: response
    }
}

/**
 * Normalize Ollama response
 */
export function normalizeOllamaResponse(response: any, model: string): NormalizedResponse {
    return {
        content: response.message?.content || response.response || '',
        role: 'assistant',
        provider: 'ollama',
        model,
        finishReason: response.done ? 'stop' : undefined,
        usage: response.eval_count ? {
            promptTokens: response.prompt_eval_count || 0,
            completionTokens: response.eval_count || 0,
            totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
        } : undefined,
        metadata: {
            totalDuration: response.total_duration,
            loadDuration: response.load_duration,
            evalDuration: response.eval_duration
        },
        rawResponse: response
    }
}

/**
 * Normalize any provider response
 */
export function normalizeResponse(response: any, provider: string, model: string): NormalizedResponse {
    switch (provider.toLowerCase()) {
        case 'openai':
        case 'copilot':
        case 'antigravity':
            return normalizeOpenAIResponse(response, model)
        case 'anthropic':
        case 'claude':
            return normalizeAnthropicResponse(response, model)
        case 'gemini':
        case 'google':
            return normalizeGeminiResponse(response, model)
        case 'ollama':
            return normalizeOllamaResponse(response, model)
        default:
            // Try OpenAI format as default
            if (response.choices) {
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
export function normalizeStreamChunk(chunk: any, provider: string): NormalizedStreamChunk {
    switch (provider.toLowerCase()) {
        case 'openai':
        case 'copilot':
        case 'antigravity': {
            const delta = chunk.choices?.[0]?.delta || {}
            return {
                content: delta.content,
                reasoning: delta.reasoning_content || delta.reasoning,
                toolCalls: delta.tool_calls?.map(normalizeToolCall),
                finishReason: chunk.choices?.[0]?.finish_reason,
                done: chunk.choices?.[0]?.finish_reason !== undefined
            }
        }
        case 'anthropic': {
            if (chunk.type === 'content_block_delta') {
                return {
                    content: chunk.delta?.text,
                    done: false
                }
            }
            if (chunk.type === 'message_stop') {
                return { done: true }
            }
            return { done: false }
        }
        case 'ollama': {
            return {
                content: chunk.message?.content || chunk.response,
                done: chunk.done || false
            }
        }
        default:
            return {
                content: chunk.content || chunk.text || chunk.delta?.content,
                done: chunk.done || chunk.finish_reason !== undefined
            }
    }
}

// Helpers

function normalizeFinishReason(reason: string | undefined): NormalizedResponse['finishReason'] {
    if (!reason) return undefined

    const lower = reason.toLowerCase()
    if (lower === 'stop' || lower === 'end_turn' || lower === 'stop_sequence') return 'stop'
    if (lower === 'length' || lower === 'max_tokens') return 'length'
    if (lower === 'tool_calls' || lower === 'tool_use') return 'tool_calls'
    if (lower === 'content_filter' || lower === 'safety') return 'content_filter'

    return 'stop'
}

function normalizeToolCall(toolCall: any): NormalizedToolCall {
    return {
        id: toolCall.id || `tool-${Date.now()}`,
        type: 'function',
        function: {
            name: toolCall.function?.name || toolCall.name || '',
            arguments: typeof toolCall.function?.arguments === 'string'
                ? toolCall.function.arguments
                : JSON.stringify(toolCall.function?.arguments || toolCall.arguments || {})
        }
    }
}
