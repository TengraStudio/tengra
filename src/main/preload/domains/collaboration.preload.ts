import { Message } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface ModelCollaborationBridge {
    run: (request: {
        messages: Message[];
        models: Array<{ provider: string; model: string }>;
        strategy: 'consensus' | 'vote' | 'best-of-n' | 'chain-of-thought';
        options?: { temperature?: number; maxTokens?: number };
    }) => Promise<{
        responses: Array<{
            provider: string;
            model: string;
            content: string;
            latency: number;
            tokens?: number;
        }>;
        consensus?: string;
        votes?: Record<string, number>;
        bestResponse?: {
            provider: string;
            model: string;
            content: string;
        };
    }>;
    getProviderStats: (provider?: string) => Promise<unknown>;
    getActiveTaskCount: (provider: string) => Promise<number>;
    setProviderConfig: (
        provider: string,
        config: {
            maxConcurrent: number;
            priority: number;
            rateLimitPerMinute: number;
        }
    ) => Promise<{ success: boolean }>;
}

export function createModelCollaborationBridge(ipc: IpcRenderer): ModelCollaborationBridge {
    return {
        run: request => ipc.invoke('collaboration:run', request),
        getProviderStats: provider => ipc.invoke('collaboration:provider-stats', provider),
        getActiveTaskCount: provider => ipc.invoke('collaboration:active-task-count', provider),
        setProviderConfig: (provider, config) =>
            ipc.invoke('collaboration:set-provider-config', { provider, config }),
    };
}

export const createCollaborationBridge = createModelCollaborationBridge;
