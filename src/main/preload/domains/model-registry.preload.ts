/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ModelDefinition } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface ModelRegistryBridge {
    getAllModels: () => Promise<ModelDefinition[]>;
    getRemoteModels: () => Promise<ModelDefinition[]>;
    getInstalledModels: () => Promise<ModelDefinition[]>;
}

export function createModelRegistryBridge(ipc: IpcRenderer): ModelRegistryBridge {
    return {
        getAllModels: () => ipc.invoke('model-registry:get-all'),
        getRemoteModels: () => ipc.invoke('model-registry:get-remote'),
        getInstalledModels: () => ipc.invoke('model-registry:get-installed'),
    };
}
