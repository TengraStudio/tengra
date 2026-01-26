import { MemoryService } from '@main/services/llm/memory.service';
import { ipcMain } from 'electron';


export function registerMemoryIpc(memoryService: MemoryService) {

    // Get all memories for UI display
    ipcMain.handle('memory:getAll', async () => {
        try {
            return await memoryService.getAllMemories();
        } catch (e) {
            console.error('[Memory IPC] Error getting memories:', e);
            return { facts: [], episodes: [], entities: [] };
        }
    });

    // Delete a semantic fragment
    ipcMain.handle('memory:deleteFact', async (_event, factId: string) => {
        try {
            const success = await memoryService.forgetFact(factId);
            return { success };
        } catch (e) {
            console.error('[Memory IPC] Error deleting fact:', e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    });

    // Delete an entity fact
    ipcMain.handle('memory:deleteEntity', async (_event, entityId: string) => {
        try {
            const success = await memoryService.removeEntityFact(entityId);
            return { success };
        } catch (e) {
            console.error('[Memory IPC] Error deleting entity:', e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    });

    // Add a manual fact
    ipcMain.handle('memory:addFact', async (_event, content: string, tags: string[] = []) => {
        try {
            const fragment = await memoryService.rememberFact(content, 'manual', 'user-added', tags);
            return { success: true, id: fragment.id };
        } catch (e) {
            console.error('[Memory IPC] Error adding fact:', e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    });

    // Set entity fact
    ipcMain.handle('memory:setEntityFact', async (_event, entityType: string, entityName: string, key: string, value: string) => {
        try {
            const knowledge = await memoryService.setEntityFact(entityType, entityName, key, value);
            return { success: true, id: knowledge.id };
        } catch (e) {
            console.error('[Memory IPC] Error setting entity fact:', e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    });

    // Search memories
    ipcMain.handle('memory:search', async (_event, query: string) => {
        try {
            const facts = await memoryService.recallRelevantFacts(query, 10);
            const episodes = await memoryService.recallEpisodes(query, 5);
            return { facts, episodes };
        } catch (e) {
            console.error('[Memory IPC] Error searching memories:', e);
            return { facts: [], episodes: [] };
        }
    });
}
