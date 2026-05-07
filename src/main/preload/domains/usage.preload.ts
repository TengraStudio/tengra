/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { USAGE_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

/** Result of a usage limit check */
export interface UsageLimitResult {
    allowed: boolean;
    reason?: string;
}

/** Result of a usage recording operation */
export interface UsageRecordResult {
    success: boolean;
}

export type UsagePeriod = 'hourly' | 'daily' | 'weekly';

export interface UsageBridge {
    checkLimit: (provider: string, model: string) => Promise<UsageLimitResult>;
    getUsageCount: (period: UsagePeriod, provider?: string, model?: string) => Promise<number>;
    recordUsage: (provider: string, model: string) => Promise<UsageRecordResult>;
}

export function createUsageBridge(ipc: IpcRenderer): UsageBridge {
    return {
        checkLimit: (provider, model) =>
            ipc.invoke(USAGE_CHANNELS.CHECK_LIMIT, provider, model),
        getUsageCount: (period, provider, model) =>
            ipc.invoke(USAGE_CHANNELS.GET_USAGE_COUNT, period, provider, model),
        recordUsage: (provider, model) =>
            ipc.invoke(USAGE_CHANNELS.RECORD_USAGE, provider, model),
    };
}

