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
 * Model Collaboration Service
 * Enables multiple LLMs to work together on the same task
 */

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { LLMService } from '@main/services/llm/llm.service';
import { MemoryContextService } from '@main/services/llm/memory-context.service';
import { multiLLMOrchestrator } from '@main/services/llm/multi-llm-orchestrator.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { COLLABORATION_CHANNELS } from '@shared/constants/ipc-channels';
import { Message } from '@shared/types/chat';
import { RuntimeValue } from '@shared/types/common';
import { z } from 'zod';

export interface CollaborationRequest {
    messages: Message[]
    models: Array<{ provider: string; model: string }>
    strategy: 'consensus' | 'vote' | 'best-of-n' | 'chain-of-thought'
    options?: {
        temperature?: number
        maxTokens?: number
    }
}

export interface CollaborationResult {
    responses: Array<{
        provider: string
        model: string
        content: string
        latency: number
        tokens?: number
    }>
    consensus?: string
    votes?: Record<string, number>
    bestResponse?: {
        provider: string
        model: string
        content: string
    }
}

const COLLABORATION_MEMORY_TIMEOUT_MS = 450;
const COLLABORATION_MEMORY_MATCH_LIMIT = 3;

const CollaborationConfigSchema = z.object({
    maxConcurrent: z.any().refine(val => typeof val === 'number' && val > 0, { message: 'maxConcurrent must be a positive number' }),
    priority: z.any().refine(val => typeof val === 'number', { message: 'priority must be a number' }),
    rateLimitPerMinute: z.any().refine(val => typeof val === 'number' && val > 0, { message: 'rateLimitPerMinute must be a positive number' }),
});

const collaborationRequestSchema = z.object({
    messages: z.array(z.any()),
    models: z.array(z.object({
        provider: z.string(),
        model: z.string()
    })).min(1),
    strategy: z.enum(['consensus', 'vote', 'best-of-n', 'chain-of-thought']),
    options: z.object({
        temperature: z.number().optional(),
        maxTokens: z.number().optional()
    }).optional()
});

/**
 * Service for coordinating multiple LLMs to work together
 */
export class ModelCollaborationService extends BaseService {
    static readonly serviceName = 'modelCollaborationService';
    static readonly dependencies = ['llmService', 'advancedMemoryService'] as const;
    private readonly memoryContext: MemoryContextService;

    constructor(
        private llmService: LLMService,
        advancedMemoryService?: AdvancedMemoryService
    ) {
        super('ModelCollaborationService');
        this.memoryContext = new MemoryContextService(advancedMemoryService);
    }

    /**
     * Run multiple models in collaboration
     */
    @ipc(COLLABORATION_CHANNELS.RUN)
    async collaborateIpc(requestRaw: RuntimeValue): Promise<RuntimeValue> {
        const validated = collaborationRequestSchema.safeParse(requestRaw);
        if (!validated.success) {
            throw new Error(`Invalid collaboration request: ${validated.error.message}`);
        }
        const request = validated.data as CollaborationRequest;

        return serializeToIpc(await this.collaborate(request));
    }

    async collaborate(request: CollaborationRequest): Promise<CollaborationResult> {
        const { messages, models, strategy, options } = request;
        const memoryContext = await this.getResolutionMemoryContext(messages);
        const memoryAwareMessages = this.memoryContext.prependMemoryMessage(messages, memoryContext);

        // Execute all models in parallel
        const promises = models.map(({ provider, model }) =>
            this.executeModel(provider, model, memoryAwareMessages, options)
        );

        const responses = await Promise.allSettled(promises);

        const results = responses
            .map((result, index) => {
                if (result.status === 'fulfilled') {
                    return {
                        provider: models[index].provider,
                        model: models[index].model,
                        ...result.value
                    };
                }
                return null;
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

        // Apply strategy to combine results
        const collaborationResult: CollaborationResult = {
            responses: results
        };

        switch (strategy) {
            case 'consensus':
                collaborationResult.consensus = this.buildConsensus(results);
                break;
            case 'vote':
                collaborationResult.votes = this.voteOnResponses(results);
                break;
            case 'best-of-n':
                collaborationResult.bestResponse = this.selectBestResponse(results);
                break;
            case 'chain-of-thought':
                collaborationResult.consensus = this.chainOfThought(results, memoryAwareMessages);
                break;
        }

        this.captureCollaborationMemory(memoryAwareMessages, strategy, collaborationResult);

        return collaborationResult;
    }

    /**
     * Get provider statistics
     */
    @ipc(COLLABORATION_CHANNELS.GET_PROVIDER_STATS)
    async getProviderStatsIpc(provider: RuntimeValue): Promise<RuntimeValue> {
        try {
            if (!provider || typeof provider !== 'string') {
                const allStats = multiLLMOrchestrator.getAllStats();
                return serializeToIpc(Object.fromEntries(allStats));
            }
            const stats = multiLLMOrchestrator.getProviderStats(provider);
            return serializeToIpc(stats ?? null);
        } catch {
            return serializeToIpc({});
        }
    }

    /**
     * Get active task count for a provider
     */
    @ipc(COLLABORATION_CHANNELS.GET_ACTIVE_TASK_COUNT)
    async getActiveTaskCountIpc(provider: RuntimeValue): Promise<RuntimeValue> {
        try {
            if (typeof provider !== 'string') {
                return serializeToIpc(0);
            }
            return serializeToIpc(multiLLMOrchestrator.getActiveTaskCount(provider));
        } catch {
            return serializeToIpc(0);
        }
    }

    /**
     * Configure provider settings
     */
    @ipc(COLLABORATION_CHANNELS.SET_PROVIDER_CONFIG)
    async setProviderConfigIpc(provider: RuntimeValue, config: RuntimeValue): Promise<RuntimeValue> {
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string');
        }

        try {
            const validatedConfig = CollaborationConfigSchema.parse(config);
            multiLLMOrchestrator.setProviderConfig(provider, validatedConfig);
            return serializeToIpc({ success: true });
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(error.issues[0].message);
            }
            throw error;
        }
    }

