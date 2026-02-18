import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { describe, expect, it, vi } from 'vitest';

interface MemoryStub {
    id: string;
    content: string;
}

function createService() {
    const db = {
        storeAdvancedMemory: vi.fn(async () => undefined),
        updateAdvancedMemory: vi.fn(async (_memory: any) => undefined),
        savePendingMemory: vi.fn(async () => undefined),
        getAllAdvancedMemories: vi.fn<() => Promise<any[]>>(async () => []),
        searchAdvancedMemories: vi.fn(async () => []),
        getAdvancedMemoryById: vi.fn<() => Promise<any>>(async () => null),
        getAllPendingMemories: vi.fn(async () => []),
        deleteAdvancedMemory: vi.fn(async () => undefined),
        deletePendingMemory: vi.fn(async () => undefined)
    };
    const embedding = {
        generateEmbedding: vi.fn(async () => [0.1, 0.2, 0.3])
    };
    const llm = {
        chat: vi.fn(async () => ({ content: 'fact' }))
    };

    const service = new AdvancedMemoryService(
        db as any,
        embedding as any,
        llm as any
    );

    return { service, db, embedding, llm };
}

describe('AdvancedMemoryService import/export', () => {
    it('imports valid memories and skips invalid records', async () => {
        const { service, db, embedding } = createService();

        const result = await service.importMemories({
            memories: [
                { content: '   ' },
                { id: 'm1', content: 'Keep this memory', embedding: [] }
            ]
        });

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.errors.length).toBe(1);
        expect(db.storeAdvancedMemory).toHaveBeenCalledTimes(1);
        expect(embedding.generateEmbedding).toHaveBeenCalledTimes(1);
    });

    it('imports pending memories', async () => {
        const { service, db } = createService();

        const result = await service.importMemories({
            pendingMemories: [
                {
                    id: 'p1',
                    content: 'Pending fact',
                    sourceContext: 'Pending fact',
                    suggestedCategory: 'fact'
                }
            ]
        });

        expect(result.pendingImported).toBe(1);
        expect(result.skipped).toBe(0);
        expect(db.savePendingMemory).toHaveBeenCalledTimes(1);
    });

    it('exports memories with limit', async () => {
        const { service, db } = createService();
        db.getAllAdvancedMemories.mockResolvedValue([
            { id: 'a', content: 'A' },
            { id: 'b', content: 'B' },
            { id: 'c', content: 'C' }
        ] as MemoryStub[]);

        const exported = await service.exportMemories(undefined, 2);

        expect(exported.count).toBe(2);
        expect(exported.memories).toHaveLength(2);
    });

    it('tracks history when editing a memory', async () => {
        const { service, db } = createService();
        const initialMemory = {
            id: 'm1',
            content: 'Initial content',
            category: 'fact',
            tags: ['tag1'],
            importance: 0.5,
            updatedAt: Date.now(),
            history: []
        };
        db.getAdvancedMemoryById.mockResolvedValue({ ...initialMemory });

        await service.editMemory('m1', { content: 'New content', editReason: 'Correction' });

        expect(db.updateAdvancedMemory).toHaveBeenCalled();
        const updated = (db.updateAdvancedMemory as any).mock.calls[0][0];
        expect(updated.content).toBe('New content');
        expect(updated.history).toHaveLength(1);
        expect(updated.history[0].content).toBe('Initial content');
        expect(updated.history[0].reason).toBe('Correction');
    });

    it('rolls back to a previous version', async () => {
        const { service, db } = createService();
        const memoryWithHistory = {
            id: 'm1',
            content: 'Current content',
            category: 'fact',
            tags: [],
            importance: 0.8,
            updatedAt: Date.now(),
            history: [
                {
                    versionIndex: 0,
                    content: 'Old content',
                    category: 'fact',
                    tags: [],
                    importance: 0.5,
                    timestamp: Date.now() - 1000
                }
            ]
        };
        db.getAdvancedMemoryById.mockResolvedValue({ ...memoryWithHistory });

        await service.rollbackMemory('m1', 0);

        expect(db.updateAdvancedMemory).toHaveBeenCalled();
        const rolledBack = (db.updateAdvancedMemory as any).mock.calls[0][0];
        expect(rolledBack.content).toBe('Old content');
        expect(rolledBack.history).toHaveLength(2); // Added current state as new history item
        expect(rolledBack.history[1].content).toBe('Current content');
    });

    it('shares memory with another project', async () => {
        const { service, db } = createService();
        const originalMemory = {
            id: 'm1',
            content: 'Shared knowledge',
            projectId: 'p1',
            embedding: [0.1],
            relatedMemoryIds: []
        };
        db.getAdvancedMemoryById = vi.fn(async () => ({ ...originalMemory }));

        const shared = await service.shareMemoryWithProject('m1', 'p2');

        expect(shared).toBeDefined();
        expect(shared?.projectId).toBe('p2');
        expect(shared?.relatedMemoryIds).toContain('m1');
        expect(db.storeAdvancedMemory).toHaveBeenCalled();
    });

    it('tracks search history and suggestions from hybrid queries', async () => {
        const { service } = createService();

        await service.searchMemoriesHybrid('alpha query', 5);
        await service.searchMemoriesHybrid('alpha query', 5);
        await service.searchMemoriesHybrid('beta query', 5);

        const history = service.getSearchHistory(2);
        expect(history).toHaveLength(2);
        expect(history[0].query).toBe('beta query');
        expect(history[1].query).toBe('beta query');

        const suggestions = service.getSearchSuggestions('al', 5);
        expect(suggestions).toContain('alpha query');
        expect(suggestions).not.toContain('beta query');
    });
});
