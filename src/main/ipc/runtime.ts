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
