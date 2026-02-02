/**
 * IPC Handlers for the Advanced Memory System
 *
 * Provides renderer access to:
 * - Pending memories (staging buffer)
 * - Memory validation (confirm/reject)
 * - Advanced recall with context
 * - Memory statistics
 * - Decay maintenance
 */

import { appLogger } from '@main/logging/logger';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { MemoryCategory, RecallContext } from '@shared/types/advanced-memory';
import { ipcMain } from 'electron';

const LOG_TAG = 'AdvancedMemoryIPC';

export function registerAdvancedMemoryIpc(advancedMemoryService: AdvancedMemoryService): void {
    registerPendingHandlers(advancedMemoryService);
    registerExplicitHandlers(advancedMemoryService);
    registerRecallHandlers(advancedMemoryService);
    registerMaintenanceHandlers(advancedMemoryService);
    registerExtractionHandlers(advancedMemoryService);
    registerManagementHandlers(advancedMemoryService);

    appLogger.info(LOG_TAG, 'Advanced memory IPC handlers registered');
}

function registerPendingHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:getPending', async () => {
        try {
            const pending = advancedMemoryService.getPendingMemories();
            return { success: true, data: pending };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error getting pending memories: ${error}`);
            return { success: false, error: String(error), data: [] };
        }
    });

    ipcMain.handle('advancedMemory:confirm', async (
        _event,
        id: string,
        adjustments?: {
            content?: string;
            category?: MemoryCategory;
            tags?: string[];
            importance?: number;
        }
    ) => {
        try {
            const memory = await advancedMemoryService.confirmPendingMemory(id, 'user', adjustments);
            return { success: true, data: memory };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error confirming memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('advancedMemory:reject', async (_event, id: string, reason?: string) => {
        try {
            await advancedMemoryService.rejectPendingMemory(id, reason);
            return { success: true };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error rejecting memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('advancedMemory:confirmAll', async () => {
        try {
            const pending = advancedMemoryService.getPendingMemories();
            let confirmed = 0;

            for (const p of pending) {
                if (!p.requiresUserValidation) {
                    await advancedMemoryService.confirmPendingMemory(p.id, 'user');
                    confirmed++;
                }
            }

            return { success: true, confirmed };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error confirming all: ${error}`);
            return { success: false, error: String(error), confirmed: 0 };
        }
    });

    ipcMain.handle('advancedMemory:rejectAll', async () => {
        try {
            const pending = advancedMemoryService.getPendingMemories();

            for (const p of pending) {
                await advancedMemoryService.rejectPendingMemory(p.id, 'Bulk rejection');
            }

            return { success: true, rejected: pending.length };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error rejecting all: ${error}`);
            return { success: false, error: String(error), rejected: 0 };
        }
    });
}

function registerExplicitHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:remember', async (
        _event,
        content: string,
        options?: {
            category?: MemoryCategory;
            tags?: string[];
            projectId?: string;
        }
    ) => {
        try {
            const memory = await advancedMemoryService.rememberExplicit(
                content,
                'user-explicit',
                options?.category ?? 'fact',
                options?.tags ?? [],
                options?.projectId
            );
            return { success: true, data: memory };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error remembering: ${error}`);
            return { success: false, error: String(error) };
        }
    });
}

function registerRecallHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:recall', async (_event, context: RecallContext) => {
        try {
            const result = await advancedMemoryService.recall(context);
            return {
                success: true,
                data: {
                    memories: result.memories,
                    totalMatches: result.totalMatches
                }
            };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error recalling: ${error}`);
            return { success: false, error: String(error), data: { memories: [], totalMatches: 0 } };
        }
    });

    ipcMain.handle('advancedMemory:search', async (_event, query: string, limit?: number) => {
        try {
            const memories = await advancedMemoryService.recallRelevantFacts(query, limit ?? 10);
            return { success: true, data: memories };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error searching: ${error}`);
            return { success: false, error: String(error), data: [] };
        }
    });
}

function registerMaintenanceHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:getStats', async () => {
        try {
            const stats = await advancedMemoryService.getStatistics();
            return { success: true, data: stats };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error getting stats: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('advancedMemory:runDecay', async () => {
        try {
            await advancedMemoryService.runDecayMaintenance();
            return { success: true };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error running decay: ${error}`);
            return { success: false, error: String(error) };
        }
    });
}

function registerExtractionHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:extractFromMessage', async (
        _event,
        content: string,
        sourceId: string,
        projectId?: string
    ) => {
        try {
            const pending = await advancedMemoryService.extractAndStageFromMessage(
                content,
                sourceId,
                projectId
            );
            return { success: true, data: pending };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error extracting: ${error}`);
            return { success: false, error: String(error), data: [] };
        }
    });
}

function registerManagementHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:delete', async (_event, id: string) => {
        try {
            const success = await advancedMemoryService.deleteMemory(id);
            return { success };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error deleting memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('advancedMemory:deleteMany', async (_event, ids: string[]) => {
        try {
            const result = await advancedMemoryService.deleteMemories(ids);
            return { success: true, ...result };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error deleting memories: ${error}`);
            return { success: false, error: String(error), deleted: 0, failed: ids };
        }
    });

    ipcMain.handle('advancedMemory:edit', async (
        _event,
        id: string,
        updates: {
            content?: string;
            category?: MemoryCategory;
            tags?: string[];
            importance?: number;
            projectId?: string | null;
        }
    ) => {
        try {
            const memory = await advancedMemoryService.editMemory(id, updates);
            return { success: !!memory, data: memory };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error editing memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('advancedMemory:archive', async (_event, id: string) => {
        try {
            const success = await advancedMemoryService.archiveMemory(id);
            return { success };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error archiving memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('advancedMemory:archiveMany', async (_event, ids: string[]) => {
        try {
            const result = await advancedMemoryService.archiveMemories(ids);
            return { success: true, ...result };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error archiving memories: ${error}`);
            return { success: false, error: String(error), archived: 0, failed: ids };
        }
    });

    ipcMain.handle('advancedMemory:restore', async (_event, id: string) => {
        try {
            const success = await advancedMemoryService.restoreMemory(id);
            return { success };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error restoring memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('advancedMemory:get', async (_event, id: string) => {
        try {
            const memory = await advancedMemoryService.getMemory(id);
            return { success: !!memory, data: memory };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error getting memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });
}
