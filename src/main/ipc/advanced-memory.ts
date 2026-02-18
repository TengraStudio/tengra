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
import { MemoryCategory, RecallContext, SharedMemorySyncRequest } from '@shared/types/advanced-memory';
import { ipcMain } from 'electron';




const LOG_TAG = 'AdvancedMemoryIPC';

export function registerAdvancedMemoryIpc(advancedMemoryService: AdvancedMemoryService): void {
    registerPendingHandlers(advancedMemoryService);
    registerExplicitHandlers(advancedMemoryService);
    registerRecallHandlers(advancedMemoryService);
    registerMaintenanceHandlers(advancedMemoryService);
    registerExtractionHandlers(advancedMemoryService);
    registerManagementHandlers(advancedMemoryService);
    registerVisualizationHandlers(advancedMemoryService);

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
        const memories = await advancedMemoryService.searchMemoriesHybrid(query, limit ?? 10);
        return { success: true, data: memories };
    }, { onError: (error) => ({ success: false, error: String(error), data: [] }) }));

    ipcMain.handle('advancedMemory:getSearchAnalytics', createIpcHandler('advancedMemory:getSearchAnalytics', async () => {
        return { success: true, data: advancedMemoryService.getSearchAnalytics() };
    }, {
        onError: (error) => ({
            success: false,
            error: String(error),
            data: {
                totalQueries: 0,
                semanticQueries: 0,
                textQueries: 0,
                hybridQueries: 0,
                averageResults: 0,
                topQueries: []
            }
        })
    }));

    ipcMain.handle('advancedMemory:getSearchHistory', createIpcHandler('advancedMemory:getSearchHistory', async (_event, limit?: number) => {
        return { success: true, data: advancedMemoryService.getSearchHistory(limit ?? 25) };
    }, { onError: (error) => ({ success: false, error: String(error), data: [] }) }));

    ipcMain.handle('advancedMemory:getSearchSuggestions', createIpcHandler('advancedMemory:getSearchSuggestions', async (
        _event,
        prefix?: string,
        limit?: number
    ) => {
        return { success: true, data: advancedMemoryService.getSearchSuggestions(prefix, limit ?? 8) };
    }, { onError: (error) => ({ success: false, error: String(error), data: [] }) }));

    ipcMain.handle('advancedMemory:export', createIpcHandler('advancedMemory:export', async (
        _event,
        query?: string,
        limit?: number
    ) => {
        const exported = await advancedMemoryService.exportMemories(query, limit ?? 200);
        return { success: true, data: exported };
    }, { onError: (error) => ({ success: false, error: String(error) }) }));

    ipcMain.handle('advancedMemory:import', createIpcHandler('advancedMemory:import', async (
        _event,
        payload: {
            memories?: Array<Partial<import('@shared/types/advanced-memory').AdvancedSemanticFragment>>;
            pendingMemories?: Array<Partial<import('@shared/types/advanced-memory').PendingMemory>>;
            replaceExisting?: boolean;
        }
    ) => {
        const result = await advancedMemoryService.importMemories(payload ?? {});
        return { success: true, data: result };
    }, { onError: (error) => ({ success: false, error: String(error) }) }));
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

    ipcMain.handle('advancedMemory:recategorize', createIpcHandler('advancedMemory:recategorize', async (_event, ids?: string[]) => {
        await advancedMemoryService.recategorizeMemories(ids);
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

    ipcMain.handle('advancedMemory:shareWithProject', createIpcHandler('advancedMemory:shareWithProject', async (_event, memoryId: string, targetProjectId: string) => {
        const shared = await advancedMemoryService.shareMemoryWithProject(memoryId, targetProjectId);
        return { success: !!shared, data: shared };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:createSharedNamespace', createIpcHandler('advancedMemory:createSharedNamespace', async (
        _event,
        payload: { id: string; name: string; projectIds: string[]; accessControl?: Record<string, string[]> }
    ) => {
        const namespace = advancedMemoryService.createSharedNamespace(payload);
        return { success: true, data: namespace };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:syncSharedNamespace', createIpcHandler('advancedMemory:syncSharedNamespace', async (
        _event,
        request: SharedMemorySyncRequest
    ) => {
        const result = await advancedMemoryService.syncSharedNamespace(request);
        return { success: true, data: result };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:getSharedNamespaceAnalytics', createIpcHandler('advancedMemory:getSharedNamespaceAnalytics', async (
        _event,
        namespaceId: string
    ) => {
        const analytics = await advancedMemoryService.getSharedNamespaceAnalytics(namespaceId);
        return { success: true, data: analytics };
    }, { onError: handleBasicError }));

    ipcMain.handle('advancedMemory:searchAcrossProjects', createIpcHandler('advancedMemory:searchAcrossProjects', async (
        _event,
        payload: { namespaceId: string; query: string; projectId: string; limit?: number }
    ) => {
        const result = await advancedMemoryService.searchAcrossProjects(payload);
        return { success: true, data: result };
    }, { onError: (error) => ({ success: false, error: String(error), data: [] }) }));

    ipcMain.handle('advancedMemory:getHistory', createIpcHandler('advancedMemory:getHistory', async (_event, id: string) => {
        const history = await advancedMemoryService.getMemoryHistory(id);
        return { success: true, data: history };
    }, { onError: (error) => ({ success: false, error: String(error), data: [] }) }));

    ipcMain.handle('advancedMemory:rollback', createIpcHandler('advancedMemory:rollback', async (_event, id: string, versionIndex: number) => {
        const memory = await advancedMemoryService.rollbackMemory(id, versionIndex);
        return { success: !!memory, data: memory };
    }, { onError: handleBasicError }));
}

function registerVisualizationHandlers(advancedMemoryService: AdvancedMemoryService): void {
    const handleListError = (error: Error) => ({ success: false, error: String(error), data: [] });

    ipcMain.handle('advancedMemory:getAllEntityKnowledge', createIpcHandler('advancedMemory:getAllEntityKnowledge', async () => {
        const data = await advancedMemoryService.getAllEntityFacts();
        return { success: true, data };
    }, { onError: handleListError }));

    ipcMain.handle('advancedMemory:getAllEpisodes', createIpcHandler('advancedMemory:getAllEpisodes', async () => {
        const data = await advancedMemoryService.getAllEpisodes();
        return { success: true, data };
    }, { onError: handleListError }));

    ipcMain.handle('advancedMemory:getAllAdvancedMemories', createIpcHandler('advancedMemory:getAllAdvancedMemories', async () => {
        const data = await advancedMemoryService.getAllAdvancedMemories();
        return { success: true, data };
    }, { onError: handleListError }));
}
