/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import type { MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

const compareRequestSchema = z.object({
    chatId: z.string().trim().min(1).max(128),
    messages: z.array(z.any()).min(1),
    models: z.array(z.any()).min(1).max(10),
    options: z.record(z.string(), z.any()).optional()
});

/**
 * Registers IPC handlers for multi-model comparison operations
 */
export function registerMultiModelIpc(
    comparisonService: MultiModelComparisonService,
    getMainWindow: () => BrowserWindow | null = () => null
): void {
    appLogger.info('MultiModelIPC', 'Registering multi-model IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'multi-model operation');

    ipcMain.handle('llm:compare-models', async (event, request: any) => {
        validateSender(event);

        try {
            if (!request || typeof request !== 'object') {
                throw new Error('Invalid comparison request');
            }

            const parsed = compareRequestSchema.parse(request);

            // AUD-SEC-038: Filter and validate model entries
            const validModels = parsed.models.filter(m => {
                return m && 
                       typeof m === 'object' && 
                       typeof m.provider === 'string' && 
                       m.provider.length > 0 &&
                       typeof m.model === 'string' && 
                       m.model.length > 0;
            });

            if (validModels.length === 0) {
                throw new Error('Invalid comparison request');
            }

            const finalRequest = {
                ...parsed,
                models: validModels
            };

            return await withOperationGuard('llm', async () => {
                return await comparisonService.compareModels(finalRequest);
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                appLogger.warn('MultiModelIPC', `Validation failed: ${error.message}`);
                throw new Error('Invalid comparison request');
            }
            if (error instanceof Error && error.message === 'Invalid comparison request') {
                throw error;
            }
            appLogger.error('MultiModelIPC', `Execution failed: ${error}`);
            throw error;
        }
    });

    ipcMain.handle('llm:get-comparison-history', async (event) => {
        validateSender(event);
        return await comparisonService.getHistory();
    });

    ipcMain.handle('llm:clear-comparison-history', async (event) => {
        validateSender(event);
        return await comparisonService.clearHistory();
    });
}
