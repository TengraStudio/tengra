/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { METRICS_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

/** Return shape for a single provider's metrics */
export interface ProviderStats {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgLatencyMs: number;
}

/** Summary returned by the metrics service */
export interface MetricsSummary {
    totalRequests: number;
    successRate: number;
    avgLatencyMs: number;
    providers: string[];
}

export interface MetricsBridge {
    getProviderStats: (provider?: string) => Promise<Record<string, ProviderStats>>;
    getSummary: () => Promise<MetricsSummary>;
    reset: () => Promise<boolean>;
}

export function createMetricsBridge(ipc: IpcRenderer): MetricsBridge {
    return {
        getProviderStats: (provider?: string) =>
            ipc.invoke(METRICS_CHANNELS.GET_PROVIDER_STATS, provider),
        getSummary: () => ipc.invoke(METRICS_CHANNELS.GET_SUMMARY),
        reset: () => ipc.invoke(METRICS_CHANNELS.RESET),
    };
}

