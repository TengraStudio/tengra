/**
 * Token Usage Estimation Service
 * Estimates token counts for messages and tracks actual usage
 */

import { Message, TextContent } from '@shared/types/chat';

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

/**
 * Token Estimation Service
 */
export class TokenEstimationService {
    private dynamicLimits = new Map<string, number>();

    /**
     * Register a dynamic context window limit for a specific model ID
     */
    registerModelLimit(modelId: string, limit: number): void {
        if (limit > 0) {
            this.dynamicLimits.set(modelId.toLowerCase(), limit);
        }
    }

    /**
     * Estimate tokens for a single message
     */
    estimateMessageTokens(message: Message): number {
        let content = '';

        if (typeof message.content === 'string') {
            content = message.content;
        } else if (Array.isArray(message.content)) {
            // Sum up text content from all parts
            content = message.content
                .filter((part): part is TextContent => part.type === 'text')
                .map(part => part.text)
                .join(' ');
        } else {
            // Fallback for any other unexpected types
            try {
                content = String(message.content);
            } catch {
                content = '';
            }
        }

        if (!content) { return 0; }

        // Better heuristic:
        // 1. Count words (approximate by whitespace)
        // 2. Count characters for non-space sequences
        // Averaging both gives a more stable estimate across different languages/styles
        const words = content.trim().split(/\s+/).length;
        const chars = content.length;

        // Roughly: 1 word = 1.3 tokens, OR length / 4. 
        // We use a blend: max(words * 1.35, chars / 3.8) to be slightly conservative (overestimate)
        const tokensByWords = Math.ceil(words * 1.35);
        const tokensByChars = Math.ceil(chars / 3.8);

        return Math.max(tokensByWords, tokensByChars);
    }

    /**
     * Estimate tokens for an array of messages
     */
    estimateMessagesTokens(messages: Message[]): TokenEstimate {
        let totalInput = 0;
        let totalOutput = 0;

        for (const message of messages) {
            const tokens = this.estimateMessageTokens(message);
            if (message.role === 'user' || message.role === 'system') {
                totalInput += tokens;
            } else if (message.role === 'assistant') {
                totalOutput += tokens;
            }
        }

        return {
            estimatedInputTokens: totalInput,
            estimatedOutputTokens: totalOutput,
            estimatedTotalTokens: totalInput + totalOutput
        };
    }

    /**
     * Estimate tokens for a string (useful for input validation)
     */
    estimateStringTokens(text: string): number {
        if (!text) { return 0; }

        // Consistent heuristic with estimateMessageTokens
        const words = text.trim().split(/\s+/).length;
        const chars = text.length;

        // Roughly: 1 word = 1.35 tokens, OR length / 3.8. 
        // We use a blend: max(words * 1.35, chars / 3.8) to be slightly conservative
        const tokensByWords = Math.ceil(words * 1.35);
        const tokensByChars = Math.ceil(chars / 3.8);

        return Math.max(tokensByWords, tokensByChars);
    }

    /**
     * Get context window size for a model
     * Returns common context window sizes for known models
     */
    getContextWindowSize(model: string): number {
        const modelLower = model.toLowerCase();

        // Check dynamic limits first (e.g., from ModelRegistry)
        const dynamicLimit = this.dynamicLimits.get(modelLower);
        if (dynamicLimit !== undefined) {
            return dynamicLimit;
        }

        const limits: Array<{ pattern: string[]; limit: number }> = [
            { pattern: ['gemini-1.5-pro', 'gemini-1.5-flash'], limit: 2000000 },
            { pattern: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3'], limit: 200000 },
            { pattern: ['gpt-4o', 'gpt-4-turbo', 'o1-'], limit: 128000 },
            { pattern: ['llama-3.1-70b', 'llama-3.1-405b'], limit: 131072 },
            { pattern: ['gpt-4o-mini'], limit: 128000 },
            { pattern: ['claude-2'], limit: 100000 },
            { pattern: ['gemini-pro'], limit: 32768 },
            { pattern: ['gpt-3.5'], limit: 16385 },
            { pattern: ['llama-2'], limit: 4096 }
        ];

        for (const { pattern, limit } of limits) {
            if (pattern.some(p => modelLower.includes(p))) {
                return limit;
            }
        }

        if (this.isStandardModel(modelLower)) { return 8192; }

        return 8192;
    }

    private isStandardModel(model: string): boolean {
        return model.includes('gpt-4') || model.includes('llama-3');
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
        const estimate = this.estimateMessagesTokens(messages);
        const contextWindow = this.getContextWindowSize(model);
        const totalTokens = estimate.estimatedTotalTokens + reservedTokens;
        const remainingTokens = contextWindow - totalTokens;

        return {
            fits: totalTokens <= contextWindow,
            estimatedTokens: totalTokens,
            contextWindow,
            remainingTokens: Math.max(0, remainingTokens)
        };
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
        const contextWindow = this.getContextWindowSize(model);
        const maxTokens = contextWindow - reservedTokens;

        if (keepSystemMessages) {
            const systemMessages = messages.filter(m => m.role === 'system');
            const nonSystemMessages = messages.filter(m => m.role !== 'system');

            let currentTokens = systemMessages.reduce((sum, m) => sum + this.estimateMessageTokens(m), 0);
            const truncated: Message[] = [...systemMessages];

            // Add messages from the end until we hit the limit
            for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
                const message = nonSystemMessages[i];
                const messageTokens = this.estimateMessageTokens(message);

                if (currentTokens + messageTokens <= maxTokens) {
                    truncated.push(message);
                    currentTokens += messageTokens;
                } else {
                    break;
                }
            }

            // Reverse to maintain chronological order
            return [...systemMessages, ...truncated.slice(systemMessages.length).reverse()];
        }

        // No system messages to preserve
        let currentTokens = 0;
        const truncated: Message[] = [];

        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const messageTokens = this.estimateMessageTokens(message);

            if (currentTokens + messageTokens <= maxTokens) {
                truncated.unshift(message);
                currentTokens += messageTokens;
            } else {
                break;
            }
        }

        return truncated;
    }
}

// Singleton instance
let instance: TokenEstimationService | null = null;

export function getTokenEstimationService(): TokenEstimationService {
    instance ??= new TokenEstimationService();
    return instance;
}
