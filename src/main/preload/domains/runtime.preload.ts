import type { RuntimeBootstrapExecutionResult } from '@shared/types/runtime-manifest';
import { IpcRenderer } from 'electron';

export interface RuntimeBridge {
    getStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
    refreshStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
    repair: (manifestUrl?: string) => Promise<RuntimeBootstrapExecutionResult | null>;
}

export function createRuntimeBridge(ipc: IpcRenderer): RuntimeBridge {
    return {
        getStatus: () => ipc.invoke('runtime:get-status'),
        refreshStatus: () => ipc.invoke('runtime:refresh-status'),
        repair: manifestUrl => ipc.invoke('runtime:repair', manifestUrl),
    };
}
