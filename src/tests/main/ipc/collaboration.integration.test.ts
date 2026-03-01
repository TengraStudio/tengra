import { registerCollaborationIpc } from '@main/ipc/collaboration';
import { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockFn = ReturnType<typeof vi.fn>;

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

// Mock IPC Wrapper
vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown) => async (...args: unknown[]) => {
        try {
            const result = await handler(...args);
            return { success: true, data: result };
        } catch (error: unknown) {
            return { success: false, error: (error instanceof Error ? error.message : 'Unknown Error') };
        }
    },
    createSafeIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown, fallback: unknown) => async (...args: unknown[]) => {
        try {
            const result = await handler(...args);
            return { success: true, data: result };
        } catch {
            return { success: true, data: fallback };
        }
    }
}));

// Mock multi-llm-orchestrator
vi.mock('@main/services/llm/multi-llm-orchestrator.service', () => ({
    multiLLMOrchestrator: {
        getProviderStats: vi.fn(),
        getAllStats: vi.fn(),
        getActiveTaskCount: vi.fn(),
        setProviderConfig: vi.fn()
    }
}));

// Import the mocked module to get access to the mock functions - currently not used but kept for potential future tests
 
const { multiLLMOrchestrator } = await import('@main/services/llm/multi-llm-orchestrator.service');

// Mock ModelCollaborationService
const mockCollaborationService = {
    collaborate: vi.fn()
};

