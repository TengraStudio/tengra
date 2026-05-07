/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MODEL_REGISTRY_CHANNELS } from '@shared/constants/ipc-channels';
import { ModelDefinition } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface ModelRegistryBridge {
    getAllModels: () => Promise<ModelDefinition[]>;
    getRemoteModels: () => Promise<ModelDefinition[]>;
    getInstalledModels: () => Promise<ModelDefinition[]>;
}

export function createModelRegistryBridge(ipc: IpcRenderer): ModelRegistryBridge {
    return {
        getAllModels: () => ipc.invoke(MODEL_REGISTRY_CHANNELS.GET_ALL_MODELS),
        getRemoteModels: () => ipc.invoke(MODEL_REGISTRY_CHANNELS.GET_REMOTE_MODELS),
        getInstalledModels: () => ipc.invoke(MODEL_REGISTRY_CHANNELS.GET_INSTALLED_MODELS),
    };
}

