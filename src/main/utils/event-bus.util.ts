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
import { SESSION_RUNTIME_EVENTS } from '@shared/constants/session-runtime-events';
import { JsonObject, JsonValue } from '@shared/types/common';
import {
    WorkspaceStep,
    WorkspaceStepStatus,
} from '@shared/types/council';

export type EventHandler<T = JsonValue> = (data: T) => void | Promise<void>;

export interface EventSubscription {
    unsubscribe: () => void;
}

// Typed event definitions
export interface AppEvents {
    // Chat events
    'chat:created': { chatId: string; title: string };
    'chat:updated': { chatId: string; updates: JsonObject };
    'chat:deleted': { chatId: string };
    'chat:message': { chatId: string; messageId: string; role: string; content: string };

    // Model events
    'model:selected': { modelId: string; provider: string };
    'model:list:updated': { provider: string; models: JsonValue[] };

    // Auth events
    'auth:login': { provider: string; email?: string };
    'auth:logout': { provider: string };
    'auth:token:refreshed': { provider: string };
    'auth:expired': { provider: string };

    // Proxy events
    'proxy:started': { port: number };
    'proxy:stopped': Record<string, never>;
    'proxy:error': { error: string };

    // Quota events
    'quota:updated': { provider: string; remaining: number; limit: number };
    'quota:warning': { provider: string; percentUsed: number };
    'quota:exhausted': { provider: string };

    // Settings events
    'settings:changed': { key: string; value: JsonValue };
    'settings:saved': Record<string, never>;

    // Health events
    'health:changed': { service: string; status: 'healthy' | 'unhealthy' | 'unknown' };

    // App lifecycle
    'app:ready': Record<string, never>;
    'app:closing': Record<string, never>;

    // Automation session events
    [SESSION_RUNTIME_EVENTS.AUTOMATION_STEP_UPDATE]: {
        taskId: string;
        index: number;
        status: WorkspaceStepStatus;
        message?: string;
    };
    [SESSION_RUNTIME_EVENTS.AUTOMATION_PLAN_PROPOSED]: {
        taskId: string;
        steps: Array<string | Partial<WorkspaceStep>>;
    };
    [SESSION_RUNTIME_EVENTS.AUTOMATION_PLAN_REVISED]: {
        taskId: string;
        action: 'add' | 'remove' | 'modify' | 'insert';
        index?: number;
        stepText?: string;
        reason: string;
    };
    [SESSION_RUNTIME_EVENTS.AUTOMATION_COST_ESTIMATED]: {
        taskId: string;
        estimate: RuntimeValue;
    };

    // Generic
    [key: string]: RuntimeValue; // Replaced any with unknown
}

/**
 * EventBus - Application-wide event system.
 * Enables loose coupling between services through a typed publish-subscribe pattern.
 */
class EventBus {
    private emitter = new EventEmitter();
    private eventHistory: Array<{ event: string; data: RuntimeValue; timestamp: number }> = [];
    private readonly maxHistory = 100;

    constructor() {
        // Increase max listeners to avoid warnings in complex service graphs
        this.emitter.setMaxListeners(100);
    }

    /**
     * Subscribe to an event.
     * 
     * @param event - The event name from AppEvents
     * @param handler - The callback function to invoke
     * @returns An EventSubscription object containing an unsubscribe method
     */
    on<K extends keyof AppEvents>(
        event: K,
        handler: EventHandler<AppEvents[K]>
    ): EventSubscription {
        const wrappedHandler = (data: AppEvents[K]) => {
            void Promise.resolve(handler(data)).catch(err => {
                appLogger.error('EventBus', `Error in event handler for ${String(event)}`, err as Error);
            });
        };
        this.emitter.on(event as string, wrappedHandler);

        return {
            unsubscribe: () => {
                this.emitter.off(event as string, wrappedHandler);
            }
        };
    }

    /**
     * Subscribe to an event that will only fire once.
     * 
     * @param event - The event name from AppEvents
     * @param handler - The callback function to invoke
     * @returns An EventSubscription object containing an unsubscribe method
     */
    once<K extends keyof AppEvents>(
        event: K,
        handler: EventHandler<AppEvents[K]>
    ): EventSubscription {
        const wrappedHandler = (data: AppEvents[K]) => {
            void Promise.resolve(handler(data)).catch(err => {
                appLogger.error('EventBus', `Error in one-time event handler for ${String(event)}`, err as Error);
            });
        };
        this.emitter.once(event as string, wrappedHandler);

        return {
            unsubscribe: () => {
                this.emitter.off(event as string, wrappedHandler);
            }
        };
    }

    /**
     * Emit an event to all subscribers.
     * Also records the event in a limited history for debugging/late-joins.
     * 
     * @param event - The event name from AppEvents
     * @param data - The data payload for the event
     */
    emit<K extends keyof AppEvents>(event: K, data: AppEvents[K]): void {
        // Store in history
        this.eventHistory.push({
            event: event as string,
            data,
            timestamp: Date.now()
        });

        // Trim history
        if (this.eventHistory.length > this.maxHistory) {
            this.eventHistory.shift();
        }

        // Emit
        this.emitter.emit(event as string, data);
    }

    /**
     * Remove all listeners for a specific event.
     * 
     * @param event - The event name to clear
     */
    off<K extends keyof AppEvents>(event: K): void {
        this.emitter.removeAllListeners(event as string);
    }

    /**
     * Retrieves the recent history of emitted events.
     * 
     * @param event - Optional event name to filter history
     * @returns Array of history entries
     */
    getHistory(event?: string): Array<{ event: string; data: RuntimeValue; timestamp: number }> {
        if (event) {
            return this.eventHistory.filter(e => e.event === event);
        }
        return [...this.eventHistory];
    }

    /**
     * Clears all listeners and resets event history.
     */
    clear(): void {
        this.emitter.removeAllListeners();
        this.eventHistory = [];
    }

    /**
     * Disposes of the event bus resources.
     */
    dispose(): void {
        this.clear();
    }

    /**
     * Returns the number of listeners currently subscribed to an event.
     * 
     * @param event - The event name to check
     * @returns Number of active listeners
     */
    listenerCount(event: string): number {
        return this.emitter.listenerCount(event);
    }

    /**
     * Returns a promise that resolves when the specified event is emitted.
     * 
     * @param event - The event name to wait for
     * @param timeoutMs - Optional timeout in milliseconds
     * @returns Promise resolving with the event data
     * @throws Error if the timeout is reached
     */
    waitFor<K extends keyof AppEvents>(
        event: K,
        timeoutMs?: number
    ): Promise<AppEvents[K]> {
        return new Promise((resolve, reject) => {
            let timeoutId: NodeJS.Timeout | undefined;

            const handler = (data: AppEvents[K]) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                resolve(data);
            };

            this.emitter.once(event as string, handler);

            if (timeoutMs) {
                timeoutId = setTimeout(() => {
                    this.emitter.off(event as string, handler);
                    reject(new Error(`Timeout waiting for event: ${String(event)} after ${timeoutMs}ms`));
                }, timeoutMs);
            }
        });
    }
}

// Singleton instance
export const eventBus = new EventBus();

// Re-export for convenience
export default eventBus;

