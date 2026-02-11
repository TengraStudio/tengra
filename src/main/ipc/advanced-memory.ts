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
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
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
    const handleListError = (error: Error) => ({ success: false, error: String(error), data: [] });
    const handleBasicError = (error: Error) => ({ success: false, error: String(error) });
    const handleBulkError = (error: Error) => ({ success: false, error: String(error), confirmed: 0 });
    const handleBulkRejectError = (error: Error) => ({ success: false, error: String(error), rejected: 0 });

    ipcMain.handle('advancedMemory:getPending', createIpcHandler('advancedMemory:getPending', async () => {
        const pending = advancedMemoryService.getPendingMemories();
        return { success: true, data: pending };
    }, { onError: handleListError }));

    ipcMain.handle('advancedMemory:confirm', createIpcHandler('advancedMemory:confirm', async (
        _event,
        id: string,
        adjustments?: {
            content?: string;
            category?: MemoryCategory;
            tags?: string[];
            importance?: number;
        }
    ) => {
        const memory = await advancedMemoryService.confirmPendingMemory(id, 'user', adjustments);
        return { success: true, data: memory };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:reject', createIpcHandler('advancedMemory:reject', async (_event, id: string, reason?: string) => {
        await advancedMemoryService.rejectPendingMemory(id, reason);
        return { success: true };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:confirmAll', createIpcHandler('advancedMemory:confirmAll', async () => {
        const pending = advancedMemoryService.getPendingMemories();
        let confirmed = 0;

        for (const p of pending) {
            if (!p.requiresUserValidation) {
                await advancedMemoryService.confirmPendingMemory(p.id, 'user');
                confirmed++;
            }
        }

        return { success: true, confirmed };
    }, { onError: handleBulkError }));

    ipcMain.handle('advancedMemory:rejectAll', createIpcHandler('advancedMemory:rejectAll', async () => {
        const pending = advancedMemoryService.getPendingMemories();

        for (const p of pending) {
            await advancedMemoryService.rejectPendingMemory(p.id, 'Bulk rejection');
        }

        return { success: true, rejected: pending.length };
    }, { onError: handleBulkRejectError }));
}


function registerExplicitHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:remember', createIpcHandler('advancedMemory:remember', async (
        _event,
        content: string,
        options?: {
            category?: MemoryCategory;
            tags?: string[];
            projectId?: string;
        }
    ) => {
        const memory = await advancedMemoryService.rememberExplicit(
            content,
            'user-explicit',
            options?.category ?? 'fact',
            options?.tags ?? [],
            options?.projectId
        );
        return { success: true, data: memory };
    }, { onError: (error) => ({ success: false, error: String(error) }) }));
}

function registerRecallHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:recall', createIpcHandler('advancedMemory:recall', async (_event, context: RecallContext) => {
        const result = await advancedMemoryService.recall(context);
        return {
            success: true,
            data: {
                memories: result.memories,
                totalMatches: result.totalMatches
            }
        };
    }, { onError: (error) => ({ success: false, error: String(error), data: { memories: [], totalMatches: 0 } }) }));

    ipcMain.handle('advancedMemory:search', createIpcHandler('advancedMemory:search', async (_event, query: string, limit?: number) => {
        const memories = await advancedMemoryService.recallRelevantFacts(query, limit ?? 10);
        return { success: true, data: memories };
    }, { onError: (error) => ({ success: false, error: String(error), data: [] }) }));
}

function registerMaintenanceHandlers(advancedMemoryService: AdvancedMemoryService): void {
    const handleBasicError = (error: Error) => ({ success: false, error: String(error) });

    ipcMain.handle('advancedMemory:getStats', createIpcHandler('advancedMemory:getStats', async () => {
        const stats = await advancedMemoryService.getStatistics();
        return { success: true, data: stats };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:runDecay', createIpcHandler('advancedMemory:runDecay', async () => {
        await advancedMemoryService.runDecayMaintenance();
        return { success: true };
    }, { onError: handleBasicError }));
}

function registerExtractionHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:extractFromMessage', createIpcHandler('advancedMemory:extractFromMessage', async (
        _event,
        content: string,
        sourceId: string,
        projectId?: string
    ) => {
        const pending = await advancedMemoryService.extractAndStageFromMessage(
            content,
            sourceId,
            projectId
        );
        return { success: true, data: pending };
    }, { onError: (error) => ({ success: false, error: String(error), data: [] }) }));
}


function registerManagementHandlers(advancedMemoryService: AdvancedMemoryService): void {
    const handleBasicError = (error: Error) => ({ success: false, error: String(error) });

    ipcMain.handle('advancedMemory:delete', createIpcHandler<{ success: boolean }, [string]>('advancedMemory:delete', async (_event, id) => {
        const success = await advancedMemoryService.deleteMemory(id);
        return { success };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:deleteMany', async (_, ids: string[]) => {
        try {
            const result = await advancedMemoryService.deleteMemories(ids);
            return { success: true, ...result };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error deleting memories: ${error}`);
            return { success: false, error: String(error), deleted: 0, failed: ids };
        }
    });

    ipcMain.handle('advancedMemory:edit', createIpcHandler('advancedMemory:edit', async (
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
        const memory = await advancedMemoryService.editMemory(id, updates);
        return { success: !!memory, data: memory };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:archive', createIpcHandler<{ success: boolean }, [string]>('advancedMemory:archive', async (_event, id) => {
        const success = await advancedMemoryService.archiveMemory(id);
        return { success };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:archiveMany', async (_, ids: string[]) => {
        try {
            const result = await advancedMemoryService.archiveMemories(ids);
            return { success: true, ...result };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error archiving memories: ${error}`);
            return { success: false, error: String(error), archived: 0, failed: ids };
        }
    });

    ipcMain.handle('advancedMemory:restore', createIpcHandler<{ success: boolean }, [string]>('advancedMemory:restore', async (_event, id) => {
        const success = await advancedMemoryService.restoreMemory(id);
        return { success };
    }, { onError: handleBasicError }));


    ipcMain.handle('advancedMemory:get', createIpcHandler('advancedMemory:get', async (_event, id: string) => {
        const memory = await advancedMemoryService.getMemory(id);
        return { success: !!memory, data: memory };
    }, { onError: handleBasicError }));
}
