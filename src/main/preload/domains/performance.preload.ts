import { IpcValue } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface PerformanceBridge {
    getMemoryStats: () => Promise<IpcValue>;
    detectLeak: () => Promise<IpcValue>;
    triggerGC: () => Promise<IpcValue>;
    getDashboard: () => Promise<IpcValue>;
}

export function createPerformanceBridge(ipc: IpcRenderer): PerformanceBridge {
    return {
        getMemoryStats: () => ipc.invoke('performance:get-memory-stats'),
        detectLeak: () => ipc.invoke('performance:detect-leak'),
        triggerGC: () => ipc.invoke('performance:trigger-gc'),
        getDashboard: () => ipc.invoke('performance:get-dashboard'),
    };
}
