import { appLogger } from '@main/logging/logger';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { SenderValidator } from '@main/utils/ipc-sender-validator';
import { createIpcHandler, createValidatedIpcHandler, safeHandle, safeOn } from '@main/utils/ipc-wrapper.util';
import type { RuntimeValue as SharedRuntimeValue } from '@shared/types/common';
import type { IpcMainInvokeEvent } from 'electron';
import type { ZodTypeAny } from 'zod';

import type { IpcMethod } from './ipc-metadata';

type ValidatedHandlerOptions = NonNullable<Parameters<typeof createValidatedIpcHandler>[2]>;
export const IPC_METADATA_KEY = '_ipc_methods';
export type { IpcMethod };

type IpcMethodHandler = (...args: (RuntimeValue | IpcMainInvokeEvent)[]) => RuntimeValue | Promise<RuntimeValue> | object | Promise<object>;
type IpcService = {
    constructor: Record<string, IpcMethod[] | undefined> & { name?: string };
    name?: string;
} & Record<string | symbol, RuntimeValue | IpcMethodHandler>;

interface IpcChannelOptions {
    channel?: string;
    withEvent?: boolean;
    type?: 'handle' | 'on' | 'both';
    isBatchable?: boolean;
    argsSchema?: ZodTypeAny;
    defaultValue?: RuntimeValue;
    wrapResponse?: boolean;
}

export function getIpcMethodsForService(service: object): IpcMethod[] {
    if (!service) {
        return [];
    }
    const serviceRecord = service as IpcService;
    const constructor = serviceRecord.constructor;
    return constructor?.['_ipc_methods'] || [];
}

/**
 * Decorator to mark a service method as exposed via IPC.
 * @param channelOrOptions Optional custom channel name or configuration object.
 */
export function ipc(channelOrOptions?: string | IpcChannelOptions): MethodDecorator {
    return (target: object, propertyKey: string | symbol) => {
        const constructor = (target as { constructor: IpcService['constructor'] }).constructor;
        const ipcMethods = constructor['_ipc_methods'] ?? [];
        constructor['_ipc_methods'] = ipcMethods;

        const channel = typeof channelOrOptions === 'string'
            ? channelOrOptions
            : (channelOrOptions?.channel || propertyKey.toString());
        let withEvent = false;
        let type: 'handle' | 'on' | 'both' = 'handle';
        let isBatchable = false;
        let argsSchema: ZodTypeAny | undefined;
        let defaultValue: RuntimeValue | undefined;

        if (typeof channelOrOptions === 'string') {
            // Already handled
        } else if (channelOrOptions && typeof channelOrOptions === 'object') {
            withEvent = !!channelOrOptions.withEvent;
            type = channelOrOptions.type || 'handle';
            isBatchable = !!channelOrOptions.isBatchable;
            argsSchema = channelOrOptions.argsSchema;
            defaultValue = channelOrOptions.defaultValue;
        }

        ipcMethods.push({
            propertyKey,
            channel,
            withEvent,
            type,
            isBatchable,
            argsSchema,
            defaultValue
        });
    };
}


/**
 * Automatically registers all @ipc decorated methods for a service instance.
 * @param service - The service instance to register
 * @param validateSender - Optional validator for the IPC sender
 */
export function registerServiceIpc(
    service: object,
    validateSender?: SenderValidator,
    options: { wrapResponse?: boolean } = {}
): void {
    if (!service) {
        appLogger.warn('IPC', 'Attempted to register IPC for an undefined service');
        return;
    }
    const serviceRecord = service as IpcService;
    const constructor = serviceRecord.constructor;
    
    const serviceName = serviceRecord.name || constructor?.name || 'Unknown';

    const methods: IpcMethod[] = getIpcMethodsForService(service);
    
    if (methods.length === 0) {
        appLogger.debug('IPC', `No @ipc methods found for service: ${serviceName}`);
        return;
    }

    for (const method of methods) {
        const { propertyKey, channel, withEvent, type, isBatchable } = method; 

        // Bind the method to the service instance
        const handler = async (event: IpcMainInvokeEvent, ...args: RuntimeValue[]) => {
            const serviceMethod = serviceRecord[propertyKey];
            if (typeof serviceMethod !== 'function') {
                throw new Error(`IPC method ${String(propertyKey)} is not callable on ${serviceRecord.constructor.name}`);
            }

            const callableMethod = serviceMethod as IpcMethodHandler;
            if (withEvent) {
                return await callableMethod.apply(serviceRecord, [event, ...args]);
            }
            return await callableMethod.apply(serviceRecord, args);
        };

        const finalHandler = async (event: IpcMainInvokeEvent, ...args: RuntimeValue[]) => {
            if (validateSender) {
                validateSender(event);
            }
            return await handler(event, ...args);
        };

        if (type === 'on' || type === 'both') {
            safeOn(channel, (event, ...args) => {
                void finalHandler(event, ...args).catch(err => {
                    appLogger.error('IPC', `Async error in 'on' handler for ${channel}:`, err);
                });
            });
        }
        
        if (type === 'handle' || type === 'both') {
            const wrappedHandler = method.argsSchema
                ? createValidatedIpcHandler(channel, finalHandler, {
                    argsSchema: method.argsSchema as ValidatedHandlerOptions['argsSchema'],
                    defaultValue: method.defaultValue
                })
                : createIpcHandler(channel, finalHandler, { wrapResponse: options.wrapResponse });

            safeHandle(channel, wrappedHandler);
            if (isBatchable) {
                registerBatchableHandler(channel, async (event, args) => {
                    const result = await finalHandler(event, ...(args as RuntimeValue[]));
                    return result as SharedRuntimeValue;
                });
            }
        }
    }
}

