import { registerAdvancedMemoryIpc } from '@main/ipc/advanced-memory';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
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

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: (
        _name: string,
        handler: (...args: unknown[]) => Promise<unknown>,
        options?: { onError?: (error: Error) => unknown }
    ) => async (event: unknown, ...args: unknown[]) => {
        try {
            return await handler(event, ...args);
        } catch (error: unknown) {
            if (options?.onError) {
                return options.onError(error);
            }
            throw error;
        }
    }
}));

describe('Advanced Memory IPC Handlers', () => {
    const buildService = () => ({
        getPendingMemories: vi.fn(() => []),
        confirmPendingMemory: vi.fn(async () => ({ id: 'p1' })),
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
        shareMemoryWithProject: vi.fn(async () => null),
        createSharedNamespace: vi.fn(() => ({ id: 'ns-1' })),
        syncSharedNamespace: vi.fn(async () => ({ namespaceId: 'ns-1', synced: 0, skipped: 0, conflicts: [], updatedAt: Date.now() })),
        getSharedNamespaceAnalytics: vi.fn(async () => ({ namespaceId: 'ns-1', projectCount: 0, memoryCount: 0, lastSyncedAt: null, topContributors: [] })),
        searchAcrossProjects: vi.fn(async () => []),
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

        const confirmResult = await handlers.get('advancedMemory:confirm')?.({}, 'p1');
        expect(confirmResult).toMatchObject({ success: true, data: { id: 'p1' } });
        expect(service.confirmPendingMemory).toHaveBeenCalledWith('p1', 'user', undefined);
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
