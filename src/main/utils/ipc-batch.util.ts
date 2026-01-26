/**
 * IPC Message Batching Utility
 * Allows multiple IPC calls to be batched together for improved performance
 * Reduces IPC overhead by combining multiple requests into a single batch
 */

import { appLogger } from '@main/logging/logger';
import { IpcValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

export interface BatchRequest {
    channel: string
    args: IpcValue[]
}

export interface BatchResult {
    channel: string
    success: boolean
    data?: IpcValue
    error?: string
}

export interface BatchResponse {
    results: BatchResult[]
    timing: {
        startTime: number
        endTime: number
        totalMs: number
    }
}

// Registry of handlers that can be batched
const batchableHandlers = new Map<string, (event: IpcMainInvokeEvent, ...args: IpcValue[]) => Promise<IpcValue>>();

/**
 * Register a handler as batchable
 * This allows it to be called via the batch:invoke channel
 */
export function registerBatchableHandler(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: IpcValue[]) => Promise<IpcValue>
): void {
    batchableHandlers.set(channel, handler);
}

/**
 * Unregister a batchable handler
 */
export function unregisterBatchableHandler(channel: string): void {
    batchableHandlers.delete(channel);
}

/**
 * Check if a handler is registered as batchable
 */
export function isBatchable(channel: string): boolean {
    return batchableHandlers.has(channel);
}

/**
 * Get all registered batchable channels
 */
export function getBatchableChannels(): string[] {
    return Array.from(batchableHandlers.keys());
}

/**
 * Execute a single batch request
 */
async function executeBatchRequest(
    event: IpcMainInvokeEvent,
    request: BatchRequest
): Promise<BatchResult> {
    const handler = batchableHandlers.get(request.channel);

    if (!handler) {
        return {
            channel: request.channel,
            success: false,
            error: `Handler not found or not batchable: ${request.channel}`
        };
    }

    try {
        const result = await handler(event, ...request.args);
        return {
            channel: request.channel,
            success: true,
            data: result
        };
    } catch (error) {
        return {
            channel: request.channel,
            success: false,
            error: getErrorMessage(error as Error)
        };
    }
}

/**
 * Register the batch IPC handlers
 */
export function registerBatchIpc(): void {
    // Handle batch invoke requests
    ipcMain.handle('batch:invoke', async (
        event: IpcMainInvokeEvent,
        requests: BatchRequest[]
    ): Promise<BatchResponse> => {
        const startTime = Date.now();

        if (!Array.isArray(requests) || requests.length === 0) {
            return {
                results: [],
                timing: {
                    startTime,
                    endTime: Date.now(),
                    totalMs: Date.now() - startTime
                }
            };
        }

        // Execute all requests in parallel
        const results = await Promise.all(
            requests.map(req => executeBatchRequest(event, req))
        );

        const endTime = Date.now();
        const totalMs = endTime - startTime;

        appLogger.debug('IpcBatch', `Processed ${requests.length} requests in ${totalMs}ms`);

        return {
            results,
            timing: {
                startTime,
                endTime,
                totalMs
            }
        };
    });

    // Handle sequential batch invoke (for requests that must be in order)
    ipcMain.handle('batch:invokeSequential', async (
        event: IpcMainInvokeEvent,
        requests: BatchRequest[]
    ): Promise<BatchResponse> => {
        const startTime = Date.now();

        if (!Array.isArray(requests) || requests.length === 0) {
            return {
                results: [],
                timing: {
                    startTime,
                    endTime: Date.now(),
                    totalMs: Date.now() - startTime
                }
            };
        }

        // Execute requests sequentially
        const results: BatchResult[] = [];
        for (const request of requests) {
            const result = await executeBatchRequest(event, request);
            results.push(result);
        }

        const endTime = Date.now();
        const totalMs = endTime - startTime;

        appLogger.debug('IpcBatch', `Processed ${requests.length} sequential requests in ${totalMs}ms`);

        return {
            results,
            timing: {
                startTime,
                endTime,
                totalMs
            }
        };
    });

    // Get list of batchable channels
    ipcMain.handle('batch:getChannels', async (): Promise<string[]> => {
        return getBatchableChannels();
    });
}

/**
 * Helper to register multiple handlers at once
 */
export function registerBatchableHandlers(
    handlers: Record<string, (event: IpcMainInvokeEvent, ...args: IpcValue[]) => Promise<IpcValue>>
): void {
    for (const [channel, handler] of Object.entries(handlers)) {
        registerBatchableHandler(channel, handler);
    }
}

/**
 * Create a batchable version of an existing handler
 * Use this when you want to make existing handlers batchable without modifying them
 */
export function makeBatchable<T extends IpcValue>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: IpcValue[]) => Promise<T>
): void {
    registerBatchableHandler(channel, handler as (event: IpcMainInvokeEvent, ...args: IpcValue[]) => Promise<IpcValue>);
}
