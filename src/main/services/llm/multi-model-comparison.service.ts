/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { LLMService } from '@main/services/llm/llm.service';
import { MemoryContextService } from '@main/services/llm/memory-context.service';
import { LLMTask, MultiLLMOrchestrator } from '@main/services/llm/multi-llm-orchestrator.service';
import { ChatMessage, OpenAIResponse } from '@main/types/llm.types';
import { Message as SharedMessage } from '@shared/types/chat';
import { ServiceResponse } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

export interface ComparisonRequest {
    chatId: string;
    messages: ChatMessage[];
    models: Array<{ provider: string; model: string }>;
}

export interface ComparisonResponse {
    results: Record<string, { success: boolean; data?: OpenAIResponse; error?: string }>;
}

const COMPARISON_MEMORY_TIMEOUT_MS = 450;
const COMPARISON_MEMORY_MATCH_LIMIT = 3;

export class MultiModelComparisonService extends BaseService {
    private readonly memoryContext: MemoryContextService;

    constructor(
        private llmService: LLMService,
        private orchestrator: MultiLLMOrchestrator,
        advancedMemoryService?: AdvancedMemoryService
    ) {
        super('MultiModelComparisonService');
        this.memoryContext = new MemoryContextService(advancedMemoryService);
    }

    async compareModels(request: ComparisonRequest): Promise<ServiceResponse<ComparisonResponse>> {
        const results: Record<string, { success: boolean; data?: OpenAIResponse; error?: string }> = {};
        const promises: Array<Promise<void>> = [];
        const memoryContext = await this.getResolutionMemoryContext(request.messages);
        const memoryAwareMessages = this.memoryContext.prependMemoryChatMessage(request.messages, memoryContext);

        for (const target of request.models) {
            const taskId = uuidv4();
            const modelKey = `${target.provider}:${target.model}`;

            const task: LLMTask = {
                taskId,
                chatId: request.chatId,
                provider: target.provider,
                model: target.model,
                execute: async () => {
                    try {
                        const response = await this.llmService.chat(
                            memoryAwareMessages,
                            target.model,
                            [],
                            target.provider
                        );
                        results[modelKey] = { success: true, data: response };
                        this.captureComparisonMemory(request.chatId, memoryAwareMessages, target.provider, target.model, response.content);
                    } catch (error) {
                        results[modelKey] = { success: false, error: getErrorMessage(error) };
                    }
                }
            };

            promises.push(this.orchestrator.addTask(task));
        }

        try {
            // Wait for all tasks to be at least "handled" (executed or queued and finished)
            // Note: addTask returns when the task is added, not when it's finished.
            // We need a way to wait for the tasks to finish.
            // Let's modify the execute wrapper to notify us.

            await this.waitForComparison(promises, results, request.models.length);

            return { success: true, result: { results } };
        } catch (error) {
            return { success: false, error: getErrorMessage(error) };
        }
    }

    private async waitForComparison(
        addPromises: Array<Promise<void>>,
        results: Record<string, { success: boolean; data?: OpenAIResponse; error?: string }>,
        expectedCount: number
    ): Promise<void> {
        // Wait for all addTask calls to complete
        await Promise.all(addPromises);

        // Simple polling for results (NASA Rule 2: Fixed loop bounds)
        let attempts = 0;
        const maxAttempts = 120; // 60 seconds with 500ms sleep

        while (Object.keys(results).length < expectedCount && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        if (attempts >= maxAttempts) {
            appLogger.warn('MultiModelComparisonService', 'Comparison timed out for some models');
        }
    }

    override async cleanup(): Promise<void> {
        // Stateless service; nothing to dispose currently.
    }

    private async getResolutionMemoryContext(messages: ChatMessage[]): Promise<string | undefined> {
        const lastUserMessage = [...messages].reverse().find(message => message.role === 'user');
        if (!lastUserMessage) {
            return undefined;
        }

        const query = this.normalizeChatContent(lastUserMessage.content).trim();
        if (query.length < 4) {
            return undefined;
        }

        return this.memoryContext.getResolutionContext(query, {
            timeoutMs: COMPARISON_MEMORY_TIMEOUT_MS,
            limit: COMPARISON_MEMORY_MATCH_LIMIT
        });
    }

    private captureComparisonMemory(
        chatId: string,
        messages: ChatMessage[],
        provider: string,
        model: string,
        assistantContent: string
    ): void {
        const normalizedAssistantContent = assistantContent.trim();
        if (!normalizedAssistantContent) {
            return;
        }

        const convertedMessages = this.toSharedMessages(messages);
        if (convertedMessages.length === 0) {
            return;
        }

        this.memoryContext.captureConversation({
            chatId,
            provider,
            model,
            messages: convertedMessages,
            assistantContent: normalizedAssistantContent
        });
    }

    private toSharedMessages(messages: ChatMessage[]): SharedMessage[] {
        const now = Date.now();
        return messages.map((message, index) => {
            const sharedRole: SharedMessage['role'] = message.role === 'function' ? 'tool' : message.role;
            return {
                id: `comparison-${now}-${index}`,
                role: sharedRole,
                content: this.normalizeChatContent(message.content),
                timestamp: new Date(now + index)
            };
        });
    }

    private normalizeChatContent(content: ChatMessage['content']): string {
        if (typeof content === 'string') {
            return content;
        }
        return content
            .map(part => {
                if (part.type === 'text') {
                    return part.text ?? '';
                }
                if (part.type === 'image_url') {
                    return part.image_url?.url ?? '';
                }
                return '[image]';
            })
            .join('\n');
    }

}
