import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'

export type OrchestrationPolicy = 'auto' | 'fifo' | 'parallel'

export interface ChatTask {
    chatId: string
    execute: () => Promise<void>
}

export class ChatQueueManager extends EventEmitter {
    private queue: ChatTask[] = []
    private activeCount = 0
    private policy: OrchestrationPolicy = 'auto'
    private generatingChats: Set<string> = new Set()

    constructor() {
        super()
    }

    setPolicy(policy: OrchestrationPolicy) {
        this.policy = policy
        this.processQueue()
    }

    async addTask(chatId: string, execute: () => Promise<void>) {
        this.queue.push({ chatId, execute })
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

        const task = this.queue.shift()
        if (!task) return

        this.activeCount++

        try {
            await task.execute()
        } catch (error) {
            console.error(`[ChatQueueManager] Error in task ${task.chatId}:`, error)
        } finally {
            this.activeCount--
            this.updateStatus(task.chatId, false)
            this.processQueue()
        }
    }

    private getMaxConcurrency(): number {
        if (this.policy === 'parallel') return 10 // Arbitrary high number
        if (this.policy === 'fifo') return 1

        // Auto: 1 for local/shared hardware, could be more for cloud but we favor stability
        return 1
    }

    isGenerating(chatId: string): boolean {
        return this.generatingChats.has(chatId)
    }
}

export const chatQueueManager = new ChatQueueManager()
