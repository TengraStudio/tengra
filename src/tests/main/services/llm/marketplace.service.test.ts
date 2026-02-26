import { MarketplaceService } from '@main/services/llm/marketplace.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('MarketplaceService', () => {
    const databaseClient = {
        getMarketplaceModels: vi.fn(async () => []),
        searchMarketplaceModels: vi.fn(async () => [])
    };
    const jobScheduler = {};

    let service: MarketplaceService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new MarketplaceService({
            databaseClient: databaseClient as never,
            jobScheduler: jobScheduler as never
        });
    });

    it('returns null for model details in backend-only mode', async () => {
        const result = await service.getModelDetails('hf-model', 'huggingface');

        expect(result).toBeNull();
    });
});
