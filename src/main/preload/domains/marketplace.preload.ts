import { IpcRenderer } from 'electron';

export interface MarketplaceBridge {
    getModels: (
        provider?: 'ollama' | 'huggingface',
        limit?: number,
        offset?: number
    ) => Promise<unknown[]>;
    searchModels: (
        query: string,
        provider?: 'ollama' | 'huggingface',
        limit?: number
    ) => Promise<unknown[]>;
    getModelDetails: (
        modelName: string,
        provider?: 'ollama' | 'huggingface'
    ) => Promise<unknown | null>;
    getStatus: () => Promise<{ lastScrapeTime: number; isScraping: boolean }>;
}

export function createMarketplaceBridge(ipc: IpcRenderer): MarketplaceBridge {
    return {
        getModels: (provider, limit, offset) =>
            ipc.invoke('marketplace:getModels', provider, limit, offset),
        searchModels: (query, provider, limit) =>
            ipc.invoke('marketplace:searchModels', query, provider, limit),
        getModelDetails: (modelName, provider = 'ollama') =>
            ipc.invoke('marketplace:getModelDetails', modelName, provider),
        getStatus: () => ipc.invoke('marketplace:getStatus'),
    };
}
