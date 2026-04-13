import { ModelProviderInfo, ModelRegistryService } from '@main/services/llm/model-registry.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for model registry operations.
 * Exposes channels for querying all, remote, and installed models.
 * @param modelRegistryService - Service for accessing model registry data
 */
export function registerModelRegistryIpc(modelRegistryService: ModelRegistryService) {
    ipcMain.handle('model-registry:get-all', createSafeIpcHandler('model-registry:get-all', async (): Promise<ModelProviderInfo[]> => {
        return await modelRegistryService.getAllModels();
    }, []));

    // Alias for backward compatibility if needed, but we aligned preload
    ipcMain.handle('model-registry:getAllModels', createSafeIpcHandler('model-registry:getAllModels', async (): Promise<ModelProviderInfo[]> => {
        return await modelRegistryService.getAllModels();
    }, []));

    ipcMain.handle('model-registry:get-remote', createSafeIpcHandler('model-registry:get-remote', async (): Promise<ModelProviderInfo[]> => {
        return await modelRegistryService.getRemoteModels();
    }, []));

    ipcMain.handle('model-registry:get-installed', createSafeIpcHandler('model-registry:get-installed', async (): Promise<ModelProviderInfo[]> => {
        return await modelRegistryService.getInstalledModels();
    }, []));
}
