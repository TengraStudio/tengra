import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';

/** A message sent between plugins through the channel. */
export interface PluginMessage {
    from: string;
    to: string;
    type: string;
    payload: Record<string, RuntimeValue>;
    timestamp: number;
    correlationId: string;
}

/** Configuration for the plugin communication channel. */
export interface PluginChannelConfig {
    maxMessageSize: number;
    maxQueueDepth: number;
    messageTimeoutMs: number;
}

/** Handler invoked when a plugin receives a message. */
export type MessageHandler = (message: PluginMessage) => void | Promise<void>;

/** Declares what message types a plugin can handle. */
export interface PluginCapability {
    pluginId: string;
    handledTypes: string[];
}

/** Pending request awaiting a response via correlationId. */
interface PendingRequest {
    resolve: (msg: PluginMessage) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_CHANNEL_CONFIG: PluginChannelConfig = {
    maxMessageSize: 1_048_576, // 1 MB
    maxQueueDepth: 100,
    messageTimeoutMs: 30_000,
};

/**
 * PluginChannel provides pub/sub messaging between MCP plugins.
 * Supports topic-based routing, request/response, and capability advertisement.
 */
export class PluginChannel {
    private readonly config: PluginChannelConfig;
    private readonly subscriptions = new Map<string, Map<string, MessageHandler>>();
    private readonly queues = new Map<string, PluginMessage[]>();
    private readonly capabilities = new Map<string, Set<string>>();
    private readonly pendingRequests = new Map<string, PendingRequest>();

    /** @param config - Partial channel configuration (merged with defaults). */
    constructor(config: Partial<PluginChannelConfig> = {}) {
        this.config = { ...DEFAULT_CHANNEL_CONFIG, ...config };
    }

    /**
     * Subscribe a plugin to messages of a specific type.
     * @param pluginId - The subscribing plugin's ID.
     * @param messageType - The message type to listen for.
     * @param handler - Callback invoked on matching messages.
     */
    subscribe(pluginId: string, messageType: string, handler: MessageHandler): void {
        let handlersByPlugin = this.subscriptions.get(messageType);
        if (!handlersByPlugin) {
            handlersByPlugin = new Map();
            this.subscriptions.set(messageType, handlersByPlugin);
        }
        handlersByPlugin.set(pluginId, handler);
        appLogger.debug('PluginChannel', `Plugin '${pluginId}' subscribed to '${messageType}'`);
    }

    /**
     * Unsubscribe a plugin from a specific message type.
     * @param pluginId - The plugin to unsubscribe.
     * @param messageType - The message type to stop listening for.
     */
    unsubscribe(pluginId: string, messageType: string): void {
        this.subscriptions.get(messageType)?.delete(pluginId);
    }

    /**
     * Send a message from one plugin to another.
     * @param message - The message to send (without correlationId/timestamp, those are auto-filled).
     * @returns True if the message was delivered, false on validation failure.
     */
    send(message: Omit<PluginMessage, 'correlationId' | 'timestamp'>): boolean {
        const fullMessage: PluginMessage = {
            ...message,
            correlationId: randomUUID(),
            timestamp: Date.now(),
        };
        return this.deliverMessage(fullMessage);
    }

    /**
     * Send a request and await a correlated response.
     * @param message - The outgoing request (without correlationId/timestamp).
     * @returns The response PluginMessage.
     */
    async request(message: Omit<PluginMessage, 'correlationId' | 'timestamp'>): Promise<PluginMessage> {
        const correlationId = randomUUID();
        const fullMessage: PluginMessage = { ...message, correlationId, timestamp: Date.now() };

        return new Promise<PluginMessage>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(correlationId);
                reject(new Error(`Request timed out after ${this.config.messageTimeoutMs}ms`));
            }, this.config.messageTimeoutMs);

