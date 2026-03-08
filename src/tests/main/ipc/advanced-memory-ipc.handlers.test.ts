import { registerAdvancedMemoryIpc } from '@main/ipc/advanced-memory';
import { ipcMain } from 'electron';
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

describe('registerAdvancedMemoryIpc', () => {
    beforeEach(() => {
        handlers.clear();
        vi.clearAllMocks();
    });

    it('registers search/export/history handlers and calls service methods', async () => {
        const service = {
            getPendingMemories: vi.fn(() => []),
            confirmPendingMemory: vi.fn(),
            rejectPendingMemory: vi.fn(),
            rememberExplicit: vi.fn(),
            recall: vi.fn(async () => ({ memories: [], totalMatches: 0 })),
            searchMemoriesHybrid: vi.fn(async () => [{ id: 'm1' }]),
            getSearchAnalytics: vi.fn(() => ({
                totalQueries: 1,
                semanticQueries: 0,
                textQueries: 0,
                hybridQueries: 1,
                averageResults: 1,
                topQueries: [{ query: 'test', count: 1 }]
            })),
            getSearchHistory: vi.fn(() => [{
                query: 'test',
                type: 'hybrid',
                resultCount: 1,
                timestamp: Date.now()
            }]),
            getSearchSuggestions: vi.fn(() => ['test']),
            exportMemories: vi.fn(async () => ({
                exportedAt: new Date().toISOString(),
                count: 1,
                memories: [{ id: 'm1' }]
            })),
            importMemories: vi.fn(async () => ({
                imported: 1,
                pendingImported: 0,
                skipped: 0,
                errors: []
            })),
            getStatistics: vi.fn(async () => ({})),
            runDecayMaintenance: vi.fn(),
            extractAndStageFromMessage: vi.fn(async () => []),
            deleteMemory: vi.fn(async () => true),
            deleteMemories: vi.fn(async () => ({ deleted: 0, failed: [] })),
            editMemory: vi.fn(async () => null),
            archiveMemory: vi.fn(async () => true),
            archiveMemories: vi.fn(async () => ({ archived: 0, failed: [] })),
            restoreMemory: vi.fn(async () => true),
            getMemory: vi.fn(async () => null)
        };

        registerAdvancedMemoryIpc(service as never);

        expect(ipcMain.handle).toHaveBeenCalled();

        const search = handlers.get('advancedMemory:search');
        const analytics = handlers.get('advancedMemory:getSearchAnalytics');
        const history = handlers.get('advancedMemory:getSearchHistory');
        const suggestions = handlers.get('advancedMemory:getSearchSuggestions');
        const exportHandler = handlers.get('advancedMemory:export');
        const importHandler = handlers.get('advancedMemory:import');

        expect(search).toBeDefined();
        expect(analytics).toBeDefined();
        expect(history).toBeDefined();
        expect(suggestions).toBeDefined();
        expect(exportHandler).toBeDefined();
        expect(importHandler).toBeDefined();

        const searchResult = await search?.({}, 'test', 5);
        expect(service.searchMemoriesHybrid).toHaveBeenCalledWith('test', 5);
        expect(searchResult).toMatchObject({ success: true, data: [{ id: 'm1' }], uiState: 'ready' });

        const analyticsResult = await analytics?.({});
        expect(service.getSearchAnalytics).toHaveBeenCalled();
        expect(analyticsResult).toMatchObject({ success: true });

        const historyResult = await history?.({}, 5);
        expect(service.getSearchHistory).toHaveBeenCalledWith(5);
        expect(historyResult).toMatchObject({ success: true });

        const suggestionsResult = await suggestions?.({}, 'te', 3);
        expect(service.getSearchSuggestions).toHaveBeenCalledWith('te', 3);
        expect(suggestionsResult).toMatchObject({ success: true, data: ['test'], uiState: 'ready' });

        const exportResult = await exportHandler?.({}, 'test', 10);
        expect(service.exportMemories).toHaveBeenCalledWith('test', 10);
        expect(exportResult).toMatchObject({ success: true });

        const importResult = await importHandler?.({}, { memories: [{ content: 'hello' }] });
        expect(service.importMemories).toHaveBeenCalledWith({ memories: [{ content: 'hello' }] });
        expect(importResult).toMatchObject({ success: true });
    });

    it('retries transient search failures and reports health telemetry', async () => {
        const service = {
            getPendingMemories: vi.fn(() => []),
            confirmPendingMemory: vi.fn(),
            rejectPendingMemory: vi.fn(),
            rememberExplicit: vi.fn(),
            recall: vi.fn(async () => ({ memories: [], totalMatches: 0 })),
            searchMemoriesHybrid: vi.fn()
                .mockRejectedValueOnce(new Error('database is locked'))
                .mockResolvedValue([{ id: 'retry-ok' }]),
            getSearchAnalytics: vi.fn(() => ({
                totalQueries: 0,
                semanticQueries: 0,
                textQueries: 0,
                hybridQueries: 0,
                averageResults: 0,
                topQueries: []
            })),
            getSearchHistory: vi.fn(() => []),
            getSearchSuggestions: vi.fn(() => []),
            exportMemories: vi.fn(async () => ({ exportedAt: '', count: 0, memories: [] })),
            importMemories: vi.fn(async () => ({ imported: 0, pendingImported: 0, skipped: 0, errors: [] })),
            getStatistics: vi.fn(async () => ({})),
            runDecayMaintenance: vi.fn(),
            recategorizeMemories: vi.fn(),
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
            getSharedNamespaceAnalytics: vi.fn(async () => ({ namespaceId: 'ns-1', totalMemories: 0, totalWorkspaces: 0, conflicts: 0, memoriesByWorkspace: {}, updatedAt: Date.now() })),
            searchAcrossWorkspaces: vi.fn(async () => []),
            getMemoryHistory: vi.fn(async () => []),
            rollbackMemory: vi.fn(async () => null),
            getAllEntityFacts: vi.fn(async () => []),
            getAllEpisodes: vi.fn(async () => []),
            getAllAdvancedMemories: vi.fn(async () => [])
        };

        registerAdvancedMemoryIpc(service as never);
        const search = handlers.get('advancedMemory:search');
        const health = handlers.get('advancedMemory:health');

        const searchResult = await search?.({}, 'retry', 8);
        expect(searchResult).toMatchObject({ success: true, data: [{ id: 'retry-ok' }] });
        expect(service.searchMemoriesHybrid).toHaveBeenCalledTimes(2);

        const healthResult = await health?.({});
        expect(healthResult).toMatchObject({
            success: true,
            data: {
                status: expect.any(String),
                budgets: {
                    fastMs: 40,
                    standardMs: 120,
                    heavyMs: 250
                }
            }
        });
    });
});
