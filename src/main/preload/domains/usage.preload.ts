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
            ipc.invoke('usage:checkLimit', provider, model),
        getUsageCount: (period, provider, model) =>
            ipc.invoke('usage:getUsageCount', period, provider, model),
        recordUsage: (provider, model) =>
            ipc.invoke('usage:recordUsage', provider, model),
    };
}
