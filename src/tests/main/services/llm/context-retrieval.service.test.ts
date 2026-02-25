import { CodeSymbolSearchResult, DatabaseService, SemanticFragment } from '@main/services/data/database.service';
import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { Project } from '@shared/types/project';
import { describe, expect, it, vi } from 'vitest';

function createSymbol(overrides: Partial<CodeSymbolSearchResult> = {}): CodeSymbolSearchResult {
    return {
        id: 'sym-1',
        name: 'doWork',
        path: 'src/a.ts',
        line: 10,
        kind: 'function',
        signature: 'doWork(input: string): void',
        docstring: 'Runs the main workflow',
        score: 0.95,
        ...overrides
    };
}

function createFragment(overrides: Partial<SemanticFragment> = {}): SemanticFragment {
    const now = Date.now();
    return {
        id: 'f1',
        content: 'Initialize cache before processing pipeline',
        embedding: [0.1, 0.2],
        source: 'knowledge',
        sourceId: 'src/cache.ts',
        tags: ['cache'],
        importance: 0.9,
        createdAt: now,
        updatedAt: now,
        score: 0.91,
        ...overrides
    };
}

function createProject(overrides: Partial<Project> = {}): Project {
    const now = Date.now();
    return {
        id: 'project-id',
        title: 'Test Project',
        description: 'Project for unit tests',
        path: '/repo',
        mounts: [],
        createdAt: now,
        updatedAt: now,
        chatIds: [],
        councilConfig: {
            enabled: false,
            members: [],
            consensusThreshold: 0.7
        },
        status: 'active',
        ...overrides
    };
}

function createService() {
    const mocks = {
        getProjects: vi.fn(async (): Promise<Project[]> => []),
        searchCodeSymbols: vi.fn(async (): Promise<CodeSymbolSearchResult[]> => []),
        searchSemanticFragments: vi.fn(async (): Promise<SemanticFragment[]> => []),
        generateEmbedding: vi.fn(async (_query: string) => [0.11, 0.22])
    };

    const db: Pick<DatabaseService, 'getProjects' | 'searchCodeSymbols' | 'searchSemanticFragments'> = {
        getProjects: mocks.getProjects,
        searchCodeSymbols: mocks.searchCodeSymbols,
        searchSemanticFragments: mocks.searchSemanticFragments
    };

    const embedding: Pick<EmbeddingService, 'generateEmbedding'> = {
        generateEmbedding: mocks.generateEmbedding
    };

    const service = new ContextRetrievalService(
        db as DatabaseService,
        embedding as EmbeddingService
    );

    return { service, mocks };
}

describe('ContextRetrievalService', () => {
    it('deduplicates fragments and returns ranked summary lines', async () => {
        const { service, mocks } = createService();
        mocks.getProjects.mockResolvedValue([createProject({ id: 'p1', path: '/repo' })]);
        mocks.searchCodeSymbols.mockResolvedValue([createSymbol()]);
        mocks.searchSemanticFragments.mockResolvedValue([
            createFragment(),
            createFragment({
                id: 'f2',
                content: 'Initialize   cache before processing pipeline',
                score: 0.89
            })
        ]);

        const result = await service.retrieveContext('cache init', 'p1', 5);

        expect(result.sources).toContain('src/cache.ts');
        expect(result.sources).toContain('src/a.ts');
        expect(result.contextString).toContain('Context Summary:');
        expect(result.contextString).toContain('src/a.ts');
        expect(result.contextString).toContain('Relevant Context:');
        expect(mocks.searchSemanticFragments).toHaveBeenCalledTimes(1);
        expect(mocks.searchCodeSymbols).toHaveBeenCalledWith([0.11, 0.22], '/repo');
        expect(mocks.searchSemanticFragments).toHaveBeenCalledWith([0.11, 0.22], 5, '/repo');
    });

    it('exports retrieved context and updates analytics counters', async () => {
        const { service } = createService();

        const exported = await service.exportContext('deploy flow', undefined, 3);
        const analytics = service.getAnalytics();

        expect(exported.query).toBe('deploy flow');
        expect(exported.exportedAt).toBeTypeOf('string');
        expect(analytics.totalRequests).toBe(1);
        expect(analytics.failedRequests).toBe(0);
        expect(analytics.topQueries[0]).toMatchObject({ query: 'deploy flow', count: 1 });
    });

    it('returns partial context when symbol search fails but fragments succeed', async () => {
        const { service, mocks } = createService();
        mocks.searchCodeSymbols.mockRejectedValueOnce(new Error('symbols unavailable'));
        mocks.searchSemanticFragments.mockResolvedValue([
            createFragment({
                id: 'f-frag',
                source: 'notes',
                sourceId: 'notes.md',
                content: 'Cache warmup is required before query execution'
            })
        ]);

        const result = await service.retrieveContext('cache warmup');
        const analytics = service.getAnalytics();

        expect(result.contextString).toContain('Relevant Context:');
        expect(result.sources).toContain('notes.md');
        expect(analytics.totalRequests).toBe(1);
        expect(analytics.failedRequests).toBe(0);
    });

    it('increments failed request analytics when embedding generation throws', async () => {
        const { service, mocks } = createService();
        mocks.generateEmbedding
            .mockRejectedValueOnce(new Error('embedding down'))
            .mockRejectedValueOnce(new Error('embedding still down'));

        const result = await service.retrieveContext('will fail');
        const analytics = service.getAnalytics();

        expect(result).toEqual({ contextString: '', sources: [] });
        expect(analytics.totalRequests).toBe(1);
        expect(analytics.failedRequests).toBe(1);
    });

    it('does not add blank queries to top query analytics', async () => {
        const { service } = createService();

        await service.retrieveContext('   ');
        const analytics = service.getAnalytics();

        expect(analytics.totalRequests).toBe(1);
        expect(analytics.topQueries).toHaveLength(0);
    });

    it('retries embedding generation and records retry telemetry', async () => {
        const { service, mocks } = createService();
        mocks.generateEmbedding
            .mockRejectedValueOnce(new Error('temporary failure'))
            .mockResolvedValueOnce([0.4, 0.5]);

        await service.retrieveContext('retry query');
        const health = service.getHealthStatus();

        expect(health.metrics.retries).toBe(1);
        expect(health.metrics.failedRequests).toBe(0);
        expect(health.uiState).toBe('ready');
    });

    it('returns empty context and marks failure when input validation fails', async () => {
        const { service } = createService();

        const result = await service.retrieveContext('validated query', undefined, 0);
        const health = service.getHealthStatus();

        expect(result).toEqual({ contextString: '', sources: [] });
        expect(health.metrics.validationFailures).toBe(1);
        expect(health.metrics.failedRequests).toBe(1);
        expect(health.uiState).toBe('failure');
    });
});
