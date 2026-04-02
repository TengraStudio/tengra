import { InstallRequest, InstallResult, MarketplaceRegistry } from '@shared/types/marketplace';
import { IpcRenderer } from 'electron';

export interface MarketplaceBridge {
    fetch: () => Promise<MarketplaceRegistry>;
    install: (request: InstallRequest) => Promise<InstallResult>;
}

export function createMarketplaceBridge(ipc: IpcRenderer): MarketplaceBridge {
    return {
        fetch: () => ipc.invoke('marketplace:fetch'),
        install: (request) => ipc.invoke('marketplace:install', request),
    };
}
