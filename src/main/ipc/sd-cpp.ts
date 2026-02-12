/**
 * IPC handlers for SD-CPP (Stable Diffusion C++) service
 */
import { LocalImageService } from '@main/services/llm/local-image.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

/**
 * Registers SD-CPP related IPC handlers.
 * 
 * @param localImageService - The LocalImageService instance to use.
 */
export const registerSdCppIpc = (localImageService: LocalImageService) => {
    /**
     * Get the current status of the SD-CPP runtime
     */
    ipcMain.handle('sd-cpp:getStatus', createSafeIpcHandler<string, []>('sd-cpp:getStatus', async () => {
        return await localImageService.getSDCppStatus();
    }, 'notConfigured'));

    /**
     * Force a reinstallation / repair of the SD-CPP runtime
     */
    ipcMain.handle('sd-cpp:reinstall', createSafeIpcHandler<void, []>('sd-cpp:reinstall', async () => {
        return await localImageService.repairSDCpp();
    }, void 0));
};
