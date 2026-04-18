/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LocalePack } from '@shared/types/locale';
import { IpcRenderer } from 'electron';

export interface LocaleBridge {
    getAll: () => Promise<LocalePack[]>;
}

export function createLocaleBridge(ipc: IpcRenderer): LocaleBridge {
    return {
        getAll: () => ipc.invoke('locale:runtime:getAll'),
    };
}
