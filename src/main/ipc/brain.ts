/**
 * IPC handlers for Brain Service
 * User-focused memory system
 */

import { appLogger } from '@main/logging/logger';
import { BrainService, UserFact } from '@main/services/llm/brain.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';


export function registerBrainIpcHandlers(brainService: BrainService) {
    const handleError = (error: Error) => ({ success: false, error: String(error) });

    // Learn a fact about the user
    ipcMain.handle('brain:learn', createIpcHandler('brain:learn', async (_event, category: UserFact['category'], content: string, confidence?: number) => {
        const fact = await brainService.learnUserFact(
            category,
            content,
            confidence ?? 0.8
        );
        return { success: true, fact };
    }, { onError: handleError }));

    // Recall relevant user facts
    ipcMain.handle('brain:recall', createIpcHandler('brain:recall', async (_event, query: string, limit?: number) => {
        const facts = await brainService.recallUserFacts(query, limit ?? 5);
        return { success: true, facts };
    }, { onError: handleError }));

    // Get facts by category
    ipcMain.handle('brain:getByCategory', createIpcHandler('brain:getByCategory', async (_event, category: UserFact['category']) => {
        const facts = await brainService.getUserFactsByCategory(category);
        return { success: true, facts };
    }, { onError: handleError }));

    // Get full brain context
    ipcMain.handle('brain:getContext', createIpcHandler('brain:getContext', async (_event, query?: string) => {
        const context = await brainService.getBrainContext(query);
        return { success: true, context };
    }, { onError: handleError }));

    // Extract facts from message
    ipcMain.handle('brain:extractFromMessage', createIpcHandler('brain:extractFromMessage', async (_event, message: string, userId?: string) => {
        const facts = await brainService.extractUserFactsFromMessage(message, userId);
        return { success: true, facts };
    }, { onError: handleError }));

    // Forget a fact
    ipcMain.handle('brain:forget', createIpcHandler('brain:forget', async (_event, factId: string) => {
        await brainService.forgetUserFact(factId);
        return { success: true };
    }, { onError: handleError }));

    // Update fact confidence
    ipcMain.handle('brain:updateConfidence', createIpcHandler('brain:updateConfidence', async (_event, factId: string, confidence: number) => {
        await brainService.updateFactConfidence(factId, confidence);
        return { success: true };
    }, { onError: handleError }));

    // Get brain stats
    ipcMain.handle('brain:getStats', createIpcHandler('brain:getStats', async () => {
        const stats = await brainService.getBrainStats();
        return { success: true, stats };
    }, { onError: handleError }));

    appLogger.info('BrainIPC', 'Brain IPC handlers registered');
}

