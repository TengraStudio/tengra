import { type IpcContractVersionInfo, isIpcContractCompatible } from '@shared/constants/ipc-contract';
import { IpcRenderer } from 'electron';

export interface IpcContractBridge {
    getVersion: () => Promise<IpcContractVersionInfo>;
    isCompatible: () => Promise<boolean>;
}

export function createIpcContractBridge(ipc: IpcRenderer): IpcContractBridge {
    return {
        getVersion: () => ipc.invoke('ipc:contract:get'),
        isCompatible: async () => {
            const contractInfo = (await ipc.invoke('ipc:contract:get')) as IpcContractVersionInfo;
            return isIpcContractCompatible(contractInfo);
        },
    };
}
