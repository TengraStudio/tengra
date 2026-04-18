/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    InstallRequest,
    InstallResult,
    MarketplaceItem,
    MarketplaceRegistry,
    MarketplaceRuntimeProfile,
} from '@shared/types/marketplace';
import { IpcRenderer } from 'electron';

export interface MarketplaceBridge {
    fetch: () => Promise<MarketplaceRegistry>;
    getRuntimeProfile: () => Promise<MarketplaceRuntimeProfile>;
    install: (request: InstallRequest) => Promise<InstallResult>;
    getUpdateCount: () => Promise<number>;
    checkLiveUpdates: () => Promise<number>;
    fetchReadme: (extensionId: string, repository?: string) => Promise<string | null>;
    uninstall: (itemId: string, itemType: MarketplaceItem['itemType']) => Promise<{ success: boolean; error?: string; messageKey?: string }>;
}

export function createMarketplaceBridge(ipc: IpcRenderer): MarketplaceBridge {
    return {
        fetch: () => ipc.invoke('marketplace:fetch'),
        getRuntimeProfile: () => ipc.invoke('marketplace:getRuntimeProfile'),
        install: (request) => ipc.invoke('marketplace:install', request),
        getUpdateCount: () => ipc.invoke('marketplace:get-update-count'),
        checkLiveUpdates: () => ipc.invoke('marketplace:check-live-updates'),
        fetchReadme: (extensionId: string, repository?: string) => ipc.invoke('marketplace:fetch-readme', extensionId, repository),
        uninstall: (itemId, itemType) => ipc.invoke('marketplace:uninstall', itemId, itemType),
    };
}
