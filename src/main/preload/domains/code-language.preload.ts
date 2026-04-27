/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MarketplaceCodeLanguagePack } from '@shared/types/marketplace';
import { IpcRenderer } from 'electron';

export interface CodeLanguageBridge {
    getAll: () => Promise<MarketplaceCodeLanguagePack[]>;
}

export function createCodeLanguageBridge(ipc: IpcRenderer): CodeLanguageBridge {
    return {
        getAll: () => ipc.invoke('code-language:runtime:getAll'),
    };
}
