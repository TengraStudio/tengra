import { registerMarketplaceIpc } from '@main/ipc/marketplace';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type IpcHandler = (...args: unknown[]) => unknown | Promise<unknown>;
const ipcMainHandlers = new Map<string, IpcHandler>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: IpcHandler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

describe('Marketplace IPC integration', () => {
    const marketplaceService = {
        getModels: vi.fn(async () => []),
        searchModels: vi.fn(async () => []),
        getModelDetails: vi.fn(async () => null),
        getLastScrapeTime: vi.fn(() => 123),
        isScrapeInProgress: vi.fn(() => false)
    };
    const rateLimitService = {
        waitForToken: vi.fn(async () => undefined)
    };

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
        registerMarketplaceIpc({
            marketplaceService: marketplaceService as never,
            rateLimitService: rateLimitService as never
        });
    });

    const getHandler = (channel: string): IpcHandler => {
        const handler = ipcMainHandlers.get(channel);
        if (!handler) {
            throw new Error(`Missing handler: ${channel}`);
        }
        return handler;
    };

    it('registers marketplace handler set', () => {
        expect(ipcMainHandlers.has('marketplace:getModels')).toBe(true);
        expect(ipcMainHandlers.has('marketplace:searchModels')).toBe(true);
        expect(ipcMainHandlers.has('marketplace:getModelDetails')).toBe(true);
        expect(ipcMainHandlers.has('marketplace:getStatus')).toBe(true);
    });

    it('validates and forwards getModels arguments', async () => {
        const handler = getHandler('marketplace:getModels');
        await handler({}, 'ollama', 25, 2);

        expect(rateLimitService.waitForToken).toHaveBeenCalledWith('mcp:database');
        expect(marketplaceService.getModels).toHaveBeenCalledWith({
            provider: 'ollama',
            limit: 25,
            offset: 2
        });
    });

    it('returns empty result for invalid search query', async () => {
        const handler = getHandler('marketplace:searchModels');
        const result = await handler({}, ' '.repeat(400), 'ollama', 20);

        expect(rateLimitService.waitForToken).toHaveBeenCalledWith('mcp:database');
        expect(marketplaceService.searchModels).not.toHaveBeenCalled();
        expect(result).toEqual([]);
    });

    it('defaults getModelDetails provider to ollama when invalid', async () => {
        const handler = getHandler('marketplace:getModelDetails');
        await handler({}, 'llama3.2', 'invalid-provider');

        expect(rateLimitService.waitForToken).toHaveBeenCalledWith('mcp:internet');
        expect(marketplaceService.getModelDetails).toHaveBeenCalledWith('llama3.2', 'ollama');
    });

    it('forwards huggingface provider for getModelDetails', async () => {
        const handler = getHandler('marketplace:getModelDetails');
        await handler({}, 'sentence-transformers/all-MiniLM-L6-v2', 'huggingface');

        expect(rateLimitService.waitForToken).toHaveBeenCalledWith('mcp:internet');
        expect(marketplaceService.getModelDetails).toHaveBeenCalledWith(
            'sentence-transformers/all-MiniLM-L6-v2',
            'huggingface'
        );
    });

    it('returns status shape from service getters', async () => {
        const handler = getHandler('marketplace:getStatus');
        const result = await handler({});

        expect(result).toEqual({
            lastScrapeTime: 123,
            isScraping: false
        });
    });
});
