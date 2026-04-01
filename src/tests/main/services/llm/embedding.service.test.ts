import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LlamaService } from '@main/services/llm/llama.service';
import { LLMService } from '@main/services/llm/llm.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { SettingsService } from '@main/services/system/settings.service';
import { AppSettings } from '@shared/types/settings';
import { describe, expect, it, vi } from 'vitest';

function createService(provider: 'ollama' | 'openai' | 'llama' | 'none', model?: string) {
    const mocks = {
        ollamaGetEmbeddings: vi.fn(async (_model: string, _text: string): Promise<number[]> => []),
        llmGetEmbeddings: vi.fn(async (_text: string, _model?: string): Promise<number[]> => []),
        llamaGetEmbeddings: vi.fn(async (_text: string): Promise<number[]> => [])
    };

    const settingsService: Pick<SettingsService, 'getSettings'> = {
        getSettings: (): AppSettings => ({
            ollama: {
                url: 'http://localhost:11434'
            },
            embeddings: {
                provider,
                model
            },
            general: {
                language: 'en',
                theme: 'light',
                resolution: 'auto',
                fontSize: 14,

            }
        })
    };

    const ollama: Pick<OllamaService, 'getEmbeddings'> = {
        getEmbeddings: mocks.ollamaGetEmbeddings
    };
    const llm: Pick<LLMService, 'getEmbeddings'> = {
        getEmbeddings: mocks.llmGetEmbeddings
    };
    const llama: Pick<LlamaService, 'getEmbeddings'> = {
        getEmbeddings: mocks.llamaGetEmbeddings
    };

    const service = new EmbeddingService(
        ollama as OllamaService,
        llm as LLMService,
        llama as LlamaService,
        settingsService as SettingsService
    );

    return { service, mocks };
}

