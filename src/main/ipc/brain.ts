/**
 * IPC handlers for Brain Service
 * User-focused memory system
 */

import { appLogger } from '@main/logging/logger';
import { BrainService, UserFact } from '@main/services/llm/brain.service';
import { ipcMain } from 'electron';

export function registerBrainIpcHandlers(brainService: BrainService) {
    // Learn a fact about the user
    ipcMain.handle('brain:learn', async (_event, category: UserFact['category'], content: string, confidence?: number) => {
        try {
            const fact = await brainService.learnUserFact(
                category,
                content,
                confidence ?? 0.8
            );
            return { success: true, fact };
        } catch (error) {
            appLogger.error('BrainIPC', `Failed to learn fact: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    // Recall relevant user facts
    ipcMain.handle('brain:recall', async (_event, query: string, limit?: number) => {
        try {
            const facts = await brainService.recallUserFacts(query, limit ?? 5);
            return { success: true, facts };
        } catch (error) {
            appLogger.error('BrainIPC', `Failed to recall facts: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    // Get facts by category
    ipcMain.handle('brain:getByCategory', async (_event, category: UserFact['category']) => {
        try {
            const facts = await brainService.getUserFactsByCategory(category);
            return { success: true, facts };
        } catch (error) {
            appLogger.error('BrainIPC', `Failed to get facts by category: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    // Get full brain context
    ipcMain.handle('brain:getContext', async (_event, query?: string) => {
        try {
            const context = await brainService.getBrainContext(query);
            return { success: true, context };
        } catch (error) {
            appLogger.error('BrainIPC', `Failed to get brain context: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    // Extract facts from message
    ipcMain.handle('brain:extractFromMessage', async (_event, message: string, userId?: string) => {
        try {
            const facts = await brainService.extractUserFactsFromMessage(message, userId);
            return { success: true, facts };
        } catch (error) {
            appLogger.error('BrainIPC', `Failed to extract facts: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    // Forget a fact
    ipcMain.handle('brain:forget', async (_event, factId: string) => {
        try {
            await brainService.forgetUserFact(factId);
            return { success: true };
        } catch (error) {
            appLogger.error('BrainIPC', `Failed to forget fact: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    // Update fact confidence
    ipcMain.handle('brain:updateConfidence', async (_event, factId: string, confidence: number) => {
        try {
            await brainService.updateFactConfidence(factId, confidence);
            return { success: true };
        } catch (error) {
            appLogger.error('BrainIPC', `Failed to update confidence: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    // Get brain stats
    ipcMain.handle('brain:getStats', async () => {
        try {
            const stats = await brainService.getBrainStats();
            return { success: true, stats };
        } catch (error) {
            appLogger.error('BrainIPC', `Failed to get stats: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    appLogger.info('BrainIPC', 'Brain IPC handlers registered');
}
