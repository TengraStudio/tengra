/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ExtensionRuntimeInfo } from '@shared/types/system/extension';
import { appLogger } from '@system/utils/renderer-logger';
import { create } from 'zustand';

interface ExtensionStoreState {
    extensions: ExtensionRuntimeInfo[];
    isLoading: boolean;
    error: string | null;
    fetchExtensions: () => Promise<void>;
    activateExtension: (id: string) => Promise<void>;
    deactivateExtension: (id: string) => Promise<void>;
    uninstallExtension: (id: string) => Promise<void>;
}

const EXTENSION_STATE_CHANNEL = 'extension:state-changed';

type ExtensionGetAllResponse = {
    success: boolean;
    extensions: ExtensionRuntimeInfo[];
};

const fetchExtensionsFromBridge = async (): Promise<ExtensionGetAllResponse> => {
    if (window.electron.extension?.getAll) {
        return window.electron.extension.getAll() as Promise<ExtensionGetAllResponse>;
    }
    return window.electron.invoke<ExtensionGetAllResponse>('extension:get-all');
};

const activateExtensionFromBridge = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (window.electron.extension?.activate) {
        return window.electron.extension.activate(id) as Promise<{ success: boolean; error?: string }>;
    }
    return window.electron.invoke<{ success: boolean; error?: string }>('extension:activate', id);
};

const deactivateExtensionFromBridge = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (window.electron.extension?.deactivate) {
        return window.electron.extension.deactivate(id) as Promise<{ success: boolean; error?: string }>;
    }
    return window.electron.invoke<{ success: boolean; error?: string }>('extension:deactivate', id);
};

const uninstallExtensionFromBridge = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (window.electron.extension?.uninstall) {
        return window.electron.extension.uninstall(id) as Promise<{ success: boolean; error?: string }>;
    }
    return window.electron.invoke<{ success: boolean; error?: string }>('extension:uninstall', id);
};

export const useExtensionStore = create<ExtensionStoreState>((set) => ({
    extensions: [],
    isLoading: false,
    error: null,
    fetchExtensions: async () => {
        set({ isLoading: true, error: null });
        try {
            const result = await fetchExtensionsFromBridge();
            if (result.success) {
                set({ extensions: result.extensions, isLoading: false });
            } else {
                set({ error: 'Failed to fetch extensions', isLoading: false });
            }
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },
    activateExtension: async (id: string) => {
        try {
            const result = await activateExtensionFromBridge(id);
            if (!result.success) {
                throw new Error(result.error ?? 'Failed to activate extension');
            }
            await useExtensionStore.getState().fetchExtensions();
        } catch (err) {
            set({ error: (err as Error).message });
        }
    },
    deactivateExtension: async (id: string) => {
        try {
            const result = await deactivateExtensionFromBridge(id);
            if (!result.success) {
                throw new Error(result.error ?? 'Failed to deactivate extension');
            }
            await useExtensionStore.getState().fetchExtensions();
        } catch (err) {
            set({ error: (err as Error).message });
        }
    },
    uninstallExtension: async (id: string) => {
        try {
            const result = await uninstallExtensionFromBridge(id);
            if (!result.success) {
                throw new Error(result.error ?? 'Failed to uninstall extension');
            }
            await useExtensionStore.getState().fetchExtensions();
        } catch (err) {
            set({ error: (err as Error).message });
        }
    },
}));

let extensionStateListenerBound = false;

function bindExtensionStateListener(): void {
    if (extensionStateListenerBound) {
        return;
    }
    if (typeof window === 'undefined' || !window.electron || typeof window.electron.on !== 'function') {
        return;
    }

    extensionStateListenerBound = true;
    window.electron.on(EXTENSION_STATE_CHANNEL, () => {
        void useExtensionStore.getState().fetchExtensions();
    });
}

if (typeof window !== 'undefined' && window.electron) {
    bindExtensionStateListener();
    void useExtensionStore.getState().fetchExtensions();
} else {
    appLogger.debug('ExtensionStore', 'Skipping extension store bootstrap (electron bridge unavailable)');
}

