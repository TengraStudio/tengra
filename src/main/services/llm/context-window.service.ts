/**
 * Context Window Management Service
 * Manages context window limits and message truncation
 */

import { getTokenEstimationService, TokenEstimationService } from '@main/services/llm/token-estimation.service'
import { Message } from '@shared/types/chat'

export interface ContextWindowInfo {
    model: string
    contextWindowSize: number
    estimatedTokens: number
    remainingTokens: number
    utilizationPercent: number
    fits: boolean
}

export interface TruncationOptions {
    reservedTokens?: number
    keepSystemMessages?: boolean
    keepRecentMessages?: number // Keep last N messages regardless
    strategy?: 'recent-first' | 'importance-based'
}

export class ContextWindowService {
    private tokenEstimator: TokenEstimationService

    constructor() {
        this.tokenEstimator = getTokenEstimationService()
    }

    /**
     * Get context window information for messages
     */
    getContextWindowInfo(messages: Message[], model: string, reservedTokens: number = 0): ContextWindowInfo {
        const estimate = this.tokenEstimator.estimateMessagesTokens(messages)
        const contextWindow = this.tokenEstimator.getContextWindowSize(model)
        const totalTokens = estimate.estimatedTotalTokens + reservedTokens
        const remainingTokens = Math.max(0, contextWindow - totalTokens)
        const utilizationPercent = (totalTokens / contextWindow) * 100

        return {
            model,
            contextWindowSize: contextWindow,
            estimatedTokens: totalTokens,
            remainingTokens,
            utilizationPercent: Math.min(100, utilizationPercent),
            fits: totalTokens <= contextWindow
        }
    }

    /**
     * Truncate messages to fit within context window
     */
    truncateMessages(
        messages: Message[],
        model: string,
        options: TruncationOptions = {}
    ): {
        truncated: Message[]
        removedCount: number
        info: ContextWindowInfo
    } {
        const {
            reservedTokens = 0,
            keepSystemMessages = true,
            keepRecentMessages = 0,
            strategy = 'recent-first'
        } = options

        const contextWindow = this.tokenEstimator.getContextWindowSize(model)
        const maxTokens = contextWindow - reservedTokens

        let result: Message[]
        let removedCount = 0

        if (strategy === 'recent-first') {
            // Keep system messages and recent messages
            const systemMessages = keepSystemMessages
                ? messages.filter(m => m.role === 'system')
                : []

            const nonSystemMessages = messages.filter(m => m.role !== 'system')

            // Always keep the last N messages
            const recentMessages = keepRecentMessages > 0
                ? nonSystemMessages.slice(-keepRecentMessages)
                : []

            const messagesToProcess = keepRecentMessages > 0
                ? nonSystemMessages.slice(0, -keepRecentMessages)
                : nonSystemMessages

            let currentTokens = systemMessages.reduce(
                (sum, m) => sum + this.tokenEstimator.estimateMessageTokens(m),
                0
            )
            currentTokens += recentMessages.reduce(
                (sum, m) => sum + this.tokenEstimator.estimateMessageTokens(m),
                0
            )

            const truncated: Message[] = [...systemMessages]

            // Add messages from the end until we hit the limit
            for (let i = messagesToProcess.length - 1; i >= 0; i--) {
                const message = messagesToProcess[i]
                const messageTokens = this.tokenEstimator.estimateMessageTokens(message)

                if (currentTokens + messageTokens <= maxTokens) {
                    truncated.push(message)
                    currentTokens += messageTokens
                } else {
                    removedCount++
                }
            }

            // Add recent messages at the end
            truncated.push(...recentMessages)

            // Reverse non-system messages to maintain chronological order
            const systemCount = systemMessages.length
            const nonSystemTruncated = truncated.slice(systemCount, systemCount + messagesToProcess.length).reverse()
            result = [...systemMessages, ...nonSystemTruncated, ...recentMessages]
        } else {
            // Importance-based (future enhancement)
            // For now, fall back to recent-first
            result = this.tokenEstimator.truncateToFitContextWindow(
                messages,
                model,
                reservedTokens,
                keepSystemMessages
            )
            removedCount = messages.length - result.length
        }

        const info = this.getContextWindowInfo(result, model, reservedTokens)

        return {
            truncated: result,
            removedCount,
            info
        }
    }

    /**
     * Check if messages need truncation
     */
    needsTruncation(messages: Message[], model: string, reservedTokens: number = 0): boolean {
        const info = this.getContextWindowInfo(messages, model, reservedTokens)
        return !info.fits
    }

    /**
     * Get recommended truncation settings based on context window utilization
     */
    getRecommendedTruncationSettings(
        messages: Message[],
        model: string,
        reservedTokens: number = 0
    ): TruncationOptions {
        const info = this.getContextWindowInfo(messages, model, reservedTokens)

        if (info.utilizationPercent < 80) {
            // No truncation needed
            return {
                reservedTokens,
                keepSystemMessages: true,
                keepRecentMessages: 10,
                strategy: 'recent-first'
            }
        }

        if (info.utilizationPercent < 95) {
            // Moderate truncation
            return {
                reservedTokens,
                keepSystemMessages: true,
                keepRecentMessages: 20,
                strategy: 'recent-first'
            }
        }

        // Aggressive truncation
        return {
            reservedTokens,
            keepSystemMessages: true,
            keepRecentMessages: 10,
            strategy: 'recent-first'
        }
    }
}

// Singleton instance
let instance: ContextWindowService | null = null

export function getContextWindowService(): ContextWindowService {
    instance ??= new ContextWindowService()
    return instance
}
