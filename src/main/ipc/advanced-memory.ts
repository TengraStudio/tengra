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
    // =========================================================================
    // PENDING MEMORIES (Staging Buffer)
    // =========================================================================

    /**
     * Get all pending memories awaiting validation
     */
    ipcMain.handle('advancedMemory:getPending', async () => {
        try {
            const pending = advancedMemoryService.getPendingMemories();
            return { success: true, data: pending };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error getting pending memories: ${error}`);
            return { success: false, error: String(error), data: [] };
        }
    });

    /**
     * Confirm a pending memory (user validation)
     */
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

    /**
     * Reject a pending memory
     */
    ipcMain.handle('advancedMemory:reject', async (_event, id: string, reason?: string) => {
        try {
            await advancedMemoryService.rejectPendingMemory(id, reason);
            return { success: true };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error rejecting memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    /**
     * Confirm all pending memories that meet auto-confirm threshold
     */
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

    /**
     * Reject all pending memories
     */
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

    // =========================================================================
    // EXPLICIT MEMORY
    // =========================================================================

    /**
     * Explicitly remember a fact (user said "remember this")
     */
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

    // =========================================================================
    // RECALL
    // =========================================================================

    /**
     * Recall memories with full context awareness
     */
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

    /**
     * Simple recall for backwards compatibility
     */
    ipcMain.handle('advancedMemory:search', async (_event, query: string, limit?: number) => {
        try {
            const memories = await advancedMemoryService.recallRelevantFacts(query, limit ?? 10);
            return { success: true, data: memories };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error searching: ${error}`);
            return { success: false, error: String(error), data: [] };
        }
    });

    // =========================================================================
    // STATISTICS & MAINTENANCE
    // =========================================================================

    /**
     * Get memory statistics
     */
    ipcMain.handle('advancedMemory:getStats', async () => {
        try {
            const stats = await advancedMemoryService.getStatistics();
            return { success: true, data: stats };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error getting stats: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    /**
     * Run decay maintenance manually
     */
    ipcMain.handle('advancedMemory:runDecay', async () => {
        try {
            await advancedMemoryService.runDecayMaintenance();
            return { success: true };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error running decay: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    // =========================================================================
    // EXTRACTION
    // =========================================================================

    /**
     * Extract facts from a message (for testing/manual extraction)
     */
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

    // =========================================================================
    // DELETE & EDIT
    // =========================================================================

    /**
     * Delete a single memory
     */
    ipcMain.handle('advancedMemory:delete', async (_event, id: string) => {
        try {
            const success = await advancedMemoryService.deleteMemory(id);
            return { success };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error deleting memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    /**
     * Delete multiple memories
     */
    ipcMain.handle('advancedMemory:deleteMany', async (_event, ids: string[]) => {
        try {
            const result = await advancedMemoryService.deleteMemories(ids);
            return { success: true, ...result };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error deleting memories: ${error}`);
            return { success: false, error: String(error), deleted: 0, failed: ids };
        }
    });

    /**
     * Edit a memory
     */
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

    /**
     * Archive a memory (soft delete)
     */
    ipcMain.handle('advancedMemory:archive', async (_event, id: string) => {
        try {
            const success = await advancedMemoryService.archiveMemory(id);
            return { success };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error archiving memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    /**
     * Archive multiple memories
     */
    ipcMain.handle('advancedMemory:archiveMany', async (_event, ids: string[]) => {
        try {
            const result = await advancedMemoryService.archiveMemories(ids);
            return { success: true, ...result };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error archiving memories: ${error}`);
            return { success: false, error: String(error), archived: 0, failed: ids };
        }
    });

    /**
     * Restore an archived memory
     */
    ipcMain.handle('advancedMemory:restore', async (_event, id: string) => {
        try {
            const success = await advancedMemoryService.restoreMemory(id);
            return { success };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error restoring memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    /**
     * Get a single memory by ID
     */
    ipcMain.handle('advancedMemory:get', async (_event, id: string) => {
        try {
            const memory = await advancedMemoryService.getMemory(id);
            return { success: !!memory, data: memory };
        } catch (error) {
            appLogger.error(LOG_TAG, `Error getting memory: ${error}`);
            return { success: false, error: String(error) };
        }
    });

    appLogger.info(LOG_TAG, 'Advanced memory IPC handlers registered');
}
