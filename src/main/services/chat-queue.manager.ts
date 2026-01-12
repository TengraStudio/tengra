import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import { multiLLMOrchestrator } from './multi-llm-orchestrator.service'
import { v4 as uuidv4 } from 'uuid'

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
    private queue: ChatTask[] = []
    private activeCount = 0
    private policy: OrchestrationPolicy = 'auto'
    private generatingChats: Set<string> = new Set()
    private useMultiLLM: boolean = true // Use new orchestrator by default

    constructor() {
        super()
    }

    /**
     * Enable or disable the multi-LLM orchestrator
     */
    setUseMultiLLM(use: boolean) {
        this.useMultiLLM = use
    }

    setPolicy(policy: OrchestrationPolicy) {
        this.policy = policy
        if (this.useMultiLLM) {
            // Multi-LLM orchestrator handles its own processing
            return
        }
        this.processQueue()
    }

    async addTask(chatId: string, execute: () => Promise<void>, options?: {
        provider?: string
        model?: string
        priority?: number
    }) {
        if (this.useMultiLLM && options?.provider) {
            // Use new multi-LLM orchestrator
            const taskId = uuidv4()
            await multiLLMOrchestrator.addTask({
                taskId,
                chatId,
                provider: options.provider,
                model: options.model || 'default',
                execute,
                priority: options.priority
            })
            return
        }

        // Fallback to legacy queue system
        this.queue.push({ chatId, execute, ...options })
        this.updateStatus(chatId, true)
        this.processQueue()
    }

    private updateStatus(chatId: string, isGenerating: boolean) {
        if (isGenerating) {
            this.generatingChats.add(chatId)
        } else {
            this.generatingChats.delete(chatId)
        }

        // Broadcast to all windows for Sidebar UI
        const windows = BrowserWindow.getAllWindows()
        windows.forEach(win => {
            win.webContents.send('chat:generation-status', { chatId, isGenerating })
        })
    }

    private async processQueue() {
        const maxConcurrency = this.getMaxConcurrency()

        if (this.activeCount >= maxConcurrency || this.queue.length === 0) {
            return
        }

        const MAX_PROCESS_ITERATIONS = 10000;
        let iterations = 0;
        
        while (this.activeCount < maxConcurrency && this.queue.length > 0 && iterations < MAX_PROCESS_ITERATIONS) {
            const task = this.queue.shift()
            if (!task) break

            this.activeCount++
            iterations++

            try {
                const result = await task.execute();
                // Check return value if task.execute() returns a value
                if (result !== undefined && result !== null) {
                    // Task completed successfully
                }
            } catch (error) {
                console.error(`[ChatQueueManager] Error in task ${task.chatId}:`, error)
            } finally {
                this.activeCount--
                this.updateStatus(task.chatId, false)
            }
        }
        
        if (iterations >= MAX_PROCESS_ITERATIONS) {
            console.error('[ChatQueueManager] Queue processing exceeded maximum iterations');
        }
    }

    private getMaxConcurrency(): number {
        if (this.policy === 'parallel') return 10 // Arbitrary high number
        if (this.policy === 'fifo') return 1

        // Auto: Use multi-LLM orchestrator's intelligent concurrency
        return this.useMultiLLM ? 10 : 1
    }

    isGenerating(chatId: string): boolean {
        if (this.useMultiLLM) {
            return multiLLMOrchestrator.isGenerating(chatId)
        }
        return this.generatingChats.has(chatId)
    }

    /**
     * Get provider statistics (delegates to orchestrator)
     */
    getProviderStats(provider: string) {
        if (this.useMultiLLM) {
            return multiLLMOrchestrator.getProviderStats(provider)
        }
        return null
    }
}

export const chatQueueManager = new ChatQueueManager()
