/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MARKETPLACE_CHANNELS } from '@shared/constants/ipc-channels';
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
        fetch: () => ipc.invoke(MARKETPLACE_CHANNELS.FETCH),
        getRuntimeProfile: () => ipc.invoke(MARKETPLACE_CHANNELS.GET_RUNTIME_PROFILE),
        install: (request) => ipc.invoke(MARKETPLACE_CHANNELS.INSTALL, request),
        getUpdateCount: () => ipc.invoke(MARKETPLACE_CHANNELS.GET_UPDATE_COUNT),
        checkLiveUpdates: () => ipc.invoke(MARKETPLACE_CHANNELS.CHECK_LIVE_UPDATES),
        fetchReadme: (extensionId: string, repository?: string) => ipc.invoke(MARKETPLACE_CHANNELS.FETCH_README, extensionId, repository),
        uninstall: (itemId, itemType) => ipc.invoke(MARKETPLACE_CHANNELS.UNINSTALL, itemId, itemType),
    };
}

