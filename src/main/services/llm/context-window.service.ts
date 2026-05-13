/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Context Window Management Service
 * Manages context window limits and message truncation
 */

import { getTokenEstimationService, TokenEstimationService } from '@main/services/llm/token-estimation.service';
import { Message } from '@shared/types/chat';
import { randomUUID } from 'node:crypto';

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

export interface CompactionResult {
    messages: Message[]
    removedCount: number
    compacted: boolean
    passes: number
    info: ContextWindowInfo
}

export class ContextWindowService {
    static readonly serviceName = 'contextWindowService';
    static readonly dependencies = [] as const;
    private tokenEstimator: TokenEstimationService;

    constructor() {
        this.tokenEstimator = getTokenEstimationService();
    }

    /**
     * Get context window information for messages
     */
    getContextWindowInfo(messages: Message[], model: string, reservedTokens: number = 0): ContextWindowInfo {
        const estimate = this.tokenEstimator.estimateMessagesTokens(messages, model);
        const contextWindow = this.tokenEstimator.getContextWindowSize(model);
        const totalTokens = estimate.estimatedTotalTokens + reservedTokens;
        const remainingTokens = Math.max(0, contextWindow - totalTokens);
        const utilizationPercent = (totalTokens / contextWindow) * 100;

        return {
            model,
            contextWindowSize: contextWindow,
            estimatedTokens: totalTokens,
            remainingTokens,
            utilizationPercent: Math.min(100, utilizationPercent),
            fits: totalTokens <= contextWindow
        };
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
        } = options;

        const contextWindow = this.tokenEstimator.getContextWindowSize(model);
        const maxTokens = contextWindow - reservedTokens;

        let result: Message[];
        let removedCount = 0;

        if (strategy === 'recent-first') {
            const truncatedResult = this.truncateRecentFirst(messages, maxTokens, keepSystemMessages, keepRecentMessages);
            result = truncatedResult.truncated;
            removedCount = truncatedResult.removedCount;
        } else {
            // Importance-based (future enhancement)
            // For now, fall back to recent-first
            result = this.tokenEstimator.truncateToFitContextWindow(
                messages,
                model,
                reservedTokens,
                keepSystemMessages
            );
            removedCount = messages.length - result.length;
        }

        const info = this.getContextWindowInfo(result, model, reservedTokens);

