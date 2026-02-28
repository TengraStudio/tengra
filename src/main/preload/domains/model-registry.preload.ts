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
