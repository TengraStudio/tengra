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
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
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

    /**
     * Get active task count for a provider
     */

    /**
     * Configure provider settings
     */
}
