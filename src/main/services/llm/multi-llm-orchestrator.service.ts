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
 * Multi-LLM Orchestrator Service
 * Enables multiple LLMs to work simultaneously with proper resource management
 */

import { EventEmitter } from 'events';

import { appLogger } from '@main/logging/logger';

export interface ProviderConfig {
    maxConcurrent: number
    priority: number // Higher = more priority
    rateLimitPerMinute: number
}

export interface LLMTask {
    taskId: string
    chatId: string
    provider: string
    model: string
    execute: () => Promise<void>
    priority?: number
}

export interface ProviderStats {
    activeTasks: number
    queuedTasks: number
    totalCompleted: number
    totalErrors: number
    averageLatency: number
}

/** Maximum entries allowed in task-tracking Maps before pruning oldest */
const MAX_MAP_SIZE = 10_000;

/**
 * Advanced orchestrator for managing multiple LLM providers simultaneously
 */
export class MultiLLMOrchestrator extends EventEmitter {
    private providerQueues: Map<string, LLMTask[]> = new Map();
    private activeTasks: Map<string, LLMTask> = new Map();
    private providerConfigs: Map<string, ProviderConfig> = new Map();
    private providerStats: Map<string, ProviderStats> = new Map();
    private taskStartTimes: Map<string, number> = new Map();

    constructor() {
        super();
        this.initializeDefaultConfigs();
    }

    /** Count active tasks matching a predicate without intermediate arrays */
    private countActiveTasks(predicate: (task: LLMTask) => boolean): number {
        let count = 0;
        for (const task of this.activeTasks.values()) {
            if (predicate(task)) {
                count++;
            }
        }
        return count;
    }

    private initializeDefaultConfigs() {
        // IconCloud providers can handle more concurrent requests
        this.setProviderConfig('openai', {
            maxConcurrent: 5,
            priority: 10,
            rateLimitPerMinute: 60
        });
        this.setProviderConfig('anthropic', {
            maxConcurrent: 5,
            priority: 10,
            rateLimitPerMinute: 50
        });
        this.setProviderConfig('groq', {
            maxConcurrent: 10,
            priority: 8,
            rateLimitPerMinute: 30
        });
        this.setProviderConfig('gemini', {
            maxConcurrent: 5,
            priority: 9,
            rateLimitPerMinute: 60
        });

        // Local providers are more resource-constrained
        this.setProviderConfig('ollama', {
            maxConcurrent: 10,
            priority: 5,
            rateLimitPerMinute: 60
        });
        this.setProviderConfig('llama', {
            maxConcurrent: 1,
            priority: 3,
            rateLimitPerMinute: 5
        });
        this.setProviderConfig('copilot', {
            maxConcurrent: 3,
            priority: 7,
            rateLimitPerMinute: 20
        });
        this.setProviderConfig('opencode', {
            maxConcurrent: 3,
            priority: 8,
            rateLimitPerMinute: 30
        });
        this.setProviderConfig('nvidia', {
            maxConcurrent: 5,
            priority: 9,
            rateLimitPerMinute: 50
        });
    }

    /**
     * Configure a provider's concurrency limits
     */
    setProviderConfig(provider: string, config: ProviderConfig) {
        this.providerConfigs.set(provider.toLowerCase(), config);
        if (!this.providerStats.has(provider.toLowerCase())) {
            this.providerStats.set(provider.toLowerCase(), {
                activeTasks: 0,
                queuedTasks: 0,
                totalCompleted: 0,
                totalErrors: 0,
                averageLatency: 0
            });
        }
        void this.processQueues();
    }

    /**
     * Add a task to the appropriate provider queue
     */
    async addTask(task: LLMTask) {
        const provider = task.provider.toLowerCase();
        const normalizedProvider = this.normalizeProvider(provider);

        if (!this.providerQueues.has(normalizedProvider)) {
            this.providerQueues.set(normalizedProvider, []);
        }

        const queue = this.providerQueues.get(normalizedProvider);
        if (!queue) {
            throw new Error(`Failed to get queue for provider: ${normalizedProvider}`);
        }
        queue.push(task);

        // Sort by priority (higher first)
        queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

        this.updateProviderStats(normalizedProvider);
        void this.processQueues();
    }

    /**
     * Normalize provider names to handle variations
     */
    private normalizeProvider(provider: string): string {
        const lower = provider.toLowerCase();

        const rules: Array<{ pattern: RegExp; normalized: string }> = [
            { pattern: /openai|gpt/, normalized: 'openai' },
            { pattern: /anthropic|claude/, normalized: 'anthropic' },
            { pattern: /groq/, normalized: 'groq' },
            { pattern: /nvidia/, normalized: 'nvidia' },
            { pattern: /antigravity/, normalized: 'antigravity' },
            { pattern: /gemini|google/, normalized: 'gemini' },
            { pattern: /ollama/, normalized: 'ollama' },
            { pattern: /^llama/, normalized: 'llama' },
            { pattern: /copilot|github/, normalized: 'copilot' }
        ];

        // Llama special case: if it contains 'llama' but NOT 'ollama', it's 'llama'
        // But since we check ordered list, if we check ollama first, we are good?
        // Actually, if string is "ollama-llama3", /ollama/ matches.
        // If string is "llama-cpp", /ollama/ fails.
        // So simple order is enough.

        for (const { pattern, normalized } of rules) {
            if (pattern.test(lower)) {
                return normalized;
            }
        }

        return lower;
    }

