import { MarketplaceService } from '@main/services/llm/marketplace.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('MarketplaceService', () => {
    const databaseClient = {
        getMarketplaceModels: vi.fn(async () => []),
        searchMarketplaceModels: vi.fn(async () => [])
    };
    const processManager = {
        sendGetRequest: vi.fn()
    };
    const jobScheduler = {};

    let service: MarketplaceService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new MarketplaceService({
            databaseClient: databaseClient as never,
            processManager: processManager as never,
            jobScheduler: jobScheduler as never
        });
    });

    it('uses huggingface endpoint for HuggingFace model details', async () => {
        processManager.sendGetRequest.mockResolvedValue({
            success: true,
            data: {
                name: 'hf-model',
                shortDescription: 'hf',
                longDescriptionMarkdown: 'details'
            }
        });

        const result = await service.getModelDetails('hf-model', 'huggingface');

        expect(processManager.sendGetRequest).toHaveBeenCalledWith(
            'model-service',
            '/marketplace/huggingface?modelId=hf-model'
        );
        expect(result).toEqual({
            name: 'hf-model',
            shortDescription: 'hf',
            longDescriptionMarkdown: 'details'
        });
    });

    it('returns null for unsuccessful huggingface response', async () => {
        processManager.sendGetRequest.mockResolvedValue({
            success: false,
            error: 'upstream failure'
        });

        const result = await service.getModelDetails('hf-model', 'huggingface');

        expect(result).toBeNull();
    });

    it('returns null when huggingface request throws', async () => {
        processManager.sendGetRequest.mockRejectedValue(new Error('network error'));

        const result = await service.getModelDetails('hf-model', 'huggingface');

        expect(result).toBeNull();
    });
});
