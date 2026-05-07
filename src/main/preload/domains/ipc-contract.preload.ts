/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CONTRACT_CHANNELS } from '@shared/constants/ipc-channels';
import { type IpcContractVersionInfo, isIpcContractCompatible } from '@shared/constants/ipc-contract';
import { IpcRenderer } from 'electron';

export interface IpcContractBridge {
    getVersion: () => Promise<IpcContractVersionInfo>;
    isCompatible: () => Promise<boolean>;
}

export function createIpcContractBridge(ipc: IpcRenderer): IpcContractBridge {
    return {
        getVersion: () => ipc.invoke(CONTRACT_CHANNELS.GET),
        isCompatible: async () => {
            const contractInfo = (await ipc.invoke(CONTRACT_CHANNELS.GET)) as IpcContractVersionInfo;
            return isIpcContractCompatible(contractInfo);
        },
    };
}

