/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@renderer/utils/renderer-logger';
import { MarketplaceRegistry } from '@shared/types/marketplace';
import { useSyncExternalStore } from 'react';

import { pushNotification } from './notification-center.store';

interface MarketplaceState {
    updateCount: number;
    registry: MarketplaceRegistry | null;
}

let marketplaceState: MarketplaceState = {
    updateCount: 0,
    registry: null,
};

const listeners = new Set<() => void>();

export const marketplaceStore = {
    getState: () => marketplaceState,
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    setUpdateCount: (count: number) => {
        marketplaceState = { ...marketplaceState, updateCount: count };
        listeners.forEach(l => l());
    },
    setRegistry: (registry: MarketplaceRegistry) => {
        marketplaceState = { ...marketplaceState, registry };
        listeners.forEach(l => l());
    },
    checkForUpdates: async () => {
        try {
            const [count, registry] = await Promise.all([
                window.electron.marketplace.getUpdateCount(),
                window.electron.marketplace.fetch()
            ]);
            marketplaceStore.setUpdateCount(count);
            marketplaceStore.setRegistry(registry);
            return count;
        } catch (error) {
            appLogger.error('MarketplaceStore', 'Failed to check for marketplace updates:', error as Error);
            return 0;
        }
    },
    checkLiveUpdates: async (silent: boolean = false) => { 
        try {
            const count = await window.electron.marketplace.checkLiveUpdates();
            marketplaceState = { ...marketplaceState, updateCount: count };
            // Re-fetch registry to get updated markers
            const registry = await window.electron.marketplace.fetch();
            marketplaceState = { ...marketplaceState, registry };
            listeners.forEach(l => l());

            if (!silent && count > 0) {
                pushNotification({
                    type: 'success',
                    message: `Found ${count} update${count === 1 ? '' : 's'} available`,
                });
            } else if (!silent && count === 0) {
                pushNotification({
                    type: 'info',
                    message: 'All extensions are up to date',
                    durationMs: 3000,
                });
            }
            return count;
        } catch (error) {
            appLogger.error('MarketplaceStore', 'Failed to check for live marketplace updates:', error as Error);
            return 0;
        }
    },
    fetchReadme: async (extensionId: string, repository?: string) => {
        try {
            return await window.electron.marketplace.fetchReadme(extensionId, repository);
        } catch (error) {
            appLogger.error('MarketplaceStore', 'Failed to fetch extension readme:', error as Error);
            return null;
        }
    }
};

export function useMarketplaceStore<T>(selector: (state: MarketplaceState) => T): T {
    const state = useSyncExternalStore(marketplaceStore.subscribe, marketplaceStore.getState, marketplaceStore.getState);
    return selector(state);
}
