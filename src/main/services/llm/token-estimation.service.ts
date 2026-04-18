/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Message, TextContent } from '@shared/types/chat';
import { getEncoding, getEncodingNameForModel, Tiktoken, TiktokenEncoding } from 'js-tiktoken';

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
}

export interface TokenEstimate {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalTokens: number;
}

/**
 * Token Estimation Service
 */
export class TokenEstimationService {
    private dynamicLimits = new Map<string, number>();
    private tokenizers = new Map<string, Tiktoken>();

    /**
     * Register a dynamic context window limit for a specific model ID
     */
    registerModelLimit(modelId: string, limit: number): void {
        if (limit > 0) {
            this.dynamicLimits.set(modelId.toLowerCase(), limit);
        }
    }

    /**
     * Get a tokenizer for a specific model
     */
    private getTokenizer(model: string): Tiktoken | null {
        const modelLower = model.toLowerCase();

        // Try to get existing tokenizer
        const existing = this.tokenizers.get(modelLower);
        if (existing) {
            return existing;
        }

        try {
            // js-tiktoken's getEncodingNameForModel handles mapping
            // Safely check if the model is one of the supported types
            const encodingName = getEncodingNameForModel(modelLower as Parameters<typeof getEncodingNameForModel>[0]);
            const tokenizer = getEncoding(encodingName);
            this.tokenizers.set(modelLower, tokenizer);
            return tokenizer;
        } catch {
            // Fallback for models not explicitly supported by js-tiktoken mapping
            // Many models use cl100k_base style tokenization (Claude, Llama 3 etc. are similar enough for estimates)
            if (modelLower.includes('claude') || modelLower.includes('llama-3')) {
                const encodingName: TiktokenEncoding = 'cl100k_base';
                const cached = this.tokenizers.get(encodingName);
                if (cached) {
                    return cached;
                }
                const tokenizer = getEncoding(encodingName);
                this.tokenizers.set(encodingName, tokenizer);
                return tokenizer;
            }
            return null;
        }
    }

    /**
     * Estimate tokens for a single message
     */
    estimateMessageTokens(message: Message, model: string = 'gpt-3.5-turbo'): number {
        let content = '';

        if (typeof message.content === 'string') {
            content = message.content;
        } else if (Array.isArray(message.content)) {
            content = message.content
                .filter((part): part is TextContent => part.type === 'text')
                .map(part => part.text)
                .join(' ');
        } else {
            try {
                content = String(message.content);
            } catch {
                content = '';
            }
        }

        if (!content) {
            return 0;
        }

        const tokenizer = this.getTokenizer(model);
        if (tokenizer) {
            try {
                // Approximate: tokens + small overhead per message (OpenAI style)
                return tokenizer.encode(content).length + 4;
            } catch {
                // Fallback to heuristic if tokenizer fails
            }
        }

        // Heuristic fallback
        const words = content.trim().split(/\s+/).length;
        const chars = content.length;
        const tokensByWords = Math.ceil(words * 1.35);
        const tokensByChars = Math.ceil(chars / 3.8);

        return Math.max(tokensByWords, tokensByChars);
    }

    /**
     * Estimate tokens for an array of messages
     */
    estimateMessagesTokens(messages: Message[], model: string = 'gpt-3.5-turbo'): TokenEstimate {
        let totalInput = 0;
        let totalOutput = 0;

        for (const message of messages) {
            const tokens = this.estimateMessageTokens(message, model);
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
     * Estimate tokens for a string
     */
    estimateStringTokens(text: string, model: string = 'gpt-3.5-turbo'): number {
        if (!text) {
            return 0;
        }

        const tokenizer = this.getTokenizer(model);
        if (tokenizer) {
            try {
                return tokenizer.encode(text).length;
            } catch {
                // Fallback
            }
        }

        const words = text.trim().split(/\s+/).length;
        const chars = text.length;
        const tokensByWords = Math.ceil(words * 1.35);
        const tokensByChars = Math.ceil(chars / 3.8);

        return Math.max(tokensByWords, tokensByChars);
    }

    /**
     * Get context window size for a model
     */
    getContextWindowSize(model: string): number {
        const modelLower = model.toLowerCase();

        const dynamicLimit = this.dynamicLimits.get(modelLower);
        if (dynamicLimit !== undefined) {
            return dynamicLimit;
        }

        const limits: Array<{ pattern: string[]; limit: number }> = [
            { pattern: ['gemini-1.5-pro', 'gemini-1.5-flash'], limit: 2000000 },
            { pattern: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3'], limit: 200000 },
            { pattern: ['gpt-4o', 'gpt-4-turbo', 'o1-'], limit: 128000 },
            { pattern: ['llama-3.1-70b', 'llama-3.1-405b', 'llama-3.3'], limit: 131072 },
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

        return 8192;
    }

    /**
     * Check if messages fit within context window
     */
    fitsInContextWindow(messages: Message[], model: string, reservedTokens: number = 0): {
        fits: boolean;
        estimatedTokens: number;
        contextWindow: number;
        remainingTokens: number;
    } {
        const estimate = this.estimateMessagesTokens(messages, model);
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

            let currentTokens = systemMessages.reduce((sum, m) => sum + this.estimateMessageTokens(m, model), 0);
            const truncated: Message[] = [...systemMessages];

            for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
                const message = nonSystemMessages[i];
                const messageTokens = this.estimateMessageTokens(message, model);

                if (currentTokens + messageTokens <= maxTokens) {
                    truncated.push(message);
                    currentTokens += messageTokens;
                } else {
                    break;
                }
            }

            return [...systemMessages, ...truncated.slice(systemMessages.length).reverse()];
        }

        let currentTokens = 0;
        const truncated: Message[] = [];

        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const messageTokens = this.estimateMessageTokens(message, model);

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

let instance: TokenEstimationService | null = null;

export function getTokenEstimationService(): TokenEstimationService {
    instance ??= new TokenEstimationService();
    return instance;
}