    /**
     * Process all provider queues
     */
    private async processQueues() {
        for (const [provider, queue] of this.providerQueues.entries()) {
            await this.processProviderQueue(provider, queue);
        }
    }

    /**
     * Process a specific provider's queue
     */
    private async processProviderQueue(provider: string, queue: LLMTask[]) {
        const config = this.providerConfigs.get(provider);
        if (!config) {
            appLogger.warn('MultiLLMOrchestrator', `No config for provider: ${provider}`);
            return;
        }

        const activeForProvider = this.countActiveTasks(
            t => this.normalizeProvider(t.provider) === provider
        );

        const maxConcurrent = config.maxConcurrent;
        const availableSlots = maxConcurrent - activeForProvider;

        if (availableSlots <= 0 || queue.length === 0) {
            return;
        }

        const tasksToStart = queue.splice(0, availableSlots);

        for (const task of tasksToStart) {
            void this.startTask(task);
        }
    }

    /**
     * Prune oldest entries from a Map when it exceeds MAX_MAP_SIZE
     */
    private pruneMap<V>(map: Map<string, V>): void {
        if (map.size <= MAX_MAP_SIZE) {return;}
        const excess = map.size - MAX_MAP_SIZE;
        const iter = map.keys();
        for (let i = 0; i < excess; i++) {
            const key = iter.next().value;
            if (key !== undefined) {map.delete(key);}
        }
        appLogger.warn('MultiLLMOrchestrator', `Pruned ${excess} oldest entries from Map (limit: ${MAX_MAP_SIZE})`);
    }

    /**
     * Start executing a task
     */
    private async startTask(task: LLMTask) {
        this.pruneMap(this.activeTasks);
        this.pruneMap(this.taskStartTimes);
        this.activeTasks.set(task.taskId, task);
        this.taskStartTimes.set(task.taskId, Date.now());

        const provider = this.normalizeProvider(task.provider);
        const stats = this.providerStats.get(provider);
        if (stats) {
            stats.activeTasks++;
            stats.queuedTasks = Math.max(0, stats.queuedTasks - 1);
        }

        this.broadcastStatus(task.chatId, true, provider);

        try {
            await task.execute();

            // Record success
            const endTime = Date.now();
            const startTime = this.taskStartTimes.get(task.taskId) ?? endTime;
            const latency = endTime - startTime;

            if (stats) {
                stats.totalCompleted++;
                stats.activeTasks--;
                // Update average latency (exponential moving average)
                stats.averageLatency = stats.averageLatency === 0
                    ? latency
                    : (stats.averageLatency * 0.9 + latency * 0.1);
            }
        } catch (error) {
            appLogger.error('MultiLLMOrchestrator', `Error in task ${task.taskId}`, error as Error);

            const provider = this.normalizeProvider(task.provider);
            const stats = this.providerStats.get(provider);
            if (stats) {
                stats.totalErrors++;
                stats.activeTasks--;
            }
        } finally {
            this.activeTasks.delete(task.taskId);
            this.taskStartTimes.delete(task.taskId);
            this.broadcastStatus(task.chatId, false, provider);
            void this.processQueues(); // Process next tasks
        }
    }

    /**
     * Broadcast status updates to renderer
     */
    private broadcastStatus(chatId: string, isGenerating: boolean, provider: string) {
        void chatId;
        void isGenerating;
        void provider;
    }

    /**
     * Update provider statistics
     */
    private updateProviderStats(provider: string) {
        const queue = this.providerQueues.get(provider) ?? [];
        const stats = this.providerStats.get(provider);
        if (stats) {
            stats.queuedTasks = queue.length;
        }
    }

    /**
     * Get statistics for a provider
     */
    getProviderStats(provider: string): ProviderStats | null {
        return this.providerStats.get(provider.toLowerCase()) ?? null;
    }

    /**
     * Get all provider statistics
     */
    getAllStats(): Map<string, ProviderStats> {
        return new Map(this.providerStats);
    }

    /**
     * Check if a chat is currently generating
     */
    isGenerating(chatId: string): boolean {
        for (const task of this.activeTasks.values()) {
            if (task.chatId === chatId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get active task count for a provider
     */
    getActiveTaskCount(provider: string): number {
        const normalized = this.normalizeProvider(provider);
        return this.countActiveTasks(t => this.normalizeProvider(t.provider) === normalized);
    }

    /**
     * Cancel a task
     */
    cancelTask(taskId: string): boolean {
        // Remove from queue
        for (const queue of this.providerQueues.values()) {
            const index = queue.findIndex(t => t.taskId === taskId);
            if (index !== -1) {
                queue.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * Dispose of all resources and clear Maps
     */
    dispose(): void {
        this.providerQueues.clear();
        this.activeTasks.clear();
        this.providerConfigs.clear();
        this.providerStats.clear();
        this.taskStartTimes.clear();
        this.removeAllListeners();
        appLogger.info('MultiLLMOrchestrator', 'Disposed all resources');
    }

    /**
     * Cancel all tasks for a chat
     */
    cancelChatTasks(chatId: string): number {
        let cancelled = 0;

        // Cancel from queues
        for (const queue of this.providerQueues.values()) {
            const tasks = queue.filter(t => t.chatId === chatId);
            tasks.forEach(t => {
                const index = queue.indexOf(t);
                if (index !== -1) {
                    queue.splice(index, 1);
                    cancelled++;
                }
            });
        }

        return cancelled;
    }
}

// Singleton instance
export const multiLLMOrchestrator = new MultiLLMOrchestrator();

