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

export interface BatchOptions<T> {
    maxWaitMs: number;
    maxBatchSize: number;
    merger: (batch: T[]) => T;
}

/**
 * A utility to batch high-frequency events before emitting them.
 * Useful for reducing IPC traffic and UI re-renders.
 */
export class BatchedEventEmitter<T> extends EventEmitter {
    private batch: T[] = [];
    private timer?: NodeJS.Timeout;
    private readonly options: BatchOptions<T>;

    constructor(options: BatchOptions<T>) {
        super();
        this.options = options;
    }

    /**
     * Add an item to the current batch.
     * Triggers emission if maxBatchSize is reached.
     */
    emitBatched(item: T): void {
        this.batch.push(item);

        if (this.batch.length >= this.options.maxBatchSize) {
            this.flush();
            return;
        }

        if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.options.maxWaitMs);
        }
    }

    /**
     * Immediately emit all items in the batch.
     */
    flush(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }

        if (this.batch.length === 0) {
            return;
        }

        const merged = this.options.merger(this.batch);
        this.batch = [];
        this.emit('batch', merged);
    }

    /**
     * Clear the current batch and timer without emitting.
     */
    clear(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        this.batch = [];
    }

    /**
     * Cleanup resources.
     */
    dispose(): void {
        this.clear();
        this.removeAllListeners();
    }

    /**
     * Update configuration options at runtime
     */
    updateOptions(newOptions: Partial<BatchOptions<T>>): void {
        Object.assign(this.options, newOptions);
    }
}
