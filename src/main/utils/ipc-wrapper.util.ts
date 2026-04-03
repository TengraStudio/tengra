import { appLogger } from '@main/logging/logger';
import type { EventBusService } from '@main/services/system/event-bus.service';
import { JsonValue } from '@shared/types/common';
import { AppErrorCode, getErrorMessage, TengraError } from '@shared/utils/error.util';
import { IpcMainInvokeEvent } from 'electron';
import { z, ZodError, ZodType } from 'zod';

/**
 * Standard IPC response format used by wrapped handlers.
 */
export interface IpcResponse<T = JsonValue> {
    /** Whether the operation was successful */
    success: boolean;
    /** The result data on success */
    data?: T;
    /** Error details on failure */
    error?: {
        /** Human-readable error message */
        message: string;
        /** Application-specific error code */
        code: string;
        /** Additional error context */
        context?: Record<string, JsonValue | Error>;
    };
}

/**
 * Configuration options for the IPC handler wrapper.
 */
export interface IpcHandlerOptions<TErrorValue = RuntimeValue> {
    /**
     * If true, wraps the response in { success: true, data: result } format.
     * If false, returns the result directly (default for backward compatibility).
     */
    wrapResponse?: boolean;
    /**
     * Custom error handler. If provided, this will be called instead of the default error handling.
     */
    onError?: (error: Error, handlerName: string) => TErrorValue | RuntimeValue;
}

let ipcEventBus: EventBusService | null = null;

/**
 * Sets the Event Bus service used for IPC lifecycle events.
 * @param eventBus - The EventBusService instance or null to disable
 */
export function setIpcEventBus(eventBus: EventBusService | null): void {
    ipcEventBus = eventBus;
}

/**
 * Emits an IPC lifecycle event to the event bus.
 *
 * @param phase - The lifecycle phase (started, succeeded, failed)
 * @param handlerName - The name of the IPC handler
 * @param durationMs - Time elapsed during execution
 * @param errorMessage - Error message if phase is 'failed'
 */
const lastEmitMap = new Map<string, number>();
const EMIT_THROTTLE_MS = 100;

/**
 * Emits an IPC lifecycle event to the event bus with throttling.
 *
 * @param phase - The lifecycle phase (started, succeeded, failed)
 * @param handlerName - The name of the IPC handler
 * @param durationMs - Time elapsed during execution
 * @param errorMessage - Error message if phase is 'failed'
 */
