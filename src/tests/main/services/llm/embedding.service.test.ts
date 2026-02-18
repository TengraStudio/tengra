import { EmbeddingService } from '@main/services/llm/embedding.service';
import { describe, expect, it, vi } from 'vitest';

interface TestSettingsService {
    getSettings: () => {
        embeddings: {
            provider: 'ollama' | 'openai' | 'llama' | 'none';
            model?: string;
        };
    };
}

function createService(provider: 'ollama' | 'openai' | 'llama' | 'none', model?: string) {
    const ollama = { getEmbeddings: vi.fn<() => Promise<number[]>>() };
    const llm = { getEmbeddings: vi.fn<() => Promise<number[]>>() };
    const llama = { getEmbeddings: vi.fn<() => Promise<number[]>>() };
    const settingsService: TestSettingsService = {
        getSettings: () => ({
            embeddings: {
                provider,
                model
            }
        })
    };

    const service = new EmbeddingService(
        ollama as never,
        llm as never,
        llama as never,
        settingsService as never
    );

    return { service, ollama, llm, llama };
}

describe('EmbeddingService', () => {
    it('uses cache for repeated requests with same provider/model/text', async () => {
        const { service, ollama } = createService('ollama', 'all-minilm');
        const vector = new Array<number>(1536).fill(1);
        ollama.getEmbeddings.mockResolvedValue(vector);

        const first = await service.generateEmbedding('same input');
        const second = await service.generateEmbedding('same input');

        expect(first).toHaveLength(1536);
        expect(second).toHaveLength(1536);
        expect(ollama.getEmbeddings).toHaveBeenCalledTimes(1);

        const analytics = service.getAnalytics();
        expect(analytics.cacheHits).toBe(1);
        expect(analytics.cacheMisses).toBe(1);
    });

    it('normalizes oversized embeddings to required dimension', async () => {
        const { service, llm } = createService('openai', 'text-embedding-3-small');
        llm.getEmbeddings.mockResolvedValue(new Array<number>(2000).fill(0.5));

        const embedding = await service.generateEmbedding('oversized');

        expect(embedding).toHaveLength(1536);
        expect(service.getAnalytics().dimensionMismatches).toBe(1);
    });

    it('pads undersized embeddings to required dimension', async () => {
        const { service, llama } = createService('llama');
        llama.getEmbeddings.mockResolvedValue(new Array<number>(64).fill(0.3));

        const embedding = await service.generateEmbedding('undersized');

        expect(embedding).toHaveLength(1536);
        expect(embedding[0]).toBe(0.3);
        expect(embedding[1535]).toBe(0);
    });

    it('returns zero vector for none provider', async () => {
        const { service, ollama, llm, llama } = createService('none');

        const embedding = await service.generateEmbedding('ignored');

        expect(embedding).toHaveLength(1536);
        expect(embedding.every(value => value === 0)).toBe(true);
        expect(ollama.getEmbeddings).not.toHaveBeenCalled();
        expect(llm.getEmbeddings).not.toHaveBeenCalled();
        expect(llama.getEmbeddings).not.toHaveBeenCalled();
    });
});
