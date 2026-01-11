import { IpcMainInvokeEvent } from 'electron';
import { appLogger } from '../logging/logger';
import { getErrorMessage, AppErrorCode, OrbitError } from '../../shared/utils/error.util';
import { JsonValue } from '../../shared/types/common';

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
    onError?: (error: Error, handlerName: string) => any;
}

/**
 * Wraps an IPC handler function with unified error handling and logging.
 * @param handlerName The name of the handler for logging purposes.
 * @param handler The actual handler function.
 * @param options Optional configuration for the handler wrapper.
 */
export const createIpcHandler = <T = JsonValue>(
    handlerName: string,
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>,
    options: IpcHandlerOptions = {}
) => {
    const { wrapResponse = false, onError } = options;

    return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<IpcResponse<T> | T> => {
        try {
            // appLogger.debug('IpcHandler', `[${handlerName}] Started`); // Optional: verbose logging
            const result = await handler(event, ...args);
            // appLogger.debug('IpcHandler', `[${handlerName}] Completed`);
            
            if (wrapResponse) {
                return { success: true, data: result } as IpcResponse<T>;
            }
            return result;
        } catch (error) {
            const errorObj = error as Error;
            appLogger.error('IpcHandler', `[${handlerName}] Failed: ${getErrorMessage(errorObj)}`);

            // If custom error handler is provided, use it
            if (onError) {
                return onError(errorObj, handlerName);
            }

            // Default error handling
            if (wrapResponse) {
                let code = AppErrorCode.UNKNOWN;
                let message = getErrorMessage(errorObj);
                let context: Record<string, JsonValue | Error> | undefined;

                if (errorObj instanceof OrbitError) {
                    code = errorObj.code as AppErrorCode;
                    context = errorObj.context as unknown as Record<string, JsonValue | Error>;
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
export const createSafeIpcHandler = <T = JsonValue>(
    handlerName: string,
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>,
    defaultValue: T
) => {
    return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<T> => {
        try {
            return await handler(event, ...args);
        } catch (error) {
            appLogger.error('IpcHandler', `[${handlerName}] Failed: ${getErrorMessage(error as Error)}`);
            return defaultValue;
        }
    };
};
