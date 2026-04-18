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
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { Message } from '@shared/types/chat';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

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
    ipcMain.handle('collaboration:getProviderStats', createSafeIpcHandler('collaboration:getProviderStats', async (
        event: IpcMainInvokeEvent,
        provider?: string
    ) => {
        validateSender(event);
        if (provider) {
            return multiLLMOrchestrator.getProviderStats(provider) ?? null;
        }
        return Object.fromEntries(multiLLMOrchestrator.getAllStats());
    }, {}, { wrapResponse: true }));

    /**
     * Get active task count for a provider
     */
    ipcMain.handle('collaboration:getActiveTaskCount', createSafeIpcHandler('collaboration:getActiveTaskCount', async (
        event: IpcMainInvokeEvent,
        provider: string
    ) => {
        validateSender(event);
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string');
        }
        return multiLLMOrchestrator.getActiveTaskCount(provider);
    }, 0, { wrapResponse: true }));

    /**
     * Configure provider settings
     */
    ipcMain.handle('collaboration:setProviderConfig', createIpcHandler('collaboration:setProviderConfig', async (
        event: IpcMainInvokeEvent,
        provider: string,
        config: {
            maxConcurrent: number
            priority: number
            rateLimitPerMinute: number
        }
    ) => {
        validateSender(event);
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string');
        }
        if (typeof config.maxConcurrent !== 'number' || config.maxConcurrent < 1) {
            throw new Error('maxConcurrent must be a positive number');
        }
        if (typeof config.priority !== 'number') {
            throw new Error('priority must be a number');
        }
        if (typeof config.rateLimitPerMinute !== 'number' || config.rateLimitPerMinute < 1) {
            throw new Error('rateLimitPerMinute must be a positive number');
        }

        multiLLMOrchestrator.setProviderConfig(provider, config);
        return { success: true };
    }, { wrapResponse: true }));
}
