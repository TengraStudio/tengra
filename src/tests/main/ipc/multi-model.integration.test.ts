import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: vi.fn((_name, handler) => handler)
}));

vi.mock('@main/utils/rate-limiter.util', () => ({
    withRateLimit: vi.fn(async (_key, fn) => await fn())
}));

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn()
    }
}));

// Import after mocks
import { registerMultiModelIpc } from '@main/ipc/multi-model';
import type { MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service';

describe('Multi-Model IPC Handlers', () => {
    const ipcMainHandlers = new Map<string, CallableFunction>();
    let mockComparisonService: MultiModelComparisonService;
    let mockEvent: IpcMainInvokeEvent;

    beforeEach(() => {
        vi.clearAllMocks();
        ipcMainHandlers.clear();

        // Capture IPC handlers
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: CallableFunction) => {
            ipcMainHandlers.set(channel, handler);
            return { channels: [channel] } as unknown as Electron.IpcMain;
        });

        // Mock comparison service
        mockComparisonService = {
            compareModels: vi.fn().mockResolvedValue({
                results: [],
                timing: { total: 1000 }
            })
        } as unknown as MultiModelComparisonService;

        mockEvent = {} as IpcMainInvokeEvent;

        registerMultiModelIpc(mockComparisonService);
    });

    describe('llm:compare-models', () => {
        it('should compare models with valid request', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');
            expect(handler).toBeDefined();

            const request = {
                chatId: 'chat-123',
                messages: [{ role: 'user', content: 'Hello' }],
                models: [
                    { provider: 'openai', model: 'gpt-4' },
                    { provider: 'anthropic', model: 'claude-3' }
                ]
            };

            vi.mocked(mockComparisonService.compareModels).mockResolvedValue({
                success: true,
                result: {
                    results: {
                        'openai': { success: true, data: { content: 'Hi from GPT-4', role: 'assistant' } },
                        'anthropic': { success: true, data: { content: 'Hi from Claude', role: 'assistant' } }
                    }
                }
            });

            const result = await handler!(mockEvent, request);

            expect(mockComparisonService.compareModels).toHaveBeenCalledWith(request);
            expect(result.result?.results).toBeDefined();
        });

        it('should reject invalid request object', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            await expect(handler!(mockEvent, null)).rejects.toThrow('Invalid comparison request');
            await expect(handler!(mockEvent, 'not an object')).rejects.toThrow('Invalid comparison request');
            await expect(handler!(mockEvent, 123)).rejects.toThrow('Invalid comparison request');
        });

        it('should reject missing chatId', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            const request = {
                messages: [{ role: 'user', content: 'Hello' }],
                models: [{ provider: 'openai', model: 'gpt-4' }]
            };

            await expect(handler!(mockEvent, request)).rejects.toThrow('Invalid comparison request');
        });

        it('should reject invalid chatId', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            const request = {
                chatId: '',
                messages: [{ role: 'user', content: 'Hello' }],
                models: [{ provider: 'openai', model: 'gpt-4' }]
            };

            await expect(handler!(mockEvent, request)).rejects.toThrow('Invalid comparison request');
        });

        it('should reject chatId exceeding max length (128)', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            const request = {
                chatId: 'a'.repeat(200),
                messages: [{ role: 'user', content: 'Hello' }],
                models: [{ provider: 'openai', model: 'gpt-4' }]
            };

            await expect(handler!(mockEvent, request)).rejects.toThrow('Invalid comparison request');
        });

        it('should reject missing messages array', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            const request = {
                chatId: 'chat-123',
                models: [{ provider: 'openai', model: 'gpt-4' }]
            };

            await expect(handler!(mockEvent, request)).rejects.toThrow('Invalid comparison request');
        });

        it('should reject missing models array', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            const request = {
                chatId: 'chat-123',
                messages: [{ role: 'user', content: 'Hello' }]
            };

            await expect(handler!(mockEvent, request)).rejects.toThrow('Invalid comparison request');
        });

        it('should reject empty models array', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            const request = {
                chatId: 'chat-123',
                messages: [{ role: 'user', content: 'Hello' }],
                models: []
            };

            await expect(handler!(mockEvent, request)).rejects.toThrow('Invalid comparison request');
        });

        it('should reject models array exceeding max count (10)', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            const models = Array.from({ length: 15 }, (_, i) => ({
                provider: `provider${i}`,
                model: `model${i}`
            }));

            const request = {
                chatId: 'chat-123',
                messages: [{ role: 'user', content: 'Hello' }],
                models
            };

            await expect(handler!(mockEvent, request)).rejects.toThrow('Invalid comparison request');
        });

        it('should filter out invalid model entries', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            const request = {
                chatId: 'chat-123',
                messages: [{ role: 'user', content: 'Hello' }],
                models: [
                    { provider: 'openai', model: 'gpt-4' },
                    { provider: 'invalid' }, // Missing model
                    { model: 'gpt-3' }, // Missing provider
                    'not-an-object', // Invalid type
                    { provider: 'anthropic', model: 'claude-3' }
                ]
            };

            await handler!(mockEvent, request);

            const calls = vi.mocked(mockComparisonService.compareModels).mock.calls;
            expect(calls[0][0].models).toHaveLength(2);
            expect(calls[0][0].models).toEqual([
                { provider: 'openai', model: 'gpt-4' },
                { provider: 'anthropic', model: 'claude-3' }
            ]);
        });

        it('should reject when all models are invalid', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');

            const request = {
                chatId: 'chat-123',
                messages: [{ role: 'user', content: 'Hello' }],
                models: [
                    { provider: 'invalid' }, // Missing model
                    { model: 'gpt-3' }, // Missing provider
                    'not-an-object' // Invalid type
                ]
            };

            await expect(handler!(mockEvent, request)).rejects.toThrow('Invalid comparison request');
        });

        it('should apply rate limiting', async () => {
            const handler = ipcMainHandlers.get('llm:compare-models');
            const { withRateLimit } = await import('@main/utils/rate-limiter.util');

            const request = {
                chatId: 'chat-123',
                messages: [{ role: 'user', content: 'Hello' }],
                models: [{ provider: 'openai', model: 'gpt-4' }]
            };

            await handler!(mockEvent, request);

            expect(withRateLimit).toHaveBeenCalledWith('llm', expect.any(Function));
        });
    });
});
