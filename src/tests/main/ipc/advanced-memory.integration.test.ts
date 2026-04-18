/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerAdvancedMemoryIpc } from '@main/ipc/advanced-memory';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: TestValue[]) => Promise<TestValue>) => {
            handlers.set(channel, handler);
        })
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));


describe('Advanced Memory IPC Handlers', () => {
    const pendingId = '11111111-1111-4111-8111-111111111111';
    const buildService = () => ({
        getPendingMemories: vi.fn(() => []),
        confirmPendingMemory: vi.fn(async () => ({
            id: pendingId,
            content: 'Remember this preference',
            embedding: [0.1, 0.2],
            source: 'user_explicit',
            sourceId: 'chat-1',
            category: 'preference',
            tags: ['ui'],
            confidence: 0.9,
            importance: 0.8,
            initialImportance: 0.8,
            status: 'confirmed',
            accessCount: 0,
            lastAccessedAt: 1,
            relatedMemoryIds: [],
            contradictsIds: [],
            createdAt: 1,
            updatedAt: 1
        })),
        rejectPendingMemory: vi.fn(async () => undefined),
        rememberExplicit: vi.fn(async () => ({ id: 'm1' })),
        recall: vi.fn(async () => ({ memories: [], totalMatches: 0 })),
        searchMemoriesHybrid: vi.fn(async () => [{ id: 'm1' }]),
        getSearchAnalytics: vi.fn(() => ({ totalQueries: 1, semanticQueries: 0, textQueries: 0, hybridQueries: 1, averageResults: 1, topQueries: [] })),
        getSearchHistory: vi.fn(() => []),
        getSearchSuggestions: vi.fn(() => []),
        exportMemories: vi.fn(async () => ({ count: 0, memories: [] })),
        importMemories: vi.fn(async () => ({ imported: 0, pendingImported: 0, skipped: 0, errors: [] })),
        getStatistics: vi.fn(async () => ({ total: 0 })),
        runDecayMaintenance: vi.fn(async () => undefined),
        recategorizeMemories: vi.fn(async () => undefined),
        extractAndStageFromMessage: vi.fn(async () => []),
        deleteMemory: vi.fn(async () => true),
        deleteMemories: vi.fn(async () => ({ deleted: 0, failed: [] })),
        editMemory: vi.fn(async () => null),
        archiveMemory: vi.fn(async () => true),
        archiveMemories: vi.fn(async () => ({ archived: 0, failed: [] })),
        restoreMemory: vi.fn(async () => true),
        getMemory: vi.fn(async () => null),
        shareMemoryWithWorkspace: vi.fn(async () => null),
        createSharedNamespace: vi.fn(() => ({ id: 'ns-1' })),
        syncSharedNamespace: vi.fn(async () => ({ namespaceId: 'ns-1', synced: 0, skipped: 0, conflicts: [], updatedAt: Date.now() })),
        getSharedNamespaceAnalytics: vi.fn(async () => ({ namespaceId: 'ns-1', workspaceCount: 0, memoryCount: 0, lastSyncedAt: null, topContributors: [] })),
        searchAcrossWorkspaces: vi.fn(async () => []),
        getMemoryHistory: vi.fn(async () => []),
        rollbackMemory: vi.fn(async () => null),
        getAllEntityFacts: vi.fn(async () => []),
        getAllEpisodes: vi.fn(async () => []),
        getAllAdvancedMemories: vi.fn(async () => [])
    });

    beforeEach(() => {
        handlers.clear();
        vi.clearAllMocks();
    });

    it('registers and runs core advanced-memory handlers', async () => {
        const service = buildService();
        registerAdvancedMemoryIpc(service as never);

        const pendingResult = await handlers.get('advancedMemory:getPending')?.({});
        expect(pendingResult).toMatchObject({ success: true, data: [], uiState: 'empty' });

        const confirmResult = await handlers.get('advancedMemory:confirm')?.({}, pendingId);
        expect(confirmResult).toMatchObject({ success: true, data: { id: pendingId } });
        expect(service.confirmPendingMemory).toHaveBeenCalledWith(pendingId, 'user', undefined);
    });

    it('normalizes invalid search inputs and avoids service call on empty query', async () => {
        const service = buildService();
        registerAdvancedMemoryIpc(service as never);
        const searchHandler = handlers.get('advancedMemory:search');

        const empty = await searchHandler?.({}, '   ', -100);
        expect(empty).toMatchObject({ success: true, data: [], uiState: 'empty' });
        expect(service.searchMemoriesHybrid).not.toHaveBeenCalled();

        await searchHandler?.({}, '  release notes ', 9999);
        expect(service.searchMemoriesHybrid).toHaveBeenCalledWith('release notes', 200);
    });

    it('normalizes export args and forwards bounded limits', async () => {
        const service = buildService();
        registerAdvancedMemoryIpc(service as never);
        const exportHandler = handlers.get('advancedMemory:export');

        await exportHandler?.({}, '   ', 0);
        expect(service.exportMemories).toHaveBeenCalledWith(undefined, 1);
    });
});