function emitIpcLifecycleEvent(
    phase: 'started' | 'succeeded' | 'failed',
    handlerName: string,
    durationMs?: number,
    errorMessage?: string
): void {
    if (!ipcEventBus) { return; }

    // Always emit failures immediately
    if (phase !== 'failed') {
        const now = Date.now();
        const last = lastEmitMap.get(`${handlerName}:${phase}`) || 0;
        if (now - last < EMIT_THROTTLE_MS) {
            return;
        }
        lastEmitMap.set(`${handlerName}:${phase}`, now);
    }

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
export const createIpcHandler = <T = JsonValue, Args extends readonly RuntimeValue[] = readonly RuntimeValue[]>(
    handlerName: string,
    handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
    options: IpcHandlerOptions = {}
) => {
    const { wrapResponse = false, onError } = options;

    return async (event: IpcMainInvokeEvent, ...args: Args): Promise<IpcResponse<T> | T> => {
        const startedAt = Date.now();
        emitIpcLifecycleEvent('started', handlerName);

        try {
            // appLogger.debug('IpcHandler', `[${handlerName}] Started`); // Optional: verbose logging
            const result = await handler(event, ...args);
            // appLogger.debug('IpcHandler', `[${handlerName}] Completed`);
            emitIpcLifecycleEvent('succeeded', handlerName, Date.now() - startedAt);

            if (wrapResponse) {
                return { success: true, data: result } as IpcResponse<T>;
            }
            return result;
        } catch (error) {
            const errorObj = error as Error;
            appLogger.error('IpcHandler', `[${handlerName}] Failed: ${getErrorMessage(errorObj)}`, {
                stack: errorObj.stack,
                errorName: errorObj.name
            });
            emitIpcLifecycleEvent('failed', handlerName, Date.now() - startedAt, getErrorMessage(errorObj));

            // If custom error handler is provided, use it
            if (onError) {
                const errorResult = await Promise.resolve(onError(errorObj, handlerName));
                if (wrapResponse) {
                    return { success: true, data: errorResult } as IpcResponse<T>;
                }
                return errorResult as T;
            }

            // Default error handling
            if (wrapResponse) {
                let code = AppErrorCode.UNKNOWN;
                const message = getErrorMessage(errorObj);
                let context: Record<string, JsonValue | Error> | undefined;

                if (errorObj instanceof TengraError) {
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
export const createSafeIpcHandler = <T = JsonValue, Args extends readonly RuntimeValue[] = readonly RuntimeValue[]>(
    handlerName: string,
    handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
    defaultValue: T,
    options: IpcHandlerOptions = {}
) => {
    return createIpcHandler<T, Args>(
        handlerName,
        handler,
        {
            ...options,
            onError: () => defaultValue as RuntimeValue
        }
    );
};

interface ValidatedIpcHandlerOptions<T, Args extends readonly RuntimeValue[]> extends IpcHandlerOptions {
    argsSchema?: z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]> | z.ZodTuple<[]>;
    responseSchema?: ZodType<T>;
    normalizeArgs?: (args: Args) => Args;
    schemaVersion?: number;
    defaultValue?: T;
    onValidationFailed?: (context: {
        handlerName: string;
        schemaVersion?: number;
        stage: 'args' | 'response';
        issues: string[];
    }) => void;
}

/**
 * Creates an IPC handler with request/response schema validation.
 *
 * Security note: schema validation runs in the main process boundary and should be
 * used for any handler that accepts renderer-originated payloads.
 */
export const createValidatedIpcHandler = <T = JsonValue, Args extends readonly RuntimeValue[] = readonly RuntimeValue[]>(
    handlerName: string,
    handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
    options: ValidatedIpcHandlerOptions<T, Args> = {}
) => {
    const { argsSchema, responseSchema, normalizeArgs, schemaVersion, onValidationFailed, defaultValue, ...ipcOptions } = options;

    if (defaultValue !== undefined && !ipcOptions.onError) {
        ipcOptions.onError = () => defaultValue;
    }

    return createIpcHandler<T, Args>(
        handlerName,
        async (event, ...args) => {
            const parseWithLog = <R>(stage: 'args' | 'response', fn: () => R): R => {
                try {
                    return fn();
                } catch (error) {
                    if (stage === 'args') {
                        appLogger.debug('IpcValidation', `[${handlerName}] Validation failed for args`, {
                            argCount: args.length,
                        });
                    }
                    if (error instanceof ZodError) {
                        const issues = error.issues.map(issue => {
                            const path = (issue.path && Array.isArray(issue.path) && issue.path.length > 0)
                                ? issue.path.join('.')
                                : 'root';
                            return `${path}: ${issue.message}`;
                        });
                        appLogger.warn(
                            'IpcValidation',
                            `[${handlerName}] ${stage} schema validation failed${schemaVersion ? ` (v${schemaVersion})` : ''}: ${issues.join(', ')}`
                        );
                        onValidationFailed?.({
                            handlerName,
                            schemaVersion,
                            stage,
                            issues
                        });
                    }
                    throw error;
                }
            };

            const parsedArgs = argsSchema
                ? parseWithLog('args', () => argsSchema.parse(args) as readonly RuntimeValue[] as Args)
                : args;
            const finalArgs = normalizeArgs ? normalizeArgs(parsedArgs) : parsedArgs;
            
            const result = await handler(event, ...finalArgs);
            return responseSchema
                ? parseWithLog('response', () => responseSchema.parse(result))
                : result;
        },
        ipcOptions
    );
};
