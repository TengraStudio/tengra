import {
    InstallRequest,
    InstallResult,
    MarketplaceRegistry,
    MarketplaceRuntimeProfile,
} from '@shared/types/marketplace';
import { IpcRenderer } from 'electron';

export interface MarketplaceBridge {
    fetch: () => Promise<MarketplaceRegistry>;
    getRuntimeProfile: () => Promise<MarketplaceRuntimeProfile>;
    install: (request: InstallRequest) => Promise<InstallResult>;
}

export function createMarketplaceBridge(ipc: IpcRenderer): MarketplaceBridge {
    return {
        fetch: () => ipc.invoke('marketplace:fetch'),
        getRuntimeProfile: () => ipc.invoke('marketplace:getRuntimeProfile'),
        install: (request) => ipc.invoke('marketplace:install', request),
    };
}
