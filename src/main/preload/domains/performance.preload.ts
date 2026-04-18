/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
