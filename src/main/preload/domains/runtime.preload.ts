/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { RUNTIME_CHANNELS } from '@shared/constants/ipc-channels';
import type { RuntimeBootstrapExecutionResult } from '@shared/types/runtime-manifest';
import { IpcRenderer } from 'electron';

export interface RuntimeBridge {
    getStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
    refreshStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
    repair: (manifestUrl?: string) => Promise<RuntimeBootstrapExecutionResult | null>;
    runComponentAction: (componentId: string) => Promise<{ success: boolean; message: string }>;
}

export function createRuntimeBridge(ipc: IpcRenderer): RuntimeBridge {
    return {
        getStatus: () => ipc.invoke(RUNTIME_CHANNELS.GET_STATUS),
        refreshStatus: () => ipc.invoke(RUNTIME_CHANNELS.REFRESH_STATUS),
        repair: manifestUrl => ipc.invoke(RUNTIME_CHANNELS.REPAIR, manifestUrl),
        runComponentAction: componentId => ipc.invoke(RUNTIME_CHANNELS.RUN_COMPONENT_ACTION, componentId),
    };
}

