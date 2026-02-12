import { ModelProviderInfo, ModelRegistryService } from '@main/services/llm/model-registry.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for model registry operations.
 * Exposes channels for querying all, remote, and installed models.
 * @param modelRegistryService - Service for accessing model registry data
 * @param rateLimitService - Optional rate limiter to throttle registry queries (SEC-011)
 */
export function registerModelRegistryIpc(
    modelRegistryService: ModelRegistryService,
    rateLimitService?: RateLimitService
) {
    ipcMain.handle('model-registry:getAllModels', createSafeIpcHandler('model-registry:getAllModels', async (): Promise<ModelProviderInfo[]> => {
        if (rateLimitService) {
            await rateLimitService.waitForToken('model-registry');
        }
        return await modelRegistryService.getAllModels();
    }, []));

    ipcMain.handle('model-registry:getRemoteModels', createSafeIpcHandler('model-registry:getRemoteModels', async (): Promise<ModelProviderInfo[]> => {
        if (rateLimitService) {
            await rateLimitService.waitForToken('model-registry');
        }
        return await modelRegistryService.getRemoteModels();
    }, []));

    ipcMain.handle('model-registry:getInstalledModels', createSafeIpcHandler('model-registry:getInstalledModels', async (): Promise<ModelProviderInfo[]> => {
        if (rateLimitService) {
            await rateLimitService.waitForToken('model-registry');
        }
        return await modelRegistryService.getInstalledModels();
    }, []));
}
