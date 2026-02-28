import { IpcRenderer } from 'electron';

export interface ProxyRateLimitBridge {
    getMetrics: () => Promise<{
        generatedAt: number;
        providers: Array<{
            provider: string;
            limit: number;
            remaining: number;
            resetAt: number;
            queued: number;
            blocked: number;
            allowed: number;
            bypassed: number;
            warnings: number;
        }>;
    }>;
    getConfig: () => Promise<Record<string, {
        windowMs: number;
        maxRequests: number;
        warningThreshold: number;
        maxQueueSize: number;
        allowPremiumBypass: boolean;
    }>>;
    setConfig: (
        provider: string,
        config: {
            windowMs?: number;
            maxRequests?: number;
            warningThreshold?: number;
            maxQueueSize?: number;
            allowPremiumBypass?: boolean;
        }
    ) => Promise<{
        windowMs: number;
        maxRequests: number;
        warningThreshold: number;
        maxQueueSize: number;
        allowPremiumBypass: boolean;
    }>;
}

export function createProxyRateLimitBridge(ipc: IpcRenderer): ProxyRateLimitBridge {
    return {
        getMetrics: () => ipc.invoke('proxy:rate-limit:metrics'),
        getConfig: () => ipc.invoke('proxy:rate-limit:config'),
        setConfig: (provider, config) =>
            ipc.invoke('proxy:rate-limit:set-config', { provider, ...config }),
    };
}
