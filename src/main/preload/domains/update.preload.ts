import { IpcRenderer } from 'electron';

export interface UpdateBridge {
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
}

export function createUpdateBridge(ipc: IpcRenderer): UpdateBridge {
    return {
        checkForUpdates: () => ipc.invoke('update:check'),
        downloadUpdate: () => ipc.invoke('update:download'),
        installUpdate: () => ipc.invoke('update:install'),
    };
}
