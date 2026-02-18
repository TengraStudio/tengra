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

    ipcMain.handle('sd-cpp:getHistory', createSafeIpcHandler('sd-cpp:getHistory', async (_event, limit?: number) => {
        return localImageService.getGenerationHistory(limit);
    }, []));

    ipcMain.handle('sd-cpp:regenerate', createSafeIpcHandler('sd-cpp:regenerate', async (_event, historyId: string) => {
        return localImageService.regenerateFromHistory(historyId);
    }, ''));

    ipcMain.handle('sd-cpp:getAnalytics', createSafeIpcHandler('sd-cpp:getAnalytics', async () => {
        return localImageService.getImageAnalytics();
    }, { totalGenerated: 0, byProvider: {}, averageSteps: 0 }));

    ipcMain.handle('sd-cpp:listPresets', createSafeIpcHandler('sd-cpp:listPresets', async () => {
        return localImageService.listGenerationPresets();
    }, []));

    ipcMain.handle('sd-cpp:savePreset', createSafeIpcHandler('sd-cpp:savePreset', async (_event, preset: {
        id?: string;
        name: string;
        promptPrefix?: string;
        width: number;
        height: number;
        steps: number;
        cfgScale: number;
        provider?: 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'pollinations' | 'sd-cpp';
    }) => {
        return localImageService.saveGenerationPreset(preset);
    }, null));

    ipcMain.handle('sd-cpp:deletePreset', createSafeIpcHandler('sd-cpp:deletePreset', async (_event, id: string) => {
        return localImageService.deleteGenerationPreset(id);
    }, false));

    ipcMain.handle('sd-cpp:schedule', createSafeIpcHandler('sd-cpp:schedule', async (_event, payload: {
        runAt: number;
        options: {
            prompt: string;
            negativePrompt?: string;
            width?: number;
            height?: number;
            steps?: number;
            cfgScale?: number;
            seed?: number;
            count?: number;
        };
    }) => {
        return localImageService.scheduleGeneration(payload.runAt, payload.options);
    }, null));

    ipcMain.handle('sd-cpp:listSchedules', createSafeIpcHandler('sd-cpp:listSchedules', async () => {
        return localImageService.listScheduledGenerations();
    }, []));

    ipcMain.handle('sd-cpp:cancelSchedule', createSafeIpcHandler('sd-cpp:cancelSchedule', async (_event, id: string) => {
        return localImageService.cancelScheduledGeneration(id);
    }, false));

    ipcMain.handle('sd-cpp:compare', createSafeIpcHandler('sd-cpp:compare', async (_event, ids: string[]) => {
        return localImageService.compareGenerations(ids);
    }, null));

    ipcMain.handle('sd-cpp:batchGenerate', createSafeIpcHandler('sd-cpp:batchGenerate', async (_event, requests: Array<{
        prompt: string;
        negativePrompt?: string;
        width?: number;
        height?: number;
        steps?: number;
        cfgScale?: number;
        seed?: number;
        count?: number;
    }>) => {
        return localImageService.runBatchGeneration(requests);
    }, []));

    ipcMain.handle('sd-cpp:getQueueStats', createSafeIpcHandler('sd-cpp:getQueueStats', async () => {
        return localImageService.getQueueStats();
    }, { queued: 0, running: false }));

    ipcMain.handle('sd-cpp:edit', createSafeIpcHandler('sd-cpp:edit', async (_event, options: {
        sourceImage: string;
        mode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer';
        prompt: string;
        negativePrompt?: string;
        strength?: number;
        width?: number;
        height?: number;
        maskImage?: string;
    }) => {
        return localImageService.editImage(options);
    }, ''));
};
