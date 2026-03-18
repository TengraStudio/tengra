import { IpcValue } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface PerformanceBridge {
    getMemoryStats: () => Promise<IpcValue>;
    getProcessMetrics: () => Promise<IpcValue>;
    getStartupMetrics: () => Promise<IpcValue>;
    detectLeak: () => Promise<IpcValue>;
    triggerGC: () => Promise<IpcValue>;
    getDashboard: () => Promise<IpcValue>;
}

export function createPerformanceBridge(ipc: IpcRenderer): PerformanceBridge {
    return {
        getMemoryStats: () => ipc.invoke('performance:get-memory-stats'),
        getProcessMetrics: () => ipc.invoke('performance:get-process-metrics'),
        getStartupMetrics: () => ipc.invoke('performance:get-startup-metrics'),
        detectLeak: () => ipc.invoke('performance:detect-leak'),
        triggerGC: () => ipc.invoke('performance:trigger-gc'),
        getDashboard: () => ipc.invoke('performance:get-dashboard'),
    };
}
