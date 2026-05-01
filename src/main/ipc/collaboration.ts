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
 * IPC Handlers for Model Collaboration
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { ModelCollaborationService } from '@main/services/llm/model-collaboration.service';
import { multiLLMOrchestrator } from '@main/services/llm/multi-llm-orchestrator.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { Message } from '@shared/types/chat';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

const CollaborationConfigSchema = z.object({
    maxConcurrent: z.any().refine(val => typeof val === 'number' && val > 0, { message: 'maxConcurrent must be a positive number' }),
    priority: z.any().refine(val => typeof val === 'number', { message: 'priority must be a number' }),
    rateLimitPerMinute: z.any().refine(val => typeof val === 'number' && val > 0, { message: 'rateLimitPerMinute must be a positive number' }),
});

/**
 * Registers IPC handlers for model collaboration
 * @param collaborationService Service for model collaboration
 */
export function registerCollaborationIpc(getMainWindow: () => BrowserWindow | null, collaborationService: ModelCollaborationService) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'collaboration operation');

    /**
     * Run multiple models in collaboration
     */
    ipcMain.handle('collaboration:run', createIpcHandler('collaboration:run', async (
        event: IpcMainInvokeEvent,
        request: {
            messages: Message[]
            models: Array<{ provider: string; model: string }>
            strategy: 'consensus' | 'vote' | 'best-of-n' | 'chain-of-thought'
            options?: {
                temperature?: number
                maxTokens?: number
            }
        }
    ) => {
        validateSender(event);
        if (!request || typeof request !== 'object') {
            throw new Error('Invalid collaboration request');
        }
        if (!Array.isArray(request.messages)) {
            throw new Error('Messages must be an array');
        }
        if (!Array.isArray(request.models) || request.models.length === 0) {
            throw new Error('Models must be a non-empty array');
        }
        const validStrategies = ['consensus', 'vote', 'best-of-n', 'chain-of-thought'] as const;
        if (!validStrategies.includes(request.strategy)) {
            throw new Error('Strategy must be one of: consensus, vote, best-of-n, chain-of-thought');
        }

        return await collaborationService.collaborate(request);
    }, { wrapResponse: true }));

    /**
     * Get provider statistics
     */
    ipcMain.handle('collaboration:getProviderStats', createIpcHandler('collaboration:getProviderStats', async (event, provider: string) => {
        validateSender(event);
        try {
            if (!provider || typeof provider !== 'string') {
                const allStats = multiLLMOrchestrator.getAllStats();
                return Object.fromEntries(allStats);
            }
            const stats = multiLLMOrchestrator.getProviderStats(provider);
            return stats ?? null;
        } catch (error) {
            return {};
        }
    }, { wrapResponse: true }));

    /**
     * Get active task count for a provider
     */
    ipcMain.handle('collaboration:getActiveTaskCount', createIpcHandler('collaboration:getActiveTaskCount', async (event, provider: string) => {
        validateSender(event);
        try {
            if (typeof provider !== 'string') {
                return 0;
            }
            return multiLLMOrchestrator.getActiveTaskCount(provider);
        } catch (error) {
            return 0;
        }
    }, { wrapResponse: true }));

    /**
     * Configure provider settings
     */
    ipcMain.handle('collaboration:setProviderConfig', createIpcHandler('collaboration:setProviderConfig', async (event, provider: string, config: any) => {
        validateSender(event);
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string');
        }

        try {
            const validatedConfig = CollaborationConfigSchema.parse(config);
            multiLLMOrchestrator.setProviderConfig(provider, validatedConfig);
            return { success: true };
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(error.issues[0].message);
            }
            throw error;
        }
    }, { wrapResponse: true }));
}
