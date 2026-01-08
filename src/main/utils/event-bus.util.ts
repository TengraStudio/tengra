/**
 * Event Bus - Application-wide event system
 * Enables loose coupling between services
 */

import { EventEmitter } from 'events'

export type EventHandler<T = any> = (data: T) => void | Promise<void>

export interface EventSubscription {
    unsubscribe: () => void
}

// Typed event definitions
export interface AppEvents {
    // Chat events
    'chat:created': { chatId: string; title: string }
    'chat:updated': { chatId: string; updates: Record<string, any> }
    'chat:deleted': { chatId: string }
    'chat:message': { chatId: string; messageId: string; role: string; content: string }

    // Model events
    'model:selected': { modelId: string; provider: string }
    'model:list:updated': { provider: string; models: any[] }

    // Auth events
    'auth:login': { provider: string; email?: string }
    'auth:logout': { provider: string }
    'auth:token:refreshed': { provider: string }
    'auth:expired': { provider: string }

    // Proxy events
    'proxy:started': { port: number }
    'proxy:stopped': {}
    'proxy:error': { error: string }

    // Quota events
    'quota:updated': { provider: string; remaining: number; limit: number }
    'quota:warning': { provider: string; percentUsed: number }
    'quota:exhausted': { provider: string }

    // Settings events
    'settings:changed': { key: string; value: any }
    'settings:saved': {}

    // Health events
    'health:changed': { service: string; status: 'healthy' | 'unhealthy' | 'unknown' }

    // App lifecycle
    'app:ready': {}
    'app:closing': {}

    // Generic
    [key: string]: any
}

class EventBus {
    private emitter = new EventEmitter()
    private eventHistory: Array<{ event: string; data: any; timestamp: number }> = []
    private readonly maxHistory = 100

    constructor() {
        // Increase max listeners to avoid warnings
        this.emitter.setMaxListeners(50)
    }

    /**
     * Subscribe to an event
     */
    on<K extends keyof AppEvents>(
        event: K,
        handler: EventHandler<AppEvents[K]>
    ): EventSubscription {
        this.emitter.on(event as string, handler)

        return {
            unsubscribe: () => {
                this.emitter.off(event as string, handler)
            }
        }
    }

    /**
     * Subscribe to an event (one-time)
     */
    once<K extends keyof AppEvents>(
        event: K,
        handler: EventHandler<AppEvents[K]>
    ): EventSubscription {
        this.emitter.once(event as string, handler)

        return {
            unsubscribe: () => {
                this.emitter.off(event as string, handler)
            }
        }
    }

    /**
     * Emit an event
     */
    emit<K extends keyof AppEvents>(event: K, data: AppEvents[K]): void {
        // Store in history
        this.eventHistory.push({
            event: event as string,
            data,
            timestamp: Date.now()
        })

        // Trim history
        if (this.eventHistory.length > this.maxHistory) {
            this.eventHistory.shift()
        }

        // Emit
        this.emitter.emit(event as string, data)
    }

    /**
     * Remove all listeners for an event
     */
    off<K extends keyof AppEvents>(event: K): void {
        this.emitter.removeAllListeners(event as string)
    }

    /**
     * Get event history
     */
    getHistory(event?: string): Array<{ event: string; data: any; timestamp: number }> {
        if (event) {
            return this.eventHistory.filter(e => e.event === event)
        }
        return [...this.eventHistory]
    }

    /**
     * Clear all listeners
     */
    clear(): void {
        this.emitter.removeAllListeners()
        this.eventHistory = []
    }

    /**
     * Get listener count for an event
     */
    listenerCount(event: string): number {
        return this.emitter.listenerCount(event)
    }

    /**
     * Wait for an event (Promise-based)
     */
    waitFor<K extends keyof AppEvents>(
        event: K,
        timeoutMs?: number
    ): Promise<AppEvents[K]> {
        return new Promise((resolve, reject) => {
            const handler = (data: AppEvents[K]) => {
                if (timeoutId) clearTimeout(timeoutId)
                resolve(data)
            }

            this.emitter.once(event as string, handler)

            let timeoutId: NodeJS.Timeout | undefined
            if (timeoutMs) {
                timeoutId = setTimeout(() => {
                    this.emitter.off(event as string, handler)
                    reject(new Error(`Timeout waiting for event: ${event as string}`))
                }, timeoutMs)
            }
        })
    }
}

// Singleton instance
export const eventBus = new EventBus()

// Re-export for convenience
export default eventBus