    /**
     * Execute a single model
     */
    private async executeModel(
        provider: string,
        model: string,
        messages: Message[],
        _options?: { temperature?: number; maxTokens?: number }
    ): Promise<{ content: string; latency: number; tokens?: number }> {
        const startTime = Date.now();

        try {
            const response = await this.llmService.chat(
                messages,
                model,
                undefined,
                provider
            );

            const latency = Date.now() - startTime;
            const content = response.content;

            return {
                content,
                latency,
                tokens: response.completionTokens
            };
        } catch (error) {
            appLogger.error('ModelCollaboration', `Error with ${provider}/${model}`, error as Error);
            throw error;
        }
    }

    /**
     * Build consensus from multiple responses
     */
    private buildConsensus(responses: CollaborationResult['responses']): string {
        if (responses.length === 0) { return ''; }
        if (responses.length === 1) { return responses[0].content; }

        // Simple consensus: find common themes and combine
        const contents = responses.map(r => r.content);
        const words = contents.flatMap(c => c.split(/\s+/));

        // Count word frequencies
        const wordFreq = new Map<string, number>();
        words.forEach(word => {
            const normalized = word.toLowerCase().replace(/[^\w]/g, '');
            if (normalized.length > 3) { // Ignore short words
                wordFreq.set(normalized, (wordFreq.get(normalized) ?? 0) + 1);
            }
        });

        // Find consensus words (appear in multiple responses)
        const consensusWords = Array.from(wordFreq.entries())
            .filter(([_, count]) => count >= Math.ceil(responses.length / 2))
            .map(([word]) => word);

        // Build consensus text
        if (consensusWords.length === 0) {
            // Fallback: return the longest response
            return responses.reduce((best, current) =>
                current.content.length > best.content.length ? current : best
            ).content;
        }

        // Return response that contains most consensus words
        const scored = responses.map(r => ({
            response: r,
            score: consensusWords.filter(word =>
                r.content.toLowerCase().includes(word)
            ).length
        }));

        return scored.reduce((best, current) =>
            current.score > best.score ? current : best
        ).response.content;
    }

    /**
     * Vote on responses (simple majority)
     */
    private voteOnResponses(responses: CollaborationResult['responses']): Record<string, number> {
        const votes: Record<string, number> = {};

        responses.forEach((r) => {
            const key = `${r.provider}/${r.model}`;
            votes[key] = (votes[key] ?? 0) + 1;
        });

        return votes;
    }

    /**
     * Select best response based on quality heuristics
     */
    private selectBestResponse(
        responses: CollaborationResult['responses']
    ): CollaborationResult['bestResponse'] {
        if (responses.length === 0) { return undefined; }

        // Score responses based on:
        // 1. Length (not too short, not too long)
        // 2. Latency (faster is better)
        // 3. Token efficiency (if available)

        const scored = responses.map(r => {
            const lengthScore = Math.min(r.content.length / 500, 1); // Prefer ~500 chars
            const latencyScore = Math.max(0, 1 - r.latency / 10000); // Prefer <10s
            const tokenScore = r.tokens ? Math.max(0, 1 - r.tokens / 2000) : 0.5;

            return {
                response: r,
                score: (lengthScore * 0.4 + latencyScore * 0.3 + tokenScore * 0.3)
            };
        });

        const best = scored.reduce((best, current) =>
            current.score > best.score ? current : best
        );

        return {
            provider: best.response.provider,
            model: best.response.model,
            content: best.response.content
        };
    }

    /**
     * Chain of thought: use one model's response as context for another
     */
    private chainOfThought(
        responses: CollaborationResult['responses'],
        _originalMessages: Message[]
    ): string {
        if (responses.length === 0) { return ''; }
        if (responses.length === 1) { return responses[0].content; }

        // For now, return combined responses
        // In a full implementation, this would call another model with the first response as context
        return responses.map(r => r.content).join('\n\n---\n\n');
    }

    private async getResolutionMemoryContext(messages: Message[]): Promise<string | undefined> {
        const lastUserMessage = [...messages].reverse().find(message => message.role === 'user');
        if (!lastUserMessage) {
            return undefined;
        }
        const query = this.normalizeMessageContent(lastUserMessage.content).trim();
        return this.memoryContext.getResolutionContext(query, {
            timeoutMs: COLLABORATION_MEMORY_TIMEOUT_MS,
            limit: COLLABORATION_MEMORY_MATCH_LIMIT
        });
    }

    private normalizeMessageContent(content: Message['content']): string {
        if (typeof content === 'string') {
            return content;
        }
        return content
            .map(item => item.type === 'text' ? item.text : item.image_url.url)
            .join('\n');
    }

    private captureCollaborationMemory(
        messages: Message[],
        strategy: CollaborationRequest['strategy'],
        result: CollaborationResult
    ): void {
        if (result.responses.length === 0) {
            return;
        }

        let provider = result.responses[0].provider;
        let model = result.responses[0].model;
        let content = result.responses[0].content;

        if (strategy === 'best-of-n' && result.bestResponse) {
            provider = result.bestResponse.provider;
            model = result.bestResponse.model;
            content = result.bestResponse.content;
        } else if ((strategy === 'consensus' || strategy === 'chain-of-thought') && result.consensus) {
            content = result.consensus;
        }

        if (!content.trim()) {
            return;
        }

        this.memoryContext.captureConversation({
            provider,
            model,
            messages,
            assistantContent: content
        });
    }
}

