/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fsp from 'fs/promises';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { getDataFilePath } from '@main/services/system/app-layout-paths.util';
import { EventBusService } from '@main/services/system/event-bus.service';

/** Maximum number of queued prompts to prevent unbounded growth. */
const MAX_QUEUE_SIZE = 50;

/** A queued chat prompt awaiting network availability. */
export interface QueuedPrompt {
    id: string;
    chatId: string;
    prompt: string;
    modelId: string;
    provider: string;
    queuedAt: number;
}

/**
 * Queues chat prompts when the network is unavailable and
 * processes them in FIFO order upon reconnection.
 * The queue is persisted to disk for crash safety.
 */
export class OfflineQueueService extends BaseService {
    static readonly serviceName = 'offlineQueueService';
    static readonly dependencies = ['eventBus'] as const;
    private queue: QueuedPrompt[] = [];
    private readonly filePath: string;
    private processing = false;
    private onlineHandler?: () => void;
    private promptProcessor?: (prompt: QueuedPrompt) => Promise<void>;

    constructor(private eventBus: EventBusService) {
        super('OfflineQueueService');
        this.filePath = getDataFilePath('system', 'offline-queue.json');
    }

    /** Register external processor invoked for each queued prompt on reconnect. */
    setPromptProcessor(processor: (prompt: QueuedPrompt) => Promise<void>): void {
        this.promptProcessor = processor;
    }

    override async initialize(): Promise<void> {
        await this.loadFromDisk();
        appLogger.info(this.name, `Initialized with ${this.queue.length} queued prompts`);
    }

    override async cleanup(): Promise<void> {
        await this.persistToDisk();
        if (this.onlineHandler) {
            // Remove is safe even if never added in main process context
            this.onlineHandler = undefined;
        }
        appLogger.info(this.name, 'Cleaned up');
    }

    /**
     * Enqueue a prompt for later processing.
     * @returns true if enqueued, false if queue is full or network is available
     */
    async enqueue(prompt: Omit<QueuedPrompt, 'id' | 'queuedAt'>): Promise<boolean> {
        if (this.queue.length >= MAX_QUEUE_SIZE) {
            appLogger.warn(this.name, `Queue full (${MAX_QUEUE_SIZE}), rejecting prompt`);
            return false;
        }

        const entry: QueuedPrompt = {
            ...prompt,
            id: `oq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            queuedAt: Date.now(),
        };

        this.queue.push(entry);
        await this.persistToDisk();
        appLogger.info(this.name, `Queued prompt ${entry.id} (total: ${this.queue.length})`);
        return true;
    }

    /** Process all queued prompts in FIFO order. */
    async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        if (!this.promptProcessor) {
            appLogger.warn(this.name, 'No prompt processor registered, skipping');
            return;
        }

        this.processing = true;
        let processed = 0;

        this.eventBus.emitCustom('offline-queue:processing', { remaining: this.queue.length });

        while (this.queue.length > 0) {
            const item = this.queue[0];
            try {
                await this.promptProcessor(item);
                this.queue.shift();
                processed++;
                await this.persistToDisk();
            } catch (error) {
                appLogger.error(this.name, `Failed to process ${item.id}`, error as Error);
                this.eventBus.emitCustom('offline-queue:failed', {
                    promptId: item.id,
                    error: (error as Error).message,
                });
                this.queue.shift();
                await this.persistToDisk();
            }
        }

        this.processing = false;
        this.eventBus.emitCustom('offline-queue:completed', { processed });
        appLogger.info(this.name, `Processed ${processed} queued prompts`);
    }

    /** Current number of queued items. */
    getQueueSize(): number {
        return this.queue.length;
    }

    /** Get a readonly copy of the current queue. */
    getQueue(): ReadonlyArray<QueuedPrompt> {
        return [...this.queue];
    }

    private async loadFromDisk(): Promise<void> {
        try {
            const raw = await fsp.readFile(this.filePath, 'utf-8');
            const parsed: RuntimeValue = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                this.queue = parsed.filter(
                    (item): item is QueuedPrompt =>
                        typeof item === 'object' &&
                        item !== null &&
                        typeof (item as QueuedPrompt).id === 'string' &&
                        typeof (item as QueuedPrompt).prompt === 'string'
                );
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                appLogger.warn(this.name, 'Failed to load queue from disk', error as Error);
            }
            this.queue = [];
        }
    }

    private async persistToDisk(): Promise<void> {
        try {
            await fsp.writeFile(this.filePath, JSON.stringify(this.queue, null, 2), 'utf-8');
        } catch (error) {
            appLogger.error(this.name, 'Failed to persist queue to disk', error as Error);
        }
    }
}

