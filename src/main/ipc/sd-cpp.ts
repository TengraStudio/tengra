/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * IPC handlers for SD-CPP (Stable Diffusion C++) service
 */
import { LocalImageService } from '@main/services/llm/local-image.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';
/**
 * Registers SD-CPP related IPC handlers.
 * 
 * @param localImageService - The LocalImageService instance to use.
 */
import { BrowserWindow } from 'electron';

/**
 * Registers SD-CPP related IPC handlers.
 * 
 * @param localImageService - The LocalImageService instance to use.
 * @param getMainWindow - Function to get the main window instance.
 * @param eventBusService - The event bus service to listen for events.
 */
export const registerSdCppIpc = (
    localImageService: LocalImageService,
    getMainWindow: () => BrowserWindow | null,
    eventBusService: EventBusService
) => {
    // Forward status and progress events to the renderer
    eventBusService.on('sd-cpp:status', (status) => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('sd-cpp:status', status);
        }
    });

    eventBusService.on('sd-cpp:progress', (progress) => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('sd-cpp:progress', progress);
        }
    });

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
    }, { totalGenerated: 0, byProvider: {}, averageSteps: 0, bySource: {}, averageDurationMs: 0, editModeCounts: {} }));

    ipcMain.handle('sd-cpp:getPresetAnalytics', createSafeIpcHandler('sd-cpp:getPresetAnalytics', async () => {
        return localImageService.getPresetAnalytics();
    }, { totalPresets: 0, providerCounts: {}, customPresets: 0 }));

    ipcMain.handle('sd-cpp:getScheduleAnalytics', createSafeIpcHandler('sd-cpp:getScheduleAnalytics', async () => {
        return localImageService.getScheduleAnalytics();
    }, { total: 0, byStatus: {}, byPriority: {} }));

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
        provider?: 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'sd-cpp';
    }) => {
        return localImageService.saveGenerationPreset(preset);
    }, null));

    ipcMain.handle('sd-cpp:deletePreset', createSafeIpcHandler('sd-cpp:deletePreset', async (_event, id: string) => {
        return localImageService.deleteGenerationPreset(id);
    }, false));

    ipcMain.handle('sd-cpp:exportPresetShare', createSafeIpcHandler('sd-cpp:exportPresetShare', async (_event, id: string) => {
        return localImageService.exportGenerationPresetShareCode(id);
    }, ''));

    ipcMain.handle('sd-cpp:importPresetShare', createSafeIpcHandler('sd-cpp:importPresetShare', async (_event, code: string) => {
        return localImageService.importGenerationPresetShareCode(code);
    }, null));

    ipcMain.handle('sd-cpp:listWorkflowTemplates', createSafeIpcHandler('sd-cpp:listWorkflowTemplates', async () => {
        return localImageService.listComfyWorkflowTemplates();
    }, []));

    ipcMain.handle('sd-cpp:saveWorkflowTemplate', createSafeIpcHandler('sd-cpp:saveWorkflowTemplate', async (_event, payload: {
        id?: string;
        name: string;
        description?: string;
        workflow: Record<string, RuntimeValue>;
    }) => {
        return localImageService.saveComfyWorkflowTemplate(payload);
    }, null));

    ipcMain.handle('sd-cpp:deleteWorkflowTemplate', createSafeIpcHandler('sd-cpp:deleteWorkflowTemplate', async (_event, id: string) => {
        return localImageService.deleteComfyWorkflowTemplate(id);
    }, false));

    ipcMain.handle('sd-cpp:exportWorkflowTemplateShare', createSafeIpcHandler('sd-cpp:exportWorkflowTemplateShare', async (_event, id: string) => {
        return localImageService.exportComfyWorkflowTemplateShareCode(id);
    }, ''));

    ipcMain.handle('sd-cpp:importWorkflowTemplateShare', createSafeIpcHandler('sd-cpp:importWorkflowTemplateShare', async (_event, code: string) => {
        return localImageService.importComfyWorkflowTemplateShareCode(code);
    }, null));

    ipcMain.handle('sd-cpp:schedule', createSafeIpcHandler('sd-cpp:schedule', async (_event, payload: {
        runAt: number;
        priority?: 'low' | 'normal' | 'high';
        resourceProfile?: 'balanced' | 'quality' | 'speed';
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
        return localImageService.scheduleGeneration(payload.runAt, payload.options, {
            priority: payload.priority,
            resourceProfile: payload.resourceProfile
        });
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

    ipcMain.handle('sd-cpp:exportComparison', createSafeIpcHandler('sd-cpp:exportComparison', async (
        _event,
        payload: { ids: string[]; format?: 'json' | 'csv' }
    ) => {
        return localImageService.exportComparison(payload.ids, payload.format ?? 'json');
    }, ''));

    ipcMain.handle('sd-cpp:shareComparison', createSafeIpcHandler('sd-cpp:shareComparison', async (_event, ids: string[]) => {
        return localImageService.shareComparison(ids);
    }, ''));

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
    }, { queued: 0, running: false, byPriority: {} }));

    ipcMain.handle('sd-cpp:searchHistory', createSafeIpcHandler('sd-cpp:searchHistory', async (_event, query: string, limit?: number) => {
        return localImageService.searchGenerationHistory(query, limit);
    }, []));

    ipcMain.handle('sd-cpp:exportHistory', createSafeIpcHandler('sd-cpp:exportHistory', async (_event, format?: 'json' | 'csv') => {
        return localImageService.exportGenerationHistory(format ?? 'json');
    }, '[]'));

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
