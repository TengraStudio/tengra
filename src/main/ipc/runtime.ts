/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { RuntimeBootstrapExecutionResult } from '@shared/types/runtime-manifest';
import { ipcMain } from 'electron';

export function registerRuntimeIpc(runtimeBootstrapService: RuntimeBootstrapService): void {
    ipcMain.handle(
        'runtime:get-status',
        createSafeIpcHandler<RuntimeBootstrapExecutionResult | null>(
            'runtime:get-status',
            async () => runtimeBootstrapService.getLatestExecutionResult(),
            null
        )
    );

    ipcMain.handle(
        'runtime:refresh-status',
        createSafeIpcHandler<RuntimeBootstrapExecutionResult | null>(
            'runtime:refresh-status',
            async () => runtimeBootstrapService.scanManagedRuntime(),
            null
        )
    );

    ipcMain.handle(
        'runtime:repair',
        createSafeIpcHandler<RuntimeBootstrapExecutionResult | null, [string | undefined]>(
            'runtime:repair',
            async (_event, manifestUrl) =>
                runtimeBootstrapService.ensureManagedRuntime(manifestUrl),
            null
        )
    );

    ipcMain.handle(
        'runtime:run-component-action',
        createSafeIpcHandler<{ success: boolean; message: string }, [string]>(
            'runtime:run-component-action',
            async (_event, componentId) =>
                runtimeBootstrapService.runComponentAction(componentId),
            { success: false, message: 'Runtime action failed' }
        )
    );
}
