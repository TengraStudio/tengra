/**
 * Token Usage Estimation Service
 * Estimates token counts for messages and tracks actual usage
 */

import { Message } from '@shared/types/chat'

export interface TokenUsage {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cachedTokens?: number
    reasoningTokens?: number
}

export interface TokenEstimate {
    estimatedInputTokens: number
    estimatedOutputTokens: number
    estimatedTotalTokens: number
}

/**
 * Rough token estimation (approximate)
 * Uses a simple heuristic: ~4 characters per token for English text
 * This is a conservative estimate
 */
const CHARS_PER_TOKEN = 4

/**
 * Token Estimation Service
 */
export class TokenEstimationService {
    /**
     * Estimate tokens for a single message
     */
    estimateMessageTokens(message: Message): number {
        let content = ''

        if (typeof message.content === 'string') {
            content = message.content
        } else if (Array.isArray(message.content)) {
            // Sum up text content from all parts
            content = message.content
                .filter(part => part.type === 'text' && part.text)
                .map(part => part.text ?? '')
                .join(' ')
        }

        // Rough estimation: ~4 chars per token
        return Math.ceil(content.length / CHARS_PER_TOKEN)
    }

    /**
     * Estimate tokens for an array of messages
     */
    estimateMessagesTokens(messages: Message[]): TokenEstimate {
        let totalInput = 0
        let totalOutput = 0

        for (const message of messages) {
            const tokens = this.estimateMessageTokens(message)
            if (message.role === 'user' || message.role === 'system') {
                totalInput += tokens
            } else if (message.role === 'assistant') {
                totalOutput += tokens
            }
        }

        return {
            estimatedInputTokens: totalInput,
            estimatedOutputTokens: totalOutput,
            estimatedTotalTokens: totalInput + totalOutput
        }
    }

    /**
     * Estimate tokens for a string (useful for input validation)
     */
    estimateStringTokens(text: string): number {
        return Math.ceil(text.length / CHARS_PER_TOKEN)
    }

    /**
     * Get context window size for a model
     * Returns common context window sizes for known models
     */
    getContextWindowSize(model: string): number {
        const modelLower = model.toLowerCase()

        // GPT-4 models
        if (modelLower.includes('gpt-4-turbo') || modelLower.includes('gpt-4o')) {
            return 128000
        }
        if (modelLower.includes('gpt-4')) {
            return 8192 // Default GPT-4
        }

        // GPT-3.5 models
        if (modelLower.includes('gpt-3.5')) {
            return 16385
        }

        // Claude models
        if (modelLower.includes('claude-3-5-sonnet') || modelLower.includes('claude-3-opus')) {
            return 200000
        }
        if (modelLower.includes('claude-3')) {
            return 200000
        }
        if (modelLower.includes('claude-2')) {
            return 100000
        }

        // Gemini models
        if (modelLower.includes('gemini-1.5-pro') || modelLower.includes('gemini-1.5-flash')) {
            return 2000000 // 2M tokens
        }
        if (modelLower.includes('gemini-pro')) {
            return 32768
        }

        // Llama models (common sizes)
        if (modelLower.includes('llama-3.1-70b') || modelLower.includes('llama-3.1-405b')) {
            return 131072
        }
        if (modelLower.includes('llama-3')) {
            return 8192
        }
        if (modelLower.includes('llama-2')) {
            return 4096
        }

        // Default fallback
        return 8192
    }

    /**
     * Check if messages fit within context window
     */
    fitsInContextWindow(messages: Message[], model: string, reservedTokens: number = 0): {
        fits: boolean
        estimatedTokens: number
        contextWindow: number
        remainingTokens: number
    } {
        const estimate = this.estimateMessagesTokens(messages)
        const contextWindow = this.getContextWindowSize(model)
        const totalTokens = estimate.estimatedTotalTokens + reservedTokens
        const remainingTokens = contextWindow - totalTokens

        return {
            fits: totalTokens <= contextWindow,
            estimatedTokens: totalTokens,
            contextWindow,
            remainingTokens: Math.max(0, remainingTokens)
        }
    }

    /**
     * Truncate messages to fit within context window
     * Keeps system messages and recent messages
     */
    truncateToFitContextWindow(
        messages: Message[],
        model: string,
        reservedTokens: number = 0,
        keepSystemMessages: boolean = true
    ): Message[] {
        const contextWindow = this.getContextWindowSize(model)
        const maxTokens = contextWindow - reservedTokens

        if (keepSystemMessages) {
            const systemMessages = messages.filter(m => m.role === 'system')
            const nonSystemMessages = messages.filter(m => m.role !== 'system')

            let currentTokens = systemMessages.reduce((sum, m) => sum + this.estimateMessageTokens(m), 0)
            const truncated: Message[] = [...systemMessages]

            // Add messages from the end until we hit the limit
            for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
                const message = nonSystemMessages[i]
                if (message === undefined) {
                    continue
                }
                const messageTokens = this.estimateMessageTokens(message)

                if (currentTokens + messageTokens <= maxTokens) {
                    truncated.push(message)
                    currentTokens += messageTokens
                } else {
                    break
                }
            }

            // Reverse to maintain chronological order
            return [...systemMessages, ...truncated.slice(systemMessages.length).reverse()]
        }

        // No system messages to preserve
        let currentTokens = 0
        const truncated: Message[] = []

        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i]
            if (message === undefined) {
                continue
            }
            const messageTokens = this.estimateMessageTokens(message)

            if (currentTokens + messageTokens <= maxTokens) {
                truncated.unshift(message)
                currentTokens += messageTokens
            } else {
                break
            }
        }

        return truncated
    }
}

// Singleton instance
let instance: TokenEstimationService | null = null

export function getTokenEstimationService(): TokenEstimationService {
    if (!instance) {
        instance = new TokenEstimationService()
    }
    return instance
}
