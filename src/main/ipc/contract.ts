/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import type { IpcContractVersionInfo } from '@shared/constants/ipc-contract';
import {
    IPC_CONTRACT_MIN_MAIN_VERSION,
    IPC_CONTRACT_MIN_RENDERER_VERSION,
    IPC_CONTRACT_VERSION,
} from '@shared/constants/ipc-contract';
import { ipcMain } from 'electron';

const CONTRACT_INFO: IpcContractVersionInfo = {
    version: IPC_CONTRACT_VERSION,
    minRendererVersion: IPC_CONTRACT_MIN_RENDERER_VERSION,
    minMainVersion: IPC_CONTRACT_MIN_MAIN_VERSION,
};

/**
 * Registers IPC handler for contract version negotiation between renderer and main.
 */
export function registerContractIpc(): void {
    ipcMain.handle(
        'ipc:contract:get',
        createSafeIpcHandler(
            'ipc:contract:get',
            async (): Promise<IpcContractVersionInfo> => CONTRACT_INFO,
            CONTRACT_INFO
        )
    );
}

