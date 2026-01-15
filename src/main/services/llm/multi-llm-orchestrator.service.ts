/**
 * Multi-LLM Orchestrator Service
 * Enables multiple LLMs to work simultaneously with proper resource management
 */

import { EventEmitter } from 'events'

import { BrowserWindow } from 'electron'

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

/**
 * Advanced orchestrator for managing multiple LLM providers simultaneously
 */
export class MultiLLMOrchestrator extends EventEmitter {
    private providerQueues: Map<string, LLMTask[]> = new Map()
    private activeTasks: Map<string, LLMTask> = new Map()
    private providerConfigs: Map<string, ProviderConfig> = new Map()
    private providerStats: Map<string, ProviderStats> = new Map()
    private taskStartTimes: Map<string, number> = new Map()

    constructor() {
        super()
        this.initializeDefaultConfigs()
    }

    private initializeDefaultConfigs() {
        // Cloud providers can handle more concurrent requests
        this.setProviderConfig('openai', {
            maxConcurrent: 5,
            priority: 10,
            rateLimitPerMinute: 60
        })
        this.setProviderConfig('anthropic', {
            maxConcurrent: 5,
            priority: 10,
            rateLimitPerMinute: 50
        })
        this.setProviderConfig('groq', {
            maxConcurrent: 10,
            priority: 8,
            rateLimitPerMinute: 30
        })
        this.setProviderConfig('gemini', {
            maxConcurrent: 5,
            priority: 9,
            rateLimitPerMinute: 60
        })

        // Local providers are more resource-constrained
        this.setProviderConfig('ollama', {
            maxConcurrent: 2,
            priority: 5,
            rateLimitPerMinute: 10
        })
        this.setProviderConfig('llama', {
            maxConcurrent: 1,
            priority: 3,
            rateLimitPerMinute: 5
        })
        this.setProviderConfig('copilot', {
            maxConcurrent: 3,
            priority: 7,
            rateLimitPerMinute: 20
        })
        this.setProviderConfig('opencode', {
            maxConcurrent: 3,
            priority: 8,
            rateLimitPerMinute: 30
        })
    }

    /**
     * Configure a provider's concurrency limits
     */
    setProviderConfig(provider: string, config: ProviderConfig) {
        this.providerConfigs.set(provider.toLowerCase(), config)
        if (!this.providerStats.has(provider.toLowerCase())) {
            this.providerStats.set(provider.toLowerCase(), {
                activeTasks: 0,
                queuedTasks: 0,
                totalCompleted: 0,
                totalErrors: 0,
                averageLatency: 0
            })
        }
        this.processQueues()
    }

    /**
     * Add a task to the appropriate provider queue
     */
    async addTask(task: LLMTask) {
        const provider = task.provider.toLowerCase()
        const normalizedProvider = this.normalizeProvider(provider)

        if (!this.providerQueues.has(normalizedProvider)) {
            this.providerQueues.set(normalizedProvider, [])
        }

        const queue = this.providerQueues.get(normalizedProvider)!
        queue.push(task)

        // Sort by priority (higher first)
        queue.sort((a, b) => (b.priority || 0) - (a.priority || 0))

        this.updateProviderStats(normalizedProvider)
        this.processQueues()
    }

    /**
     * Normalize provider names to handle variations
     */
    private normalizeProvider(provider: string): string {
        const lower = provider.toLowerCase()
        if (lower.includes('openai') || lower.includes('gpt')) {return 'openai'}
        if (lower.includes('anthropic') || lower.includes('claude')) {return 'anthropic'}
        if (lower.includes('groq')) {return 'groq'}
        if (lower.includes('gemini') || lower.includes('google') || lower.includes('antigravity')) {return 'gemini'}
        if (lower.includes('ollama')) {return 'ollama'}
        if (lower.includes('llama') && !lower.includes('ollama')) {return 'llama'}
        if (lower.includes('copilot') || lower.includes('github')) {return 'copilot'}
        return lower
    }

    /**
     * Process all provider queues
     */
    private async processQueues() {
        for (const [provider, queue] of this.providerQueues.entries()) {
            await this.processProviderQueue(provider, queue)
        }
    }