        return {
            truncated: result,
            removedCount,
            info
        };
    }

    compactMessages(
        messages: Message[],
        model: string,
        options: TruncationOptions = {}
    ): CompactionResult {
        const maxPasses = 4;
        let pass = 0;
        let keepRecentMessages = options.keepRecentMessages ?? 12;
        let summaryTokenBudget = 900;
        let workingMessages = messages;
        const removedMap = new Map<string, Message>();

        while (pass < maxPasses) {
            pass += 1;
            const truncation = this.truncateMessages(workingMessages, model, {
                ...options,
                keepRecentMessages
            });

            if (truncation.removedCount === 0) {
                return {
                    messages: truncation.truncated,
                    removedCount: removedMap.size,
                    compacted: removedMap.size > 0,
                    passes: pass,
                    info: truncation.info
                };
            }

            const keptIds = new Set(truncation.truncated.map(message => message.id));
            const removedMessages = workingMessages.filter(message => !keptIds.has(message.id));
            for (const removed of removedMessages) {
                removedMap.set(removed.id, removed);
            }

            const summary = this.buildCompactedSummary(Array.from(removedMap.values()), summaryTokenBudget);
            if (!summary) {
                return {
                    messages: truncation.truncated,
                    removedCount: removedMap.size,
                    compacted: removedMap.size > 0,
                    passes: pass,
                    info: truncation.info
                };
            }

            const compactMessage: Message = {
                id: `compact-${randomUUID()}`,
                role: 'system',
                content: summary,
                timestamp: new Date()
            };
            workingMessages = this.injectCompactionMessage(truncation.truncated, compactMessage);

            const info = this.getContextWindowInfo(workingMessages, model, options.reservedTokens ?? 0);
            if (info.fits) {
                return {
                    messages: workingMessages,
                    removedCount: removedMap.size,
                    compacted: true,
                    passes: pass,
                    info
                };
            }

            keepRecentMessages = Math.max(2, keepRecentMessages - 3);
            summaryTokenBudget = Math.max(280, summaryTokenBudget - 180);
        }

        const fallback = this.truncateMessages(messages, model, {
            ...options,
            keepRecentMessages: 2
        });
        return {
            messages: fallback.truncated,
            removedCount: messages.length - fallback.truncated.length,
            compacted: false,
            passes: maxPasses,
            info: fallback.info
        };
    }

    private injectCompactionMessage(messages: Message[], compactMessage: Message): Message[] {
        const hasCompactedSummary = messages.some(message =>
            message.role === 'system' &&
            typeof message.content === 'string' &&
            message.content.includes('[COMPACT_CONTEXT]')
        );
        if (hasCompactedSummary) {
            return messages;
        }

        const firstNonSystemIndex = messages.findIndex(message => message.role !== 'system');
        if (firstNonSystemIndex === -1) {
            return [...messages, compactMessage];
        }
        return [
            ...messages.slice(0, firstNonSystemIndex),
            compactMessage,
            ...messages.slice(firstNonSystemIndex)
        ];
    }

    private buildCompactedSummary(removedMessages: Message[], maxSummaryTokens: number): string {
        const filteredMessages = removedMessages.filter(message => message.role !== 'system');
        if (filteredMessages.length === 0) {
            return '';
        }

        const summaryLines: string[] = [];
        const maxMessagesToSummarize = Math.min(filteredMessages.length, 24);
        for (let index = 0; index < maxMessagesToSummarize; index++) {
            const message = filteredMessages[index];
            const extracted = this.extractMessageText(message);
            if (!extracted) {
                continue;
            }
            const compactLine = extracted.length > 220 ? `${extracted.slice(0, 220)}...` : extracted;
            summaryLines.push(`- ${message.role}: ${compactLine}`);
        }

        if (summaryLines.length === 0) {
            return '';
        }

        const header = '[COMPACT_CONTEXT]\nOlder conversation context was compacted to fit the model context window. Treat this as background memory:\n';
        let summary = `${header}${summaryLines.join('\n')}`;
        let tokenCount = this.tokenEstimator.estimateStringTokens(summary);

        while (summaryLines.length > 4 && tokenCount > maxSummaryTokens) {
            summaryLines.pop();
            summary = `${header}${summaryLines.join('\n')}`;
            tokenCount = this.tokenEstimator.estimateStringTokens(summary);
        }

        return summary;
    }

    private extractMessageText(message: Message): string {
        if (typeof message.content === 'string') {
            return message.content.trim();
        }

        if (!Array.isArray(message.content)) {
            return '';
        }

        return message.content
            .filter(part => part.type === 'text')
            .map(part => part.text.trim())
            .filter(Boolean)
            .join(' ');
    }

    private truncateRecentFirst(
        messages: Message[],
        maxTokens: number,
        keepSystemMessages: boolean,
        keepRecentMessages: number
    ): { truncated: Message[]; removedCount: number } {
        // Keep system messages and recent messages
        const systemMessages = keepSystemMessages
            ? messages.filter(m => m.role === 'system')
            : [];

        const nonSystemMessages = messages.filter(m => m.role !== 'system');

        // Always keep the last N messages
        const recentMessages = keepRecentMessages > 0
            ? nonSystemMessages.slice(-keepRecentMessages)
            : [];

        const messagesToProcess = keepRecentMessages > 0
            ? nonSystemMessages.slice(0, -keepRecentMessages)
            : nonSystemMessages;

        let currentTokens = systemMessages.reduce(
            (sum, m) => sum + this.tokenEstimator.estimateMessageTokens(m),
            0
        );
        currentTokens += recentMessages.reduce(
            (sum, m) => sum + this.tokenEstimator.estimateMessageTokens(m),
            0
        );

        const processingList: Message[] = [];
        let removedCount = 0;

        // Add messages from the end until we hit the limit
        for (let i = messagesToProcess.length - 1; i >= 0; i--) {
            const message = messagesToProcess[i];
            const messageTokens = this.tokenEstimator.estimateMessageTokens(message);

            if (currentTokens + messageTokens <= maxTokens) {
                processingList.push(message);
                currentTokens += messageTokens;
            } else {
                removedCount++;
            }
        }

        // Maintain chronological order for the non-system, non-recent part
        const nonSystemTruncated = processingList.reverse();
        return {
            truncated: [...systemMessages, ...nonSystemTruncated, ...recentMessages],
            removedCount
        };
    }

    /**
     * Check if messages need truncation
     */
    needsTruncation(messages: Message[], model: string, reservedTokens: number = 0): boolean {
        const info = this.getContextWindowInfo(messages, model, reservedTokens);
        return !info.fits;
    }

    /**
     * Get recommended truncation settings based on context window utilization
     */
    getRecommendedTruncationSettings(
        messages: Message[],
        model: string,
        reservedTokens: number = 0
    ): TruncationOptions {
        const info = this.getContextWindowInfo(messages, model, reservedTokens);

        if (info.utilizationPercent < 80) {
            // No truncation needed
            return {
                reservedTokens,
                keepSystemMessages: true,
                keepRecentMessages: 10,
                strategy: 'recent-first'
            };
        }

        if (info.utilizationPercent < 95) {
            // Moderate truncation
            return {
                reservedTokens,
                keepSystemMessages: true,
                keepRecentMessages: 20,
                strategy: 'recent-first'
            };
        }

        // Aggressive truncation
        return {
            reservedTokens,
            keepSystemMessages: true,
            keepRecentMessages: 10,
            strategy: 'recent-first'
        };
    }
}

// Singleton instance
let instance: ContextWindowService | null = null;

export function getContextWindowService(): ContextWindowService {
    instance ??= new ContextWindowService();
    return instance;
}

