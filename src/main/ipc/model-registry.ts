import { ModelRegistryService } from '@main/services/llm/model-registry.service'
import { ipcMain } from 'electron'

export function registerModelRegistryIpc(modelRegistryService: ModelRegistryService) {
    ipcMain.handle('model-registry:getAllModels', async () => {
        return await modelRegistryService.getAllModels()
    })

    // Legacy/Registry specific methods can also be exposed here if needed
    ipcMain.handle('model-registry:getRemoteModels', async () => {
        return await modelRegistryService.getRemoteModels()
    })

    ipcMain.handle('model-registry:getInstalledModels', async () => {
        return await modelRegistryService.getInstalledModels()
    })
}