    /**
     * Process a specific provider's queue
     */
    private async processProviderQueue(provider: string, queue: LLMTask[]) {
        const config = this.providerConfigs.get(provider)
        if (!config) {
            console.warn(`[MultiLLMOrchestrator] No config for provider: ${provider}`)
            return
        }

        const activeForProvider = Array.from(this.activeTasks.values())
            .filter(t => this.normalizeProvider(t.provider) === provider).length

        const maxConcurrent = config.maxConcurrent
        const availableSlots = maxConcurrent - activeForProvider

        if (availableSlots <= 0 || queue.length === 0) {
            return
        }

        const tasksToStart = queue.splice(0, availableSlots)

        for (const task of tasksToStart) {
            this.startTask(task)
        }
    }

    /**
     * Start executing a task
     */
    private async startTask(task: LLMTask) {
        this.activeTasks.set(task.taskId, task)
        this.taskStartTimes.set(task.taskId, Date.now())

        const provider = this.normalizeProvider(task.provider)
        const stats = this.providerStats.get(provider)
        if (stats) {
            stats.activeTasks++
            stats.queuedTasks = Math.max(0, stats.queuedTasks - 1)
        }

        this.broadcastStatus(task.chatId, true, provider)

        try {
            await task.execute()

            // Record success
            const endTime = Date.now()
            const startTime = this.taskStartTimes.get(task.taskId) || endTime
            const latency = endTime - startTime

            if (stats) {
                stats.totalCompleted++
                stats.activeTasks--
                // Update average latency (exponential moving average)
                stats.averageLatency = stats.averageLatency === 0
                    ? latency
                    : (stats.averageLatency * 0.9 + latency * 0.1)
            }
        } catch (error) {
            console.error(`[MultiLLMOrchestrator] Error in task ${task.taskId}:`, error)

            const provider = this.normalizeProvider(task.provider)
            const stats = this.providerStats.get(provider)
            if (stats) {
                stats.totalErrors++
                stats.activeTasks--
            }
        } finally {
            this.activeTasks.delete(task.taskId)
            this.taskStartTimes.delete(task.taskId)
            this.broadcastStatus(task.chatId, false, provider)
            this.processQueues() // Process next tasks
        }
    }

    /**
     * Broadcast status updates to renderer
     */
    private broadcastStatus(chatId: string, isGenerating: boolean, provider: string) {
        const windows = BrowserWindow.getAllWindows()
        windows.forEach(win => {
            win.webContents.send('chat:generation-status', {
                chatId,
                isGenerating,
                provider
            })
        })
    }

    /**
     * Update provider statistics
     */
    private updateProviderStats(provider: string) {
        const queue = this.providerQueues.get(provider) || []
        const stats = this.providerStats.get(provider)
        if (stats) {
            stats.queuedTasks = queue.length
        }
    }

    /**
     * Get statistics for a provider
     */
    getProviderStats(provider: string): ProviderStats | null {
        return this.providerStats.get(provider.toLowerCase()) || null
    }

    /**
     * Get all provider statistics
     */
    getAllStats(): Map<string, ProviderStats> {
        return new Map(this.providerStats)
    }

    /**
     * Check if a chat is currently generating
     */
    isGenerating(chatId: string): boolean {
        return Array.from(this.activeTasks.values())
            .some(task => task.chatId === chatId)
    }

    /**
     * Get active task count for a provider
     */
    getActiveTaskCount(provider: string): number {
        const normalized = this.normalizeProvider(provider)
        return Array.from(this.activeTasks.values())
            .filter(t => this.normalizeProvider(t.provider) === normalized).length
    }

    /**
     * Cancel a task
     */
    cancelTask(taskId: string): boolean {
        // Remove from queue
        for (const queue of this.providerQueues.values()) {
            const index = queue.findIndex(t => t.taskId === taskId)
            if (index !== -1) {
                queue.splice(index, 1)
                return true
            }
        }
        return false
    }

    /**
     * Cancel all tasks for a chat
     */
    cancelChatTasks(chatId: string): number {
        let cancelled = 0

        // Cancel from queues
        for (const queue of this.providerQueues.values()) {
            const tasks = queue.filter(t => t.chatId === chatId)
            tasks.forEach(t => {
                const index = queue.indexOf(t)
                if (index !== -1) {
                    queue.splice(index, 1)
                    cancelled++
                }
            })
        }

        return cancelled
    }
}

// Singleton instance
export const multiLLMOrchestrator = new MultiLLMOrchestrator()
