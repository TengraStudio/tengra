/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BrowserWindow } from 'electron';

interface BatchedEventEmitterOptions {
    /** Channel name for the batched event */
    channel: string
    /** Batch window in ms (default 50) */
    windowMs?: number
    /** Max items before forcing flush (default 100) */
    maxBatchSize?: number
}

/**
 * Creates a batched IPC event emitter that collects events and flushes
 * them to the renderer in a single IPC message after a configurable window.
 * Reduces IPC message volume for high-frequency streams.
 */
export function createBatchedEventEmitter<T>(options: BatchedEventEmitterOptions): {
    emit: (item: T) => void
    flush: () => void
    dispose: () => void
} {
    const { channel, windowMs = 50, maxBatchSize = 100 } = options;
    let buffer: T[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    function flush(): void {
        if (buffer.length === 0) {return;}
        const batch = buffer;
        buffer = [];
        timer = null;
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, batch);
            }
        }
    }

    function emit(item: T): void {
        buffer.push(item);
        if (buffer.length >= maxBatchSize) {
            if (timer) { clearTimeout(timer); timer = null; }
            flush();
            return;
        }
        if (!timer) {
            timer = setTimeout(flush, windowMs);
        }
    }

    function dispose(): void {
        if (timer) { clearTimeout(timer); timer = null; }
        flush();
    }

    return { emit, flush, dispose };
}

interface ThrottledEventEmitterOptions {
    /** Channel name for the event */
    channel: string
    /** Minimum interval between sends in ms (default 200) */
    intervalMs?: number
}

/**
 * Creates a throttled IPC event emitter that drops intermediate events,
 * sending at most one event per interval. Always sends the final event.
 * Ideal for progress indicators where only the latest value matters.
 */
export function createThrottledEventEmitter<T>(options: ThrottledEventEmitterOptions): {
    emit: (item: T) => void
    dispose: () => void
} {
    const { channel, intervalMs = 200 } = options;
    let lastSendTime = 0;
    let pendingItem: T | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function sendToWindows(item: T): void {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, item);
            }
        }
        lastSendTime = Date.now();
    }

    function emit(item: T): void {
        const now = Date.now();
        const elapsed = now - lastSendTime;

        if (elapsed >= intervalMs) {
            if (timer) { clearTimeout(timer); timer = null; }
            pendingItem = null;
            sendToWindows(item);
            return;
        }

        pendingItem = item;
        if (!timer) {
            const remaining = intervalMs - elapsed;
            timer = setTimeout(() => {
                timer = null;
                if (pendingItem !== null) {
                    sendToWindows(pendingItem);
                    pendingItem = null;
                }
            }, remaining);
        }
    }

    function dispose(): void {
        if (timer) { clearTimeout(timer); timer = null; }
        if (pendingItem !== null) {
            sendToWindows(pendingItem);
            pendingItem = null;
        }
    }

    return { emit, dispose };
}
