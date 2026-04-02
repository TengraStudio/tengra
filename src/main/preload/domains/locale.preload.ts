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
