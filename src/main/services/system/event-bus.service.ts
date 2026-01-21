import { EventEmitter } from 'events'

import { BaseService } from '@main/services/base.service'
import { SystemEventKey, SystemEvents } from '@shared/types/events'

export class EventBusService extends BaseService {
    private bus: EventEmitter
    private eventHistory: { event: string; payload: unknown; timestamp: number }[] = []
    private readonly MAX_HISTORY = 50

    constructor() {
        super('EventBusService')
        this.bus = new EventEmitter()
        this.bus.setMaxListeners(20) // Increase limit slightly
    }

    /**
     * Emit a strictly typed system event
     */
    emit<K extends SystemEventKey>(event: K, payload: SystemEvents[K]): void {
        const timestamp = Date.now()

        // Add to history
        this.eventHistory.unshift({ event, payload, timestamp })
        if (this.eventHistory.length > this.MAX_HISTORY) {
            this.eventHistory.pop()
        }

        this.bus.emit(event, payload)

        // Always log significant events
        this.logDebug(`Event: ${event} - Payload: ${JSON.stringify(payload)}`)
    }

    /**
     * Get recent event history
     */
    getHistory() {
        return this.eventHistory
    }

    /**
     * Subscribe to a strictly typed system event
     */
    on<K extends SystemEventKey>(event: K, listener: (payload: SystemEvents[K]) => void): () => void {
        this.bus.on(event, listener)
        // Return unsubscribe function
        return () => this.bus.off(event, listener)
    }

    /**
     * Subscribe once to a strictly typed system event
     */
    once<K extends SystemEventKey>(event: K, listener: (payload: SystemEvents[K]) => void): void {
        this.bus.once(event, listener)
    }

    /**
     * Remove a specific listener
     */
    off<K extends SystemEventKey>(event: K, listener: (payload: SystemEvents[K]) => void): void {
        this.bus.off(event, listener)
    }
}
