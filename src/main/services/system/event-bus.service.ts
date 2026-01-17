import { EventEmitter } from 'events'

import { BaseService } from '@main/services/base.service'
import { SystemEventKey, SystemEvents } from '@shared/types/events'

export class EventBusService extends BaseService {
    private bus: EventEmitter

    constructor() {
        super('EventBusService')
        this.bus = new EventEmitter()
        this.bus.setMaxListeners(20) // Increase limit slightly
    }

    /**
     * Emit a strictly typed system event
     */
    emit<K extends SystemEventKey>(event: K, payload: SystemEvents[K]): void {
        this.bus.emit(event, payload)
        // Optional: log significant events?
        // this.logDebug(`Emitted ${event}`, payload)
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
