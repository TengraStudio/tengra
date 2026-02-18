import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service';
import { describe, expect, it, vi } from 'vitest';

describe('ContextRetrievalService', () => {
    it('deduplicates fragments and returns ranked summary lines', async () => {
        const db = {
            getProjects: vi.fn(async () => [{ id: 'p1', path: '/repo' }]),
            searchCodeSymbols: vi.fn(async () => [
                {
                    id: 'sym-1',
                    name: 'doWork',
                    path: 'src/a.ts',
                    line: 10,
                    kind: 'function',
                    signature: 'doWork(input: string): void',
                    docstring: 'Runs the main workflow',
                    score: 0.95
                }
            ]),
            searchSemanticFragments: vi.fn(async () => [
                {
                    id: 'f1',
                    content: 'Initialize cache before processing pipeline',
                    embedding: [0.1, 0.2],
                    source: 'knowledge',
                    sourceId: 'src/cache.ts',
                    tags: ['cache'],
                    importance: 0.9,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    score: 0.91
                },
                {
                    id: 'f2',
                    content: 'Initialize   cache before processing pipeline',
                    embedding: [0.1, 0.2],
                    source: 'knowledge',
                    sourceId: 'src/cache.ts',
                    tags: ['cache'],
                    importance: 0.8,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    score: 0.89
                }
            ])
        };

        const embedding = {
            generateEmbedding: vi.fn(async () => [0.11, 0.22])
        };

        const service = new ContextRetrievalService(
            db as never,
            embedding as never
        );

        const result = await service.retrieveContext('cache init', 'p1', 5);

        expect(result.sources).toContain('src/cache.ts');
        expect(result.sources).toContain('src/a.ts');
        expect(result.contextString).toContain('Context Summary:');
        expect(result.contextString).toContain('src/a.ts');
        expect(result.contextString).toContain('Relevant Context:');
        expect(db.searchSemanticFragments).toHaveBeenCalledTimes(1);
    });

    it('exports retrieved context and updates analytics counters', async () => {
        const db = {
            getProjects: vi.fn(async () => []),
            searchCodeSymbols: vi.fn(async () => []),
            searchSemanticFragments: vi.fn(async () => [])
        };
        const embedding = {
            generateEmbedding: vi.fn(async () => [0.1, 0.2])
        };
        const service = new ContextRetrievalService(db as never, embedding as never);

        const exported = await service.exportContext('deploy flow', undefined, 3);
        const analytics = service.getAnalytics();

        expect(exported.query).toBe('deploy flow');
        expect(exported.exportedAt).toBeTypeOf('string');
        expect(analytics.totalRequests).toBe(1);
        expect(analytics.failedRequests).toBe(0);
        expect(analytics.topQueries[0]).toMatchObject({ query: 'deploy flow', count: 1 });
    });
});