            this.pendingRequests.set(correlationId, { resolve, reject, timer });
            const delivered = this.deliverMessage(fullMessage);
            if (!delivered) {
                clearTimeout(timer);
                this.pendingRequests.delete(correlationId);
                reject(new Error('Failed to deliver request message'));
            }
        });
    }

    /**
     * Respond to a previously received message using its correlationId.
     * @param originalCorrelationId - The correlationId of the original request.
     * @param response - The response message (without correlationId/timestamp).
     */
    respond(originalCorrelationId: string, response: Omit<PluginMessage, 'correlationId' | 'timestamp'>): void {
        const pending = this.pendingRequests.get(originalCorrelationId);
        if (!pending) {
            appLogger.warn('PluginChannel', `No pending request for correlationId: ${originalCorrelationId}`);
            return;
        }
        clearTimeout(pending.timer);
        this.pendingRequests.delete(originalCorrelationId);
        pending.resolve({ ...response, correlationId: originalCorrelationId, timestamp: Date.now() });
    }

    /**
     * Advertise the message types a plugin can handle.
     * @param pluginId - The plugin ID.
     * @param handledTypes - List of message types this plugin handles.
     */
    advertiseCapabilities(pluginId: string, handledTypes: string[]): void {
        this.capabilities.set(pluginId, new Set(handledTypes));
        appLogger.info('PluginChannel', `Plugin '${pluginId}' advertises: ${handledTypes.join(', ')}`);
    }

    /**
     * Get all plugins that handle a given message type.
     * @param messageType - The message type to query.
     * @returns Array of plugin IDs that can handle this type.
     */
    getCapablePlugins(messageType: string): string[] {
        const result: string[] = [];
        for (const [pluginId, types] of this.capabilities) {
            if (types.has(messageType)) {result.push(pluginId);}
        }
        return result;
    }

    /**
     * Get queued messages for a specific plugin.
     * @param pluginId - The plugin whose queue to read.
     * @returns Array of queued messages (drains the queue).
     */
    drainQueue(pluginId: string): PluginMessage[] {
        const queue = this.queues.get(pluginId) ?? [];
        this.queues.set(pluginId, []);
        return queue;
    }

    /**
     * Get the current queue depth for a plugin.
     * @param pluginId - The plugin ID.
     * @returns Number of messages in the queue.
     */
    getQueueDepth(pluginId: string): number {
        return this.queues.get(pluginId)?.length ?? 0;
    }

    /** Remove all subscriptions, queues, and capabilities. */
    clear(): void {
        for (const pending of this.pendingRequests.values()) {
            clearTimeout(pending.timer);
        }
        this.subscriptions.clear();
        this.queues.clear();
        this.capabilities.clear();
        this.pendingRequests.clear();
    }

    /**
     * Validate and deliver a message to subscribers and queue.
     * @param message - The fully-formed PluginMessage to deliver.
     * @returns True if delivery succeeded.
     */
    private deliverMessage(message: PluginMessage): boolean {
        const size = JSON.stringify(message).length;
        if (size > this.config.maxMessageSize) {
            appLogger.warn('PluginChannel', `Message exceeds max size: ${size} > ${this.config.maxMessageSize}`);
            return false;
        }

        this.enqueue(message);
        this.notifySubscribers(message);
        return true;
    }

    /**
     * Add message to the target plugin's queue, respecting depth limits.
     * @param message - The message to enqueue.
     */
    private enqueue(message: PluginMessage): void {
        const targetId = message.to;
        let queue = this.queues.get(targetId);
        if (!queue) {
            queue = [];
            this.queues.set(targetId, queue);
        }
        if (queue.length >= this.config.maxQueueDepth) {
            appLogger.warn('PluginChannel', `Queue full for plugin '${targetId}', dropping oldest message`);
            queue.shift();
        }
        queue.push(message);
    }

    /**
     * Notify matching subscribers of the incoming message.
     * @param message - The message to dispatch to subscribers.
     */
    private notifySubscribers(message: PluginMessage): void {
        const handlers = this.subscriptions.get(message.type);
        if (!handlers) {return;}

        const targetHandler = handlers.get(message.to);
        if (targetHandler) {
            try {
                const result = targetHandler(message);
                if (result instanceof Promise) {
                    result.catch((err: Error) =>
                        appLogger.error('PluginChannel', `Handler error for '${message.to}'`, err)
                    );
                }
            } catch (err) {
                appLogger.error('PluginChannel', `Handler error for '${message.to}'`, err as Error);
            }
        }
    }
}