describe('Collaboration IPC Integration', () => {
    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
    });

    const initIPC = () => {
        registerCollaborationIpc(() => null, mockCollaborationService as never);
    };

    it('should register expected handlers', () => {
        initIPC();
        expect(ipcMainHandlers.has('collaboration:run')).toBe(true);
        expect(ipcMainHandlers.has('collaboration:getProviderStats')).toBe(true);
        expect(ipcMainHandlers.has('collaboration:getActiveTaskCount')).toBe(true);
        expect(ipcMainHandlers.has('collaboration:setProviderConfig')).toBe(true);
    });

    describe('collaboration:run', () => {
        it('should run collaboration with valid request', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:run');

            mockCollaborationService.collaborate.mockResolvedValue({
                content: 'Collaborative response',
                model: 'gpt-4',
                metadata: { strategy: 'consensus' }
            });

            const request = {
                messages: [{ role: 'user', content: 'Test message' }],
                models: [
                    { provider: 'openai', model: 'gpt-4' },
                    { provider: 'anthropic', model: 'claude-3' }
                ],
                strategy: 'consensus' as const,
                options: { temperature: 0.7, maxTokens: 1000 }
            };

            const result = await handler?.({} as IpcMainInvokeEvent, request);

            expect(mockCollaborationService.collaborate).toHaveBeenCalledWith(request);
            expect(result).toMatchObject({
                success: true,
                data: {
                    content: 'Collaborative response'
                }
            });
        });

        it('should reject request with non-array messages', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:run');

            const request = {
                messages: 'invalid',
                models: [{ provider: 'openai', model: 'gpt-4' }],
                strategy: 'consensus' as const
            };

            const result = await handler?.({} as IpcMainInvokeEvent, request);

            expect(mockCollaborationService.collaborate).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'Messages must be an array'
            });
        });

        it('should reject request with empty models array', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:run');

            const request = {
                messages: [{ role: 'user', content: 'Test' }],
                models: [],
                strategy: 'consensus' as const
            };

            const result = await handler?.({} as IpcMainInvokeEvent, request);

            expect(mockCollaborationService.collaborate).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'Models must be a non-empty array'
            });
        });

        it('should reject request with non-array models', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:run');

            const request = {
                messages: [{ role: 'user', content: 'Test' }],
                models: 'invalid',
                strategy: 'consensus' as const
            };

            const result = await handler?.({} as IpcMainInvokeEvent, request);

            expect(mockCollaborationService.collaborate).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'Models must be a non-empty array'
            });
        });

        it('should reject request with invalid strategy', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:run');

            const request = {
                messages: [{ role: 'user', content: 'Test' }],
                models: [{ provider: 'openai', model: 'gpt-4' }],
                strategy: 'invalid-strategy' as never
            };

            const result = await handler?.({} as IpcMainInvokeEvent, request);

            expect(mockCollaborationService.collaborate).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'Strategy must be one of: consensus, vote, best-of-n, chain-of-thought'
            });
        });

        it('should accept all valid strategies', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:run');

            mockCollaborationService.collaborate.mockResolvedValue({ content: 'Response' });

            const strategies = ['consensus', 'vote', 'best-of-n', 'chain-of-thought'] as const;

            for (const strategy of strategies) {
                const request = {
                    messages: [{ role: 'user', content: 'Test' }],
                    models: [{ provider: 'openai', model: 'gpt-4' }],
                    strategy
                };

                const result = await handler?.({} as IpcMainInvokeEvent, request);

                expect((result as { success: boolean }).success).toBe(true);
            }

            expect(mockCollaborationService.collaborate).toHaveBeenCalledTimes(4);
        });
    });

    describe('collaboration:getProviderStats', () => {
        it('should get stats for specific provider', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:getProviderStats');

            const stats = {
                totalRequests: 100,
                successfulRequests: 95,
                failedRequests: 5,
                averageLatency: 250
            };

            (multiLLMOrchestrator.getProviderStats as MockFn).mockReturnValue(stats);

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai');

            expect(multiLLMOrchestrator.getProviderStats).toHaveBeenCalledWith('openai');
            expect(result).toMatchObject({
                success: true,
                data: stats
            });
        });

        it('should return null for non-existent provider', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:getProviderStats');

            (multiLLMOrchestrator.getProviderStats as MockFn).mockReturnValue(undefined);

            const result = await handler?.({} as IpcMainInvokeEvent, 'non-existent');

            expect(multiLLMOrchestrator.getProviderStats).toHaveBeenCalledWith('non-existent');
            expect(result).toMatchObject({
                success: true,
                data: null
            });
        });

        it('should get all provider stats when no provider specified', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:getProviderStats');

            const allStats = new Map([
                ['openai', { totalRequests: 100 }],
                ['anthropic', { totalRequests: 50 }]
            ]);

            (multiLLMOrchestrator.getAllStats as MockFn).mockReturnValue(allStats);

            const result = await handler?.({} as IpcMainInvokeEvent);

            expect(multiLLMOrchestrator.getAllStats).toHaveBeenCalled();
            expect(result).toMatchObject({
                success: true,
                data: {
                    openai: { totalRequests: 100 },
                    anthropic: { totalRequests: 50 }
                }
            });
        });

        it('should handle errors and return fallback', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:getProviderStats');

            (multiLLMOrchestrator.getProviderStats as MockFn).mockImplementation(() => {
                throw new Error('Stats error');
            });

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai');

            expect(result).toMatchObject({
                success: true,
                data: {}
            });
        });
    });

    describe('collaboration:getActiveTaskCount', () => {
        it('should get active task count for provider', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:getActiveTaskCount');

            (multiLLMOrchestrator.getActiveTaskCount as MockFn).mockReturnValue(5);

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai');

            expect(multiLLMOrchestrator.getActiveTaskCount).toHaveBeenCalledWith('openai');
            expect(result).toMatchObject({
                success: true,
                data: 5
            });
        });

        it('should reject non-string provider', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:getActiveTaskCount');

            const result = await handler?.({} as IpcMainInvokeEvent, 123);

            expect(multiLLMOrchestrator.getActiveTaskCount).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: true,
                data: 0
            });
        });

        it('should handle errors and return fallback', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:getActiveTaskCount');

            (multiLLMOrchestrator.getActiveTaskCount as MockFn).mockImplementation(() => {
                throw new Error('Count error');
            });

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai');

            expect(result).toMatchObject({
                success: true,
                data: 0
            });
        });
    });

    describe('collaboration:setProviderConfig', () => {
        it('should set provider config with valid parameters', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:setProviderConfig');

            (multiLLMOrchestrator.setProviderConfig as MockFn).mockReturnValue(undefined);

            const config = {
                maxConcurrent: 5,
                priority: 10,
                rateLimitPerMinute: 100
            };

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai', config);

            expect(multiLLMOrchestrator.setProviderConfig).toHaveBeenCalledWith('openai', config);
            expect(result).toMatchObject({
                success: true,
                data: { success: true }
            });
        });

        it('should reject non-string provider', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:setProviderConfig');

            const config = {
                maxConcurrent: 5,
                priority: 10,
                rateLimitPerMinute: 100
            };

            const result = await handler?.({} as IpcMainInvokeEvent, 123, config);

            expect(multiLLMOrchestrator.setProviderConfig).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'Provider must be a string'
            });
        });

        it('should reject invalid maxConcurrent', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:setProviderConfig');

            const config = {
                maxConcurrent: 0,
                priority: 10,
                rateLimitPerMinute: 100
            };

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai', config);

            expect(multiLLMOrchestrator.setProviderConfig).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'maxConcurrent must be a positive number'
            });
        });

        it('should reject non-number maxConcurrent', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:setProviderConfig');

            const config = {
                maxConcurrent: 'invalid' as never,
                priority: 10,
                rateLimitPerMinute: 100
            };

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai', config);

            expect(multiLLMOrchestrator.setProviderConfig).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'maxConcurrent must be a positive number'
            });
        });

        it('should reject non-number priority', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:setProviderConfig');

            const config = {
                maxConcurrent: 5,
                priority: 'high' as never,
                rateLimitPerMinute: 100
            };

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai', config);

            expect(multiLLMOrchestrator.setProviderConfig).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'priority must be a number'
            });
        });

        it('should reject invalid rateLimitPerMinute', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:setProviderConfig');

            const config = {
                maxConcurrent: 5,
                priority: 10,
                rateLimitPerMinute: -1
            };

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai', config);

            expect(multiLLMOrchestrator.setProviderConfig).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'rateLimitPerMinute must be a positive number'
            });
        });

        it('should reject non-number rateLimitPerMinute', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('collaboration:setProviderConfig');

            const config = {
                maxConcurrent: 5,
                priority: 10,
                rateLimitPerMinute: 'unlimited' as never
            };

            const result = await handler?.({} as IpcMainInvokeEvent, 'openai', config);

            expect(multiLLMOrchestrator.setProviderConfig).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: false,
                error: 'rateLimitPerMinute must be a positive number'
            });
        });
    });
});
