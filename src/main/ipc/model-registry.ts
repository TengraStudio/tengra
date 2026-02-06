import { ModelRegistryService } from '@main/services/llm/model-registry.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { ipcMain } from 'electron';

export function registerModelRegistryIpc(
    modelRegistryService: ModelRegistryService,
    rateLimitService?: RateLimitService
) {
    ipcMain.handle('model-registry:getAllModels', async () => {
        // SEC-011: Rate limit model registry queries
        if (rateLimitService) {
            await rateLimitService.waitForToken('model-registry');
        }
        return await modelRegistryService.getAllModels();
    });

    // Legacy/Registry specific methods can also be exposed here if needed
    ipcMain.handle('model-registry:getRemoteModels', async () => {
        // SEC-011: Rate limit model registry queries
        if (rateLimitService) {
            await rateLimitService.waitForToken('model-registry');
        }
        return await modelRegistryService.getRemoteModels();
    });

    ipcMain.handle('model-registry:getInstalledModels', async () => {
        // SEC-011: Rate limit model registry queries
        if (rateLimitService) {
            await rateLimitService.waitForToken('model-registry');
        }
        return await modelRegistryService.getInstalledModels();
    });
}
