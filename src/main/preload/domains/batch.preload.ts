import { IpcValue } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface BatchBridge {
    invoke: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
        results: Array<{ channel: string; success: boolean; data?: IpcValue; error?: string }>;
        timing: { startTime: number; endTime: number; totalMs: number };
    }>;
    invokeSequential: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
        results: Array<{ channel: string; success: boolean; data?: IpcValue; error?: string }>;
        timing: { startTime: number; endTime: number; totalMs: number };
    }>;
    getChannels: () => Promise<string[]>;
}

export function createBatchBridge(ipc: IpcRenderer): BatchBridge {
    return {
        invoke: requests => ipc.invoke('batch:invoke', requests),
        invokeSequential: requests => ipc.invoke('batch:invokeSequential', requests),
        getChannels: () => ipc.invoke('batch:getChannels'),
    };
}
