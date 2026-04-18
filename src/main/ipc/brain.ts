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
 * IPC handlers for Brain Service
 * User-focused memory system
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { BrainService, UserFact } from '@main/services/llm/brain.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain } from 'electron';


export function registerBrainIpcHandlers(getMainWindow: () => BrowserWindow | null, brainService: BrainService) {
    const handleError = (error: Error) => ({ success: false, error: String(error) });
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'brain operation');

    // Learn a fact about the user
    ipcMain.handle('brain:learn', createIpcHandler('brain:learn', async (event, category: UserFact['category'], content: string, confidence?: number) => {
        validateSender(event);
        const fact = await brainService.learnUserFact(
            category,
            content,
            confidence ?? 0.8
        );
        return { success: true, fact };
    }, { onError: handleError }));

    // Recall relevant user facts
    ipcMain.handle('brain:recall', createIpcHandler('brain:recall', async (event, query: string, limit?: number) => {
        validateSender(event);
        const facts = await brainService.recallUserFacts(query, limit ?? 5);
        return { success: true, facts };
    }, { onError: handleError }));

    // Get facts by category
    ipcMain.handle('brain:getByCategory', createIpcHandler('brain:getByCategory', async (event, category: UserFact['category']) => {
        validateSender(event);
        const facts = await brainService.getUserFactsByCategory(category);
        return { success: true, facts };
    }, { onError: handleError }));

    // Get full brain context
    ipcMain.handle('brain:getContext', createIpcHandler('brain:getContext', async (event, query?: string) => {
        validateSender(event);
        const context = await brainService.getBrainContext(query);
        return { success: true, context };
    }, { onError: handleError }));

    // Extract facts from message
    ipcMain.handle('brain:extractFromMessage', createIpcHandler('brain:extractFromMessage', async (event, message: string, userId?: string) => {
        validateSender(event);
        const facts = await brainService.extractUserFactsFromMessage(message, userId);
        return { success: true, facts };
    }, { onError: handleError }));

    // Forget a fact
    ipcMain.handle('brain:forget', createIpcHandler('brain:forget', async (event, factId: string) => {
        validateSender(event);
        await brainService.forgetUserFact(factId);
        return { success: true };
    }, { onError: handleError }));

    // Update fact confidence
    ipcMain.handle('brain:updateConfidence', createIpcHandler('brain:updateConfidence', async (event, factId: string, confidence: number) => {
        validateSender(event);
        await brainService.updateFactConfidence(factId, confidence);
        return { success: true };
    }, { onError: handleError }));

    // Get brain stats
    ipcMain.handle('brain:getStats', createIpcHandler('brain:getStats', async (event) => {
        validateSender(event);
        const stats = await brainService.getBrainStats();
        return { success: true, stats };
    }, { onError: handleError }));

    appLogger.debug('BrainIPC', 'Brain IPC handlers registered');
}

