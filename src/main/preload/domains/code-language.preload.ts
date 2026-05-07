/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CODE_LANGUAGE_CHANNELS } from '@shared/constants/ipc-channels';
import { MarketplaceCodeLanguagePack } from '@shared/types/marketplace';
import { IpcRenderer } from 'electron';

export interface CodeLanguageBridge {
    getAll: () => Promise<MarketplaceCodeLanguagePack[]>;
    onRuntimeUpdated: (callback: () => void) => () => void;
}

export function createCodeLanguageBridge(ipc: IpcRenderer): CodeLanguageBridge {
    return {
        getAll: () => ipc.invoke(CODE_LANGUAGE_CHANNELS.RUNTIME_GET_ALL),
        onRuntimeUpdated: callback => {
            const listener = () => callback();
            ipc.on(CODE_LANGUAGE_CHANNELS.RUNTIME_UPDATED, listener);
            return () => ipc.removeListener(CODE_LANGUAGE_CHANNELS.RUNTIME_UPDATED, listener);
        },
    };
}

