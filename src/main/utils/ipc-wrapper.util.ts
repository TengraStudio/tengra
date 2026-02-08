import { appLogger } from '@main/logging/logger';
import type { EventBusService } from '@main/services/system/event-bus.service';
import { JsonValue } from '@shared/types/common';
import { AppErrorCode, getErrorMessage, TandemError } from '@shared/utils/error.util';
import { IpcMainInvokeEvent } from 'electron';

export interface IpcResponse<T = JsonValue> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        code: string;
        context?: Record<string, JsonValue | Error>;
    };
}

export interface IpcHandlerOptions {
    /**
     * If true, wraps the response in { success: true, data: result } format.
     * If false, returns the result directly (default for backward compatibility).
     */
    wrapResponse?: boolean;
    /**
     * Custom error handler. If provided, this will be called instead of the default error handling.
     */
    onError?: (error: Error, handlerName: string) => unknown;
}

let ipcEventBus: EventBusService | null = null;

export function setIpcEventBus(eventBus: EventBusService | null): void {
    ipcEventBus = eventBus;
}

function emitIpcLifecycleEvent(
    phase: 'started' | 'succeeded' | 'failed',
    handlerName: string,
    durationMs?: number,
    errorMessage?: string
): void {
    if (!ipcEventBus) { return; }

    ipcEventBus.emitCustom('ipc:lifecycle', {
        phase,
        handlerName,
        durationMs,
        errorMessage,
        timestamp: Date.now()
    });
}

/**
 * Wraps an IPC handler function with unified error handling and logging.
 * @param handlerName The name of the handler for logging purposes.
 * @param handler The actual handler function.
 * @param options Optional configuration for the handler wrapper.
 */
export const createIpcHandler = <T = JsonValue, Args extends unknown[] = unknown[]>(
    handlerName: string,
    handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
    options: IpcHandlerOptions = {}
) => {
    const { wrapResponse = false, onError } = options;

    return async (event: IpcMainInvokeEvent, ...args: unknown[]): Promise<IpcResponse<T> | T> => {
        const startedAt = Date.now();
        emitIpcLifecycleEvent('started', handlerName);

        try {
            // appLogger.debug('IpcHandler', `[${handlerName}] Started`); // Optional: verbose logging
            const result = await handler(event, ...(args as Args));
            // appLogger.debug('IpcHandler', `[${handlerName}] Completed`);
            emitIpcLifecycleEvent('succeeded', handlerName, Date.now() - startedAt);

            if (wrapResponse) {
                return { success: true, data: result } as IpcResponse<T>;
            }
            return result;
        } catch (error) {
            const errorObj = error as Error;
            appLogger.error('IpcHandler', `[${handlerName}] Failed: ${getErrorMessage(errorObj)}`);
            emitIpcLifecycleEvent('failed', handlerName, Date.now() - startedAt, getErrorMessage(errorObj));

            // If custom error handler is provided, use it
            if (onError) {
                const errorResult = onError(errorObj, handlerName);
                return errorResult as T | IpcResponse<T>;
            }

            // Default error handling
            if (wrapResponse) {
                let code = AppErrorCode.UNKNOWN;
                const message = getErrorMessage(errorObj);
                let context: Record<string, JsonValue | Error> | undefined;

                if (errorObj instanceof TandemError) {
                    code = errorObj.code as AppErrorCode;
                    context = errorObj.context as Record<string, JsonValue | Error>;
                }

                return {
                    success: false,
                    error: {
                        message,
                        code,
                        context
                    }
                } as IpcResponse<T>;
            }

            // For non-wrapped responses, re-throw the error to maintain backward compatibility
            // The renderer should handle these errors appropriately
            throw error;
        }
    };
};

/**
 * Creates a simple error handler that logs errors and returns a default value on failure.
 * Useful for handlers that should never throw but return fallback values.
 * 
 * @param handlerName - The name of the handler for logging purposes
 * @param handler - The actual handler function to wrap
 * @param defaultValue - The value to return if the handler throws an error
 * @returns A wrapped handler that always returns a value (never throws)
 * 
 * @example
 * ```typescript
 * ipcMain.handle('db:getAllChats', createSafeIpcHandler('db:getAllChats', async () => {
 *   return await databaseService.getAllChats()
 * }, []))
 * ```
 */
export const createSafeIpcHandler = <T = JsonValue, Args extends unknown[] = unknown[]>(
    handlerName: string,
    handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
    defaultValue: T
) => {
    return async (event: IpcMainInvokeEvent, ...args: unknown[]): Promise<T> => {
        const startedAt = Date.now();
        emitIpcLifecycleEvent('started', handlerName);

        try {
            const result = await handler(event, ...(args as Args));
            emitIpcLifecycleEvent('succeeded', handlerName, Date.now() - startedAt);
            return result;
        } catch (error) {
            appLogger.error('IpcHandler', `[${handlerName}] Failed: ${getErrorMessage(error as Error)}`);
            emitIpcLifecycleEvent('failed', handlerName, Date.now() - startedAt, getErrorMessage(error as Error));
            return defaultValue;
        }
    };
};

