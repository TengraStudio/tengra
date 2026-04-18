/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IpcRenderer } from 'electron';

export interface SecurityBridge {
    resetMasterKey: () => Promise<{ success: boolean; error?: string }>;
}

export function createSecurityBridge(ipc: IpcRenderer): SecurityBridge {
    return {
        resetMasterKey: () => ipc.invoke('security:reset-master-key'),
    };
}
