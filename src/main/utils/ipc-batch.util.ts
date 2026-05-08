/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * IPC Message Batching Utility
 *
 * Allows multiple IPC calls to be batched together for improved performance.
 * Reduces IPC overhead by combining multiple requests into a single batch.
 *
 * @module IpcBatchUtil
 */


import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { BATCH_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcValue } from '@shared/types/common';
import { RuntimeValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Maximum number of IPC calls allowed in a single batch.
 * Enforces NASA Power of Ten Rule 2 (Fixed loop bounds).
 */
const MAX_BATCH_SIZE = 50;

/**
 * Represents a single request within an IPC batch.
 */
export interface BatchRequest {
    /** The IPC channel name to invoke */
    channel: string;
    /** The arguments to pass to the handler */
    args: IpcValue[];
}

/**
 * Represents the result of a single IPC call within a batch.
 */
export interface BatchResult {
    /** The IPC channel that was invoked */
    channel: string;
    /** Whether the call succeeded */
    success: boolean;
    /** The return data on success */
    data?: RuntimeValue;
    /** Error message on failure */
    error?: string;
}

/**
 * Represents the complete response for a batched IPC invocation.
 */
export interface BatchResponse {
    /** Array of results for each request in the batch */
    results: BatchResult[];
    /** Timing information for the batch execution */
    timing: {
        /** Start time timestamp */
        startTime: number;
        /** End time timestamp */
        endTime: number;
        /** Total duration in milliseconds */
        totalMs: number;
    };
}

/**
 * Type definition for a handler that can be included in an IPC batch.
 */
type BatchableHandler = (event: IpcMainInvokeEvent, args: IpcValue[]) => Promise<RuntimeValue>;

/** Registry of handlers that can be batched */
const batchableHandlers = new Map<string, BatchableHandler>();

/**
 * Register a handler as batchable.
 * This allows it to be called via the batch:invoke channel.
 * Also registers it as a regular IPC handler if not already registered.
 *
 * @param channel - The IPC channel name
 * @param handler - The async function to handle the request
 */
export function registerBatchableHandler<Args extends IpcValue[], Result extends RuntimeValue>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<Result>
): void {
    const wrappedHandler: BatchableHandler = (event, args) => handler(event, ...(args as Args));
    batchableHandlers.set(channel, wrappedHandler);

    // Also register as a regular handler so it can be called directly
    try {
        // We use .handle which will throw if already registered
        ipcMain.handle(channel, (event, ...args: IpcValue[]) => handler(event, ...(args as Args)));
    } catch {
        // If already registered (e.g. by a specialized handler in another file), that's fine
    }
}

/**
 * Unregister a batchable handler
 *
 * @param channel - The IPC channel name
 */
export function unregisterBatchableHandler(channel: string): void {
    batchableHandlers.delete(channel);
}

/**
 * Check if a handler is registered as batchable
 *
 * @param channel - The IPC channel name
 * @returns True if the channel is batchable
 */
export function isBatchable(channel: string): boolean {
    return batchableHandlers.has(channel);
}

/**
 * Get all registered batchable channels
 *
 * @returns Array of registered channel names
 */
export function getBatchableChannels(): string[] {
    return Array.from(batchableHandlers.keys());
}

/**
 * Execute a single batch request
 *
 * @param event - The IpcMainInvokeEvent
 * @param request - The batch request details
 * @returns The batch result
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
        const result = await handler(event, request.args);
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
 * Service for handling IPC batching operations
 */
export class IpcBatchService extends BaseService {
    constructor() {
        super('IpcBatchService');
    }

    /**
     * Handle batch invoke requests in parallel.
     */
    @ipc({ channel: BATCH_CHANNELS.INVOKE, withEvent: true })
    async invokeParallel(event: IpcMainInvokeEvent, requests: BatchRequest[]): Promise<BatchResponse> {
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

        // Limit batch size to enforce fixed loop bounds (NASA Rule 2)
        const effectiveRequests = requests.length > MAX_BATCH_SIZE
            ? requests.slice(0, MAX_BATCH_SIZE)
            : requests;

        // Execute all requests in parallel
        const results = await Promise.all(
            effectiveRequests.map(req => executeBatchRequest(event, req))
        );

        const endTime = Date.now();
        const totalMs = endTime - startTime;

        return {
            results,
            timing: {
                startTime,
                endTime,
                totalMs
            }
        };
    }

    /**
     * Handle batch invoke requests sequentially.
     */
    @ipc({ channel: BATCH_CHANNELS.INVOKE_SEQUENTIAL, withEvent: true })
    async invokeSequential(
        event: IpcMainInvokeEvent,
        requests: BatchRequest[]
    ): Promise<BatchResponse> {
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

        // Limit batch size to enforce fixed loop bounds (NASA Rule 2)
        const count = Math.min(requests.length, MAX_BATCH_SIZE);
        const results: BatchResult[] = [];

        for (let i = 0; i < count; i++) {
            const result = await executeBatchRequest(event, requests[i]);
            results.push(result);
        }

        const endTime = Date.now();
        const totalMs = endTime - startTime;

        return {
            results,
            timing: {
                startTime,
                endTime,
                totalMs
            }
        };
    }

    /**
     * Get list of all registered batchable channels.
     */
    @ipc({ channel: BATCH_CHANNELS.GET_CHANNELS })
    async getChannels(): Promise<string[]> {
        return getBatchableChannels();
    }
}

/**
 * Register the main batching IPC handlers.
 * @deprecated Use IpcBatchService and registerServiceIpc instead.
 */
export function registerBatchIpc(): void {
    const service = new IpcBatchService();
    
    ipcMain.handle(BATCH_CHANNELS.INVOKE, async (event, requests) => {
        return await service.invokeParallel(event, requests);
    });

    ipcMain.handle(BATCH_CHANNELS.INVOKE_SEQUENTIAL, async (event, requests) => {
        return await service.invokeSequential(event, requests);
    });

    ipcMain.handle(BATCH_CHANNELS.GET_CHANNELS, async () => {
        return await service.getChannels();
    });
}

/**
 * Helper to register multiple handlers at once
 */
export function registerBatchableHandlers(
    handlers: Record<string, (event: IpcMainInvokeEvent, ...args: IpcValue[]) => Promise<RuntimeValue>>
): void {
    for (const [channel, handler] of Object.entries(handlers)) {
        registerBatchableHandler(channel, handler);
    }
}

/**
 * Create a batchable version of an existing handler.
 * Use this when you want to make existing handlers batchable without modifying them.
 *
 * @param channel - The IPC channel name
 * @param handler - The async function to handle the request
 */
export function makeBatchable<T extends IpcValue>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: IpcValue[]) => Promise<T>
): void {
    registerBatchableHandler(channel, handler);
}

