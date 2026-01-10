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

/**
 * Wraps an IPC handler function with unified error handling and logging.
 * @param handlerName The name of the handler for logging purposes.
 * @param handler The actual handler function.
 */
export const createIpcHandler = <T = JsonValue>(
    handlerName: string,
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>
) => {
    return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<IpcResponse<T>> => {
        try {
            // appLogger.debug('IpcHandler', `[${handlerName}] Started`); // Optional: verbose logging
            const result = await handler(event, ...args);
            // appLogger.debug('IpcHandler', `[${handlerName}] Completed`);
            return { success: true, data: result };
        } catch (error) {
            appLogger.error('IpcHandler', `[${handlerName}] Failed: ${getErrorMessage(error)}`);

            let code = AppErrorCode.UNKNOWN;
            let message = getErrorMessage(error);
            let context: Record<string, JsonValue | Error> | undefined;

            if (error instanceof OrbitError) {
                code = error.code as AppErrorCode;
                context = error.context as unknown as Record<string, JsonValue | Error>;
            }

            return {
                success: false,
                error: {
                    message,
                    code,
                    context
                }
            };
        }
    };
};
