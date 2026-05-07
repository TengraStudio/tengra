/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EventEmitter } from 'events';

import { appLogger } from '@main/logging/logger';
import { multiLLMOrchestrator } from '@main/services/llm/multi-llm-orchestrator.service';
import { v4 as uuidv4 } from 'uuid';

export type OrchestrationPolicy = 'auto' | 'fifo' | 'parallel'

export interface ChatTask {
    chatId: string
    provider?: string
    model?: string
    execute: () => Promise<void>
    priority?: number
}

/**
 * Enhanced Chat Queue Manager with multi-LLM support
 * Now delegates to MultiLLMOrchestrator for better concurrency
 */
export class ChatQueueManager extends EventEmitter {
    private queue: ChatTask[] = [];
    private activeCount = 0;
    private policy: OrchestrationPolicy = 'auto';
    private generatingChats: Set<string> = new Set();
    private useMultiLLM: boolean = true; // Use new orchestrator by default

    constructor() {
        super();
    }

    /**
     * Enable or disable the multi-LLM orchestrator
     */
    setUseMultiLLM(use: boolean) {
        this.useMultiLLM = use;
    }

    setPolicy(policy: OrchestrationPolicy) {
        this.policy = policy;
        if (this.useMultiLLM) {
            // Multi-LLM orchestrator handles its own processing
            return;
        }
        void this.processQueue();
    }

    async addTask(chatId: string, execute: () => Promise<void>, options?: {
        provider?: string
        model?: string
        priority?: number
    }) {
        if (this.useMultiLLM && options?.provider) {
            // Use new multi-LLM orchestrator
            const taskId = uuidv4();
            await multiLLMOrchestrator.addTask({
                taskId,
                chatId,
                provider: options.provider,
                model: options.model ?? 'default',
                execute,
                priority: options.priority
            });
            return;
        }

        // Fallback to legacy queue system
        this.queue.push({ chatId, execute, ...options });
        this.updateStatus(chatId, true);
        void this.processQueue();
    }

    private updateStatus(chatId: string, isGenerating: boolean) {
        if (isGenerating) {
            this.generatingChats.add(chatId);
        } else {
            this.generatingChats.delete(chatId);
        }

        void chatId;
        void isGenerating;
    }

    private async processQueue() {
        const maxConcurrency = this.getMaxConcurrency();

        if (this.activeCount >= maxConcurrency || this.queue.length === 0) {
            return;
        }

        const MAX_PROCESS_ITERATIONS = 10000;
        let iterations = 0;

        while (this.activeCount < maxConcurrency && this.queue.length > 0 && iterations < MAX_PROCESS_ITERATIONS) {
            const task = this.queue.shift();
            if (!task) { break; }

            this.activeCount++;
            iterations++;

            void this.processTask(task).finally(() => {
                this.activeCount--;
                this.updateStatus(task.chatId, false);
            });
        }

        if (iterations >= MAX_PROCESS_ITERATIONS) {
            appLogger.error('ChatQueueManager', 'Queue processing exceeded maximum iterations');
        }
    }

    private getMaxConcurrency(): number {
        if (this.policy === 'parallel') { return 10; } // Arbitrary high number
        if (this.policy === 'fifo') { return 1; }

        // Auto: Use multi-LLM orchestrator's intelligent concurrency
        return this.useMultiLLM ? 10 : 1;
    }

    isGenerating(chatId: string): boolean {
        if (this.useMultiLLM) {
            return multiLLMOrchestrator.isGenerating(chatId);
        }
        return this.generatingChats.has(chatId);
    }

    /**
     * Get provider statistics (delegates to orchestrator)
     */
    getProviderStats(provider: string) {
        if (this.useMultiLLM) {
            return multiLLMOrchestrator.getProviderStats(provider);
        }
        return null;
    }

    private async processTask(task: ChatTask) {
        try {
            await task.execute();
        } catch (error) {
            appLogger.error('ChatQueueManager', `Error in task ${task.chatId}`, error as Error);
        }
    }
}

export const chatQueueManager = new ChatQueueManager();

