import { registerModelRegistryIpc } from '@main/ipc/model-registry';
import { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            ipcMainHandlers.set(channel, handler);
        }),
        setMaxListeners: vi.fn()
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
    createIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown) => async (...args: unknown[]) => handler(...args),
    createSafeIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown, defaultValue: unknown) => async (...args: unknown[]) => {
        try {
            return await handler(...args);
        } catch {
            return defaultValue;
        }
    }
}));

describe('Model Registry IPC Integration', () => {
    const mockModelProviders = [
        { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'], isInstalled: true },
        { id: 'anthropic', name: 'Anthropic', models: ['claude-3'], isInstalled: false }
    ];

    const mockRemoteModels = [
        { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'], isInstalled: true },
        { id: 'anthropic', name: 'Anthropic', models: ['claude-3'], isInstalled: false }
    ];

    const mockInstalledModels = [
        { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'], isInstalled: true }
    ];

    const mockModelRegistryService = {
        getAllModels: vi.fn().mockResolvedValue(mockModelProviders),
        getRemoteModels: vi.fn().mockResolvedValue(mockRemoteModels),
        getInstalledModels: vi.fn().mockResolvedValue(mockInstalledModels)
    };

    const mockRateLimitService = {
        waitForToken: vi.fn().mockResolvedValue(undefined)
    };

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
    });

    describe('without rate limiting', () => {
        beforeEach(() => {
            registerModelRegistryIpc(mockModelRegistryService as never);
        });

        it('registers all model registry IPC handlers', () => {
            expect(ipcMainHandlers.has('model-registry:getAllModels')).toBe(true);
            expect(ipcMainHandlers.has('model-registry:getRemoteModels')).toBe(true);
            expect(ipcMainHandlers.has('model-registry:getInstalledModels')).toBe(true);
        });

        it('retrieves all models', async () => {
            const handler = ipcMainHandlers.get('model-registry:getAllModels')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result).toEqual(mockModelProviders);
            expect(mockModelRegistryService.getAllModels).toHaveBeenCalledTimes(1);
        });

        it('retrieves remote models', async () => {
            const handler = ipcMainHandlers.get('model-registry:getRemoteModels')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(mockRemoteModels);
            expect(mockModelRegistryService.getRemoteModels).toHaveBeenCalledTimes(1);
        });

        it('retrieves installed models', async () => {
            const handler = ipcMainHandlers.get('model-registry:getInstalledModels')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0].isInstalled).toBe(true);
            expect(mockModelRegistryService.getInstalledModels).toHaveBeenCalledTimes(1);
        });

        it('returns empty array on getAllModels error (safe handler)', async () => {
            mockModelRegistryService.getAllModels.mockRejectedValue(new Error('Network error'));

            const handler = ipcMainHandlers.get('model-registry:getAllModels')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(result).toEqual([]);
            expect(mockModelRegistryService.getAllModels).toHaveBeenCalledTimes(1);
        });

        it('returns empty array on getRemoteModels error (safe handler)', async () => {
            mockModelRegistryService.getRemoteModels.mockRejectedValue(new Error('Network error'));

            const handler = ipcMainHandlers.get('model-registry:getRemoteModels')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(result).toEqual([]);
            expect(mockModelRegistryService.getRemoteModels).toHaveBeenCalledTimes(1);
        });

        it('returns empty array on getInstalledModels error (safe handler)', async () => {
            mockModelRegistryService.getInstalledModels.mockRejectedValue(new Error('Service error'));

            const handler = ipcMainHandlers.get('model-registry:getInstalledModels')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(result).toEqual([]);
            expect(mockModelRegistryService.getInstalledModels).toHaveBeenCalledTimes(1);
        });
    });

    describe('with rate limiting', () => {
        beforeEach(() => {
            registerModelRegistryIpc(mockModelRegistryService as never, mockRateLimitService as never);
        });

        it('applies rate limit to getAllModels', async () => {
            const handler = ipcMainHandlers.get('model-registry:getAllModels')!;
            await handler({} as IpcMainInvokeEvent);

            expect(mockRateLimitService.waitForToken).toHaveBeenCalledWith('model-registry');
            expect(mockModelRegistryService.getAllModels).toHaveBeenCalledTimes(1);
        });

        it('applies rate limit to getRemoteModels', async () => {
            const handler = ipcMainHandlers.get('model-registry:getRemoteModels')!;
            await handler({} as IpcMainInvokeEvent);

            expect(mockRateLimitService.waitForToken).toHaveBeenCalledWith('model-registry');
            expect(mockModelRegistryService.getRemoteModels).toHaveBeenCalledTimes(1);
        });

        it('applies rate limit to getInstalledModels', async () => {
            const handler = ipcMainHandlers.get('model-registry:getInstalledModels')!;
            await handler({} as IpcMainInvokeEvent);

            expect(mockRateLimitService.waitForToken).toHaveBeenCalledWith('model-registry');
            expect(mockModelRegistryService.getInstalledModels).toHaveBeenCalledTimes(1);
        });

        it('waits for rate limit token before fetching models', async () => {
            const callOrder: string[] = [];
            mockRateLimitService.waitForToken.mockImplementation(async () => {
                callOrder.push('rate-limit');
            });
            mockModelRegistryService.getAllModels.mockImplementation(async () => {
                callOrder.push('fetch-models');
                return mockModelProviders;
            });

            const handler = ipcMainHandlers.get('model-registry:getAllModels')!;
            await handler({} as IpcMainInvokeEvent);

            expect(callOrder).toEqual(['rate-limit', 'fetch-models']);
        });

        it('returns default value if rate limiting throws error', async () => {
            mockRateLimitService.waitForToken.mockRejectedValue(new Error('Rate limit exceeded'));

            const handler = ipcMainHandlers.get('model-registry:getAllModels')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(result).toEqual([]);
            expect(mockRateLimitService.waitForToken).toHaveBeenCalledWith('model-registry');
            expect(mockModelRegistryService.getAllModels).not.toHaveBeenCalled();
        });
    });
});