describe('EmbeddingService', () => {
    it('reports empty health state before any request', () => {
        const { service } = createService('ollama', 'all-minilm');
        const health = service.getHealthStatus();

        expect(health.uiState).toBe('empty');
        expect(health.status).toBe('healthy');
    });

    it('uses cache for repeated requests with same provider/model/text', async () => {
        const { service, mocks } = createService('ollama', 'all-minilm');
        const vector = new Array<number>(1536).fill(1);
        mocks.ollamaGetEmbeddings.mockResolvedValue(vector);

        const first = await service.generateEmbedding('same input');
        const second = await service.generateEmbedding('same input');

        expect(first).toHaveLength(1536);
        expect(second).toHaveLength(1536);
        expect(mocks.ollamaGetEmbeddings).toHaveBeenCalledTimes(1);

        const analytics = service.getAnalytics();
        expect(analytics.cacheHits).toBe(1);
        expect(analytics.cacheMisses).toBe(1);
    });

    it('returns a defensive copy for cached embeddings', async () => {
        const { service, mocks } = createService('ollama', 'all-minilm');
        const vector = new Array<number>(1536).fill(1);
        mocks.ollamaGetEmbeddings.mockResolvedValue(vector);

        const first = await service.generateEmbedding('immutable cache');
        first[0] = 999;
        const second = await service.generateEmbedding('immutable cache');

        expect(second[0]).toBe(1);
        expect(mocks.ollamaGetEmbeddings).toHaveBeenCalledTimes(1);
    });

    it('clears cache entries and forces provider recomputation', async () => {
        const { service, mocks } = createService('ollama', 'all-minilm');
        mocks.ollamaGetEmbeddings.mockResolvedValue(new Array<number>(1536).fill(0.2));

        await service.generateEmbedding('cache-clear');
        await service.generateEmbedding('cache-clear');
        expect(mocks.ollamaGetEmbeddings).toHaveBeenCalledTimes(1);

        service.clearCache();
        await service.generateEmbedding('cache-clear');
        expect(mocks.ollamaGetEmbeddings).toHaveBeenCalledTimes(2);
    });

    it('normalizes oversized embeddings to required dimension', async () => {
        const { service, mocks } = createService('openai', 'text-embedding-3-small');
        mocks.llmGetEmbeddings.mockResolvedValue(new Array<number>(2000).fill(0.5));

        const embedding = await service.generateEmbedding('oversized');

        expect(embedding).toHaveLength(1536);
        expect(service.getAnalytics().dimensionMismatches).toBe(1);
    });

    it('pads undersized embeddings to required dimension', async () => {
        const { service, mocks } = createService('llama');
        mocks.llamaGetEmbeddings.mockResolvedValue(new Array<number>(64).fill(0.3));

        const embedding = await service.generateEmbedding('undersized');

        expect(embedding).toHaveLength(1536);
        expect(embedding[0]).toBe(0.3);
        expect(embedding[1535]).toBe(0);
    });

    it('returns zero vector for blank input without provider call', async () => {
        const { service, mocks } = createService('ollama', 'all-minilm');

        const embedding = await service.generateEmbedding('   ');

        expect(embedding).toHaveLength(1536);
        expect(embedding.every(value => value === 0)).toBe(true);
        expect(mocks.ollamaGetEmbeddings).not.toHaveBeenCalled();
        expect(mocks.llmGetEmbeddings).not.toHaveBeenCalled();
        expect(mocks.llamaGetEmbeddings).not.toHaveBeenCalled();
    });

    it('tracks provider failure and falls back to zero vector', async () => {
        const { service, mocks } = createService('ollama', 'all-minilm');
        mocks.ollamaGetEmbeddings
            .mockRejectedValueOnce(new Error('provider down'))
            .mockRejectedValueOnce(new Error('provider still down'));

        const embedding = await service.generateEmbedding('failure path');
        const analytics = service.getAnalytics();

        expect(embedding).toHaveLength(1536);
        expect(embedding.every(value => value === 0)).toBe(true);
        expect(analytics.providerFailures.ollama).toBe(1);
        expect(analytics.providerRequests.ollama).toBe(1);
    });

    it('retries provider call after transient failure and records retry metric', async () => {
        const { service, mocks } = createService('ollama', 'all-minilm');
        mocks.ollamaGetEmbeddings
            .mockRejectedValueOnce(new Error('temporary network'))
            .mockResolvedValueOnce(new Array<number>(1536).fill(0.6));

        const embedding = await service.generateEmbedding('retry me');
        const analytics = service.getAnalytics();

        expect(embedding).toHaveLength(1536);
        expect(analytics.retries).toBe(1);
        expect(analytics.providerFailures.ollama).toBe(0);
    });

    it('returns zero vector and increments validation failures for oversized text payloads', async () => {
        const { service, mocks } = createService('openai', 'text-embedding-3-small');
        const oversized = 'x'.repeat(20001);

        const embedding = await service.generateEmbedding(oversized);
        const analytics = service.getAnalytics();

        expect(embedding.every(value => value === 0)).toBe(true);
        expect(analytics.validationFailures).toBe(1);
        expect(mocks.llmGetEmbeddings).not.toHaveBeenCalled();
    });

    it('returns zero vector for none provider', async () => {
        const { service, mocks } = createService('none');

        const embedding = await service.generateEmbedding('ignored');

        expect(embedding).toHaveLength(1536);
        expect(embedding.every(value => value === 0)).toBe(true);
        expect(mocks.ollamaGetEmbeddings).not.toHaveBeenCalled();
        expect(mocks.llmGetEmbeddings).not.toHaveBeenCalled();
        expect(mocks.llamaGetEmbeddings).not.toHaveBeenCalled();
    });

    it('uses provider default model when model is not supplied', async () => {
        const { service, mocks } = createService('openai');
        mocks.llmGetEmbeddings.mockResolvedValue(new Array<number>(1536).fill(0.4));

        await service.generateEmbedding('defaults');

        expect(mocks.llmGetEmbeddings).toHaveBeenCalledWith('defaults', 'text-embedding-3-small');
    });
});
