/**
 * Request Queue Service
 * Manages concurrent API requests with priority and throttling
 */

import { CatchError } from '../../shared/types/common'
import { getErrorMessage } from '../../shared/utils/error.util'

export type Priority = 'high' | 'normal' | 'low'

type QueueResult = unknown

interface QueuedRequest<T> {
    id: string
    priority: Priority
    fn: () => Promise<T>
    resolve: (value: T) => void
    reject: (error: CatchError) => void
    createdAt: number
    provider?: string
}

export interface QueueOptions {
    maxConcurrent?: number
    maxQueueSize?: number
    timeoutMs?: number
}


const DEFAULT_OPTIONS: Required<QueueOptions> = {
    maxConcurrent: 5,
    maxQueueSize: 100,
    timeoutMs: 60000
}

const PRIORITY_ORDER: Record<Priority, number> = {
    high: 3,
    normal: 2,
    low: 1
}

export class RequestQueue {
    private queue: QueuedRequest<QueueResult>[] = []
    private running = 0
    private readonly options: Required<QueueOptions>
    private requestId = 0

    constructor(options?: QueueOptions) {
        this.options = { ...DEFAULT_OPTIONS, ...options }
    }

    /**
     * Add a request to the queue
     */
    enqueue<T extends QueueResult>(
        fn: () => Promise<T>,
        options?: {
            priority?: Priority
            provider?: string
        }
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            // Check queue size limit
            if (this.queue.length >= this.options.maxQueueSize) {
                reject(new Error('Request queue is full'))
                return
            }

            const request: QueuedRequest<T> = {
                id: `req-${++this.requestId}`,
                priority: options?.priority ?? 'normal',
                fn,
                resolve,
                reject,
                createdAt: Date.now(),
                provider: options?.provider
            }

            // Insert based on priority
            const insertIndex = this.findInsertIndex(request.priority)
            this.queue.splice(insertIndex, 0, request as QueuedRequest<unknown>)

            // Try to process
            this.processQueue()
        })
    }

    /**
     * Find insertion index for priority-based ordering
     */
    private findInsertIndex(priority: Priority): number {
        const priorityValue = PRIORITY_ORDER[priority]

        for (let i = 0; i < this.queue.length; i++) {
            if (PRIORITY_ORDER[this.queue[i].priority] < priorityValue) {
                return i
            }
        }

        return this.queue.length
    }

    /**
     * Process queued requests
     */
    private async processQueue() {
        if (this.options.maxConcurrent <= 0) {
            throw new Error('maxConcurrent must be greater than 0');
        }

        const MAX_QUEUE_ITERATIONS = 10000;
        let iterations = 0;
        
        while (this.running < this.options.maxConcurrent && this.queue.length > 0 && iterations < MAX_QUEUE_ITERATIONS) {
            const request = this.queue.shift()
            if (!request) break

            this.running++
            iterations++

            // Execute with timeout and handle return value
            this.executeRequest(request)
                .then((result) => {
                    // Return value is already handled in executeRequest via resolve/reject
                    // But we can log if needed
                    return result;
                })
                .catch((error) => {
                    // Error is already handled in executeRequest via reject
                    console.error('[RequestQueue] Request execution error:', error);
                })
                .finally(() => {
                    this.running--
                    // Only continue processing if we haven't hit the iteration limit
                    if (iterations < MAX_QUEUE_ITERATIONS) {
                        this.processQueue()
                    }
                })
        }
        
        if (iterations >= MAX_QUEUE_ITERATIONS) {
            console.error('[RequestQueue] Queue processing exceeded maximum iterations');
        }
    }

    /**
     * Execute a single request with timeout
     */
    private async executeRequest<T>(request: QueuedRequest<T>) {
        try {
            const result = await Promise.race([
                request.fn(),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error('Request timeout')),
                        this.options.timeoutMs
                    )
                )
            ])

            request.resolve(result as T)
        } catch (error) {
            request.reject(getErrorMessage(error as Error))
        }
    }

    /**
     * Get queue statistics
     */
    getStats(): {
        queueLength: number
        running: number
        maxConcurrent: number
    } {
        return {
            queueLength: this.queue.length,
            running: this.running,
            maxConcurrent: this.options.maxConcurrent
        }
    }

    /**
     * Clear all pending requests
     */
    clear() {
        for (const request of this.queue) {
            request.reject(new Error('Queue cleared'))
        }
        this.queue = []
    }

    /**
     * Check if queue is empty and no requests are running
     */
    isIdle(): boolean {
        return this.queue.length === 0 && this.running === 0
    }

    /**
     * Wait for all pending requests to complete
     */
    async drain(): Promise<void> {
        return new Promise(resolve => {
            const check = () => {
                if (this.isIdle()) {
                    resolve()
                } else {
                    setTimeout(check, 50)
                }
            }
            check()
        })
    }
}

// Provider-specific queues
const queues: Map<string, RequestQueue> = new Map()

/**
 * Get a queue for a specific provider
 */
export function getProviderQueue(provider: string, options?: QueueOptions): RequestQueue {
    const key = provider.toLowerCase()

    if (!queues.has(key)) {
        queues.set(key, new RequestQueue(options))
    }

    return queues.get(key)!
}

/**
 * Global request queue for general use
 */
export const globalQueue = new RequestQueue({ maxConcurrent: 10 })
