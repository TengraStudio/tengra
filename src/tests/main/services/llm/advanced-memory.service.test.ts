/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DatabaseService } from '@main/services/data/database.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { SettingsService } from '@main/services/system/settings.service';
import { AdvancedSemanticFragment, PendingMemory } from '@shared/types/advanced-memory';
import { describe, expect, it, vi } from 'vitest';

function createMemory(overrides: Partial<AdvancedSemanticFragment> = {}): AdvancedSemanticFragment {
    const now = Date.now();
    return {
        id: 'memory-id',
        content: 'Default memory',
        embedding: [0.1, 0.2, 0.3],
        source: 'system',
        sourceId: 'source-id',
        category: 'fact',
        tags: [],
        confidence: 0.8,
        importance: 0.5,
        initialImportance: 0.5,
        status: 'confirmed',
        accessCount: 0,
        lastAccessedAt: now,
        relatedMemoryIds: [],
        contradictsIds: [],
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

function createPendingMemory(overrides: Partial<PendingMemory> = {}): PendingMemory {
    const now = Date.now();
    return {
        id: 'pending-id',
        content: 'Pending memory',
        embedding: [],
        source: 'system',
        sourceId: 'source-id',
        sourceContext: 'Pending memory',
        extractedAt: now,
        suggestedCategory: 'fact',
        suggestedTags: [],
        extractionConfidence: 0.7,
        relevanceScore: 0.6,
        noveltyScore: 0.6,
        requiresUserValidation: false,
        potentialContradictions: [],
        similarMemories: [],
        ...overrides
    };
}

function createService() {
    const mocks = {
        storeAdvancedMemory: vi.fn(async (_memory: AdvancedSemanticFragment) => undefined),
        updateAdvancedMemory: vi.fn(async (_memory: AdvancedSemanticFragment) => undefined),
        savePendingMemory: vi.fn(async (_pending: PendingMemory) => undefined),
        getAllAdvancedMemories: vi.fn(async (): Promise<AdvancedSemanticFragment[]> => []),
        searchAdvancedMemories: vi.fn(async (): Promise<AdvancedSemanticFragment[]> => []),
        getAdvancedMemoryById: vi.fn(async (): Promise<AdvancedSemanticFragment | null> => null),
        getAllPendingMemories: vi.fn(async (): Promise<PendingMemory[]> => []),
        deleteAdvancedMemory: vi.fn(async (_id: string) => undefined),
        deletePendingMemory: vi.fn(async (_id: string) => undefined),
        generateEmbedding: vi.fn(async (_text: string) => [0.1, 0.2, 0.3]),
        chat: vi.fn(async () => ({ content: 'fact', role: 'assistant' }))
    };

    const db: Pick<
        DatabaseService,
        | 'storeAdvancedMemory'
        | 'updateAdvancedMemory'
        | 'savePendingMemory'
        | 'getAllAdvancedMemories'
        | 'searchAdvancedMemories'
        | 'getAdvancedMemoryById'
        | 'getAllPendingMemories'
        | 'deleteAdvancedMemory'
        | 'deletePendingMemory'
    > = {
        storeAdvancedMemory: mocks.storeAdvancedMemory,
        updateAdvancedMemory: mocks.updateAdvancedMemory,
        savePendingMemory: mocks.savePendingMemory,
        getAllAdvancedMemories: mocks.getAllAdvancedMemories,
        searchAdvancedMemories: mocks.searchAdvancedMemories,
        getAdvancedMemoryById: mocks.getAdvancedMemoryById,
        getAllPendingMemories: mocks.getAllPendingMemories,
        deleteAdvancedMemory: mocks.deleteAdvancedMemory,
        deletePendingMemory: mocks.deletePendingMemory
    };

    const embedding: Pick<EmbeddingService, 'generateEmbedding'> = {
        generateEmbedding: mocks.generateEmbedding
    };

    const llm: Pick<LLMService, 'chat'> = {
        chat: mocks.chat
    };

    const settings: Pick<SettingsService, 'getSettings'> = {
        getSettings: vi.fn(() => ({
            ai: {
                preferredMemoryModels: ['llama3.2:1b']
            }
        }) as SettingsService['getSettings'] extends () => infer T ? T : never)
    };

    const service = new AdvancedMemoryService(
        {
            db: db as DatabaseService,
            embedding: embedding as EmbeddingService,
            llmService: llm as LLMService,
            settings: settings as SettingsService
        }
    );

    return { service, mocks };
}

describe('AdvancedMemoryService import/export', () => {
    it('imports valid memories and skips invalid records', async () => {
        const { service, mocks } = createService();

        const result = await service.importMemories({
            memories: [
                { content: '   ' },
                { id: 'm1', content: 'Keep this memory', embedding: [] }
            ]
        });

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.errors.length).toBe(1);
        expect(mocks.storeAdvancedMemory).toHaveBeenCalledTimes(1);
        expect(mocks.generateEmbedding).toHaveBeenCalledTimes(1);
    });

    it('imports pending memories', async () => {
        const { service, mocks } = createService();

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
        expect(mocks.savePendingMemory).toHaveBeenCalledTimes(1);
    });

    it('exports memories with limit', async () => {
        const { service, mocks } = createService();
        mocks.getAllAdvancedMemories.mockResolvedValue([
            createMemory({ id: 'a', content: 'A' }),
            createMemory({ id: 'b', content: 'B' }),
            createMemory({ id: 'c', content: 'C' })
        ]);

        const exported = await service.exportMemories(undefined, 2);

        expect(exported.count).toBe(2);
        expect(exported.memories).toHaveLength(2);
    });

    it('clamps export limit to a minimum of one entry', async () => {
        const { service, mocks } = createService();
        mocks.getAllAdvancedMemories.mockResolvedValue([
            createMemory({ id: 'a' }),
            createMemory({ id: 'b' }),
            createMemory({ id: 'c' })
        ]);

        const exported = await service.exportMemories(undefined, 0);

        expect(exported.count).toBe(1);
        expect(exported.memories).toHaveLength(1);
    });

    it('clears existing persisted records when replaceExisting is enabled', async () => {
        const { service, mocks } = createService();
        mocks.getAllAdvancedMemories.mockResolvedValue([createMemory({ id: 'old-memory' })]);
        mocks.getAllPendingMemories.mockResolvedValue([createPendingMemory({ id: 'old-pending' })]);

        const result = await service.importMemories({
            replaceExisting: true,
            memories: [{ id: 'new-memory', content: 'Fresh memory' }]
        });

        expect(result.imported).toBe(1);
        expect(mocks.deleteAdvancedMemory).toHaveBeenCalledWith('old-memory');
        expect(mocks.deletePendingMemory).toHaveBeenCalledWith('old-pending');
    });

    it('continues import when one memory fails embedding generation', async () => {
        const { service, mocks } = createService();
        mocks.generateEmbedding
            .mockRejectedValueOnce(new Error('embedding unavailable'))
            .mockRejectedValueOnce(new Error('embedding unavailable'));

        const result = await service.importMemories({
            memories: [
                { id: 'broken-memory', content: 'Needs embedding' },
                { id: 'healthy-memory', content: 'Already embedded', embedding: [0.9, 0.8] }
            ]
        });

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('broken-memory');
        expect(mocks.storeAdvancedMemory).toHaveBeenCalledTimes(1);
        const storedMemory = mocks.storeAdvancedMemory.mock.calls[0]?.[0];
        expect(storedMemory?.id).toBe('healthy-memory');
    });

    it('tracks history when editing a memory', async () => {
        const { service, mocks } = createService();
        const initialMemory = createMemory({
            id: 'm1',
            content: 'Initial content',
            category: 'fact',
            tags: ['tag1'],
            importance: 0.5,
            updatedAt: Date.now(),
            history: []
        });
        mocks.getAdvancedMemoryById.mockResolvedValue({ ...initialMemory });

        await service.editMemory('m1', { content: 'New content', editReason: 'Correction' });

        expect(mocks.updateAdvancedMemory).toHaveBeenCalled();
        const updated = mocks.updateAdvancedMemory.mock.calls[0]?.[0];
        expect(updated?.content).toBe('New content');
        expect(updated?.history).toHaveLength(1);
        expect(updated?.history?.[0].content).toBe('Initial content');
        expect(updated?.history?.[0].reason).toBe('Correction');
    });

    it('returns null for edit when memory does not exist', async () => {
        const { service, mocks } = createService();
        mocks.getAdvancedMemoryById.mockResolvedValue(null);

        const edited = await service.editMemory('missing-memory', { content: 'No-op' });

        expect(edited).toBeNull();
        expect(mocks.updateAdvancedMemory).not.toHaveBeenCalled();
    });

    it('rolls back to a previous version', async () => {
        const { service, mocks } = createService();
        const memoryWithHistory = createMemory({
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
        });
        mocks.getAdvancedMemoryById.mockResolvedValue({ ...memoryWithHistory });

        await service.rollbackMemory('m1', 0);

        expect(mocks.updateAdvancedMemory).toHaveBeenCalled();
        const rolledBack = mocks.updateAdvancedMemory.mock.calls[0]?.[0];
        expect(rolledBack?.content).toBe('Old content');
        expect(rolledBack?.history).toHaveLength(2); // Added current state as new history item
        expect(rolledBack?.history?.[1].content).toBe('Current content');
    });

    it('returns null when rollback target version does not exist', async () => {
        const { service, mocks } = createService();
        mocks.getAdvancedMemoryById.mockResolvedValue(createMemory({ id: 'm1', history: [] }));

        const rolledBack = await service.rollbackMemory('m1', 2);

        expect(rolledBack).toBeNull();
        expect(mocks.updateAdvancedMemory).not.toHaveBeenCalled();
    });

    it('shares memory with another workspace', async () => {
        const { service, mocks } = createService();
        const originalMemory = createMemory({
            id: 'm1',
            content: 'Shared knowledge',
            workspaceId: 'p1',
            embedding: [0.1],
            relatedMemoryIds: []
        });
        mocks.getAdvancedMemoryById.mockResolvedValue({ ...originalMemory });

        const shared = await service.shareMemoryWithWorkspace('m1', 'p2');

        expect(shared).toBeDefined();
        expect(shared?.workspaceId).toBe('p2');
        expect(shared?.relatedMemoryIds).toContain('m1');
        expect(mocks.storeAdvancedMemory).toHaveBeenCalled();
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

    it('returns safe empty recall result on validation failure', async () => {
        const { service } = createService();

        const result = await service.recall({ query: 'valid query', limit: 0 });
        const health = service.getHealthStatus();

        expect(result.memories).toEqual([]);
        expect(result.totalMatches).toBe(0);
        expect(health.metrics.validationFailures).toBe(1);
        expect(health.uiState).toBe('failure');
    });

    it('retries embedding generation during import and succeeds on transient failures', async () => {
        const { service, mocks } = createService();
        mocks.generateEmbedding
            .mockRejectedValueOnce(new Error('temporary outage'))
            .mockResolvedValueOnce([0.3, 0.2, 0.1]);

        const result = await service.importMemories({
            memories: [{ id: 'retry-memory', content: 'needs retry' }]
        });
        const health = service.getHealthStatus();

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);
        expect(health.metrics.retries).toBe(1);
        expect(health.metrics.failedRequests).toBe(0);
    });
});

