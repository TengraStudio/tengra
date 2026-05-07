/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

import { BaseService } from '@main/services/base.service';
import { SERVICE_DEFAULTS } from '@shared/constants/defaults';
import { RuntimeValue } from '@shared/types/common';
import { SystemEventKey, SystemEvents } from '@shared/types/events';

/**
 * Event subscription options
 */
interface SubscriptionOptions {
    /** Only handle the event once, then auto-unsubscribe */
    once?: boolean
    /** Higher priority handlers run first (default: 0) */
    priority?: number
}

type EventBusListener = (payload: RuntimeValue) => void

export class EventBusService extends BaseService {
    private bus: EventEmitter;
    private eventHistory: { event: string; payload: RuntimeValue; timestamp: number; id: string }[] = [];
    private subscriptions = new Map<string, { event: string; listener: EventBusListener }>();
    private readonly MAX_HISTORY = SERVICE_DEFAULTS.EVENT_HISTORY_SIZE;

    constructor() {
        super('EventBusService');
        this.bus = new EventEmitter();
        this.bus.setMaxListeners(SERVICE_DEFAULTS.EVENT_BUS_MAX_LISTENERS);
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing enhanced event bus system...');

        // Monitor system errors
        this.on('system:error', (payload) => {
            this.logError(`System error event: ${JSON.stringify(payload)}`);
        });

        this.logInfo('Event bus system initialized successfully');
    }

    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up event bus...');

        // Clear all listeners and subscriptions
        this.bus.removeAllListeners();
        this.subscriptions.clear();
        this.eventHistory = [];

        this.logInfo('Event bus cleanup complete');
    }

    /**
     * Emit a strictly typed system event
     */
    emit<K extends SystemEventKey>(event: K, payload: SystemEvents[K]): void {
        const eventId = randomUUID();
        const timestamp = Date.now();

        // Add to history
        this.eventHistory.unshift({ event, payload, timestamp, id: eventId });
        if (this.eventHistory.length > this.MAX_HISTORY) {
            this.eventHistory.pop();
        }

        this.bus.emit(event, payload);
    }

    /**
     * Emit a custom event for extensions
     */
    emitCustom(event: string, payload: RuntimeValue): void {
        const eventId = randomUUID();
        const timestamp = Date.now();

        this.eventHistory.unshift({ event, payload, timestamp, id: eventId });
        if (this.eventHistory.length > this.MAX_HISTORY) {
            this.eventHistory.pop();
        }

        this.bus.emit(event, payload);
    }

    /**
     * Get recent event history for debugging
     */
    getHistory(): Array<{ event: string; payload: RuntimeValue; timestamp: number; id: string }> {
        return this.eventHistory;
    }

    /**
     * Subscribe to a strictly typed system event
     * Returns unsubscribe function for backward compatibility
     */
    on<K extends SystemEventKey>(
        event: K,
        listener: (payload: SystemEvents[K]) => void
    ): () => void

    /**
     * Subscribe to a strictly typed system event with options
     * Returns subscription ID string
     */
    on<K extends SystemEventKey>(
        event: K,
        listener: (payload: SystemEvents[K]) => void,
        options: SubscriptionOptions
    ): string

    on<K extends SystemEventKey>(
        event: K,
        listener: (payload: SystemEvents[K]) => void,
        options?: SubscriptionOptions
    ): string | (() => void) {
        const subscriptionId = randomUUID();

        const wrappedListener = (payload: SystemEvents[K]) => {
            try {
                listener(payload);

                // Auto-unsubscribe if once option is set
                if (options?.once) {
                    this.unsubscribe(subscriptionId);
                }
            } catch (error) {
                this.logError(`Error in event listener for ${event}: ${(error as Error).message}`);
            }
        };

        this.bus.on(event, wrappedListener);
        this.subscriptions.set(subscriptionId, { event, listener: wrappedListener as EventBusListener });

        // Return function for backward compatibility if no options provided
        if (!options) {
            return () => this.unsubscribe(subscriptionId);
        }

        return subscriptionId;
    }

    /**
     * Subscribe to a custom event
     */
    onCustom(
        event: string,
        listener: (payload: RuntimeValue) => void,
        options: SubscriptionOptions = {}
    ): string {
        const subscriptionId = randomUUID();

        const wrappedListener = (payload: RuntimeValue) => {
            try {
                listener(payload);

                if (options.once) {
                    this.unsubscribe(subscriptionId);
                }
            } catch (error) {
                this.logError(`Error in custom event listener for ${event}: ${(error as Error).message}`);
            }
        };

        this.bus.on(event, wrappedListener);
        this.subscriptions.set(subscriptionId, { event, listener: wrappedListener });

        return subscriptionId;
    }

    /**
     * Subscribe once to a strictly typed system event
     */
    once<K extends SystemEventKey>(event: K, listener: (payload: SystemEvents[K]) => void): string {
        return this.on(event, listener, { once: true });
    }

    /**
     * Remove a specific listener by subscription ID
     */
    unsubscribe(subscriptionId: string): boolean {
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
            this.bus.off(subscription.event, subscription.listener);
            this.subscriptions.delete(subscriptionId);
            return true;
        }
        return false;
    }

    /**
     * Remove a specific listener function (legacy compatibility)
     */
    off<K extends SystemEventKey>(event: K, listener: (payload: SystemEvents[K]) => void): void {
        this.bus.off(event, listener);
    }

    /**
     * Remove all listeners for a specific event
     */
    removeAllListeners(event?: string): void {
        if (event) {
            this.bus.removeAllListeners(event);
            // Clean up subscriptions for this event
            for (const [id, sub] of this.subscriptions.entries()) {
                if (sub.event === event) {
                    this.subscriptions.delete(id);
                }
            }
        } else {
            this.bus.removeAllListeners();
            this.subscriptions.clear();
        }
    }

    /**
     * Get event bus statistics
     */
    getStats(): {
        totalListeners: number
        eventTypes: string[]
        historySize: number
        recentEvents: number
        activeSubscriptions: number
    } {
        const eventTypes = this.bus.eventNames().map(String);
        const recentEvents = this.eventHistory.filter(
            e => Date.now() - e.timestamp < 60000 // Last minute
        ).length;

        return {
            totalListeners: eventTypes.reduce((sum, event) =>
                sum + this.bus.listenerCount(event), 0),
            eventTypes,
            historySize: this.eventHistory.length,
            recentEvents,
            activeSubscriptions: this.subscriptions.size
        };
    }

    /**
     * Get the number of listeners for an event
     */
    listenerCount(event: string | symbol): number {
        return this.bus.listenerCount(event);
    }
}

