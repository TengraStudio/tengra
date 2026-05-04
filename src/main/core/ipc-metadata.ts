import type { ZodTypeAny } from 'zod';

export const IPC_METADATA_KEY = '_ipc_methods';

export interface IpcMethod {
    propertyKey: string | symbol;
    channel: string;
    withEvent?: boolean;
    type?: 'handle' | 'on';
    isBatchable?: boolean;
    argsSchema?: ZodTypeAny;
    defaultValue?: RuntimeValue;
}
