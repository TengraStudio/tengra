import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
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
import { registerLlamaIpc } from '@main/ipc/llama';
import type { LlamaService } from '@main/services/llm/llama.service';

describe('Llama IPC Handlers', () => {
    const ipcMainHandlers = new Map<string, CallableFunction>();
    let mockLlamaService: LlamaService;
    let mockEvent: IpcMainInvokeEvent;

    beforeEach(() => {
        vi.clearAllMocks();
        ipcMainHandlers.clear();

        // Capture IPC handlers
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: CallableFunction) => {
            ipcMainHandlers.set(channel, handler);
            return { channels: [channel] } as never as Electron.IpcMain;
        });

        // Mock Llama service
        mockLlamaService = {
            loadModel: vi.fn().mockResolvedValue({ success: true }),
            stopServer: vi.fn().mockResolvedValue(undefined),
            chat: vi.fn().mockResolvedValue({ success: true, content: 'Response' }),
            resetSession: vi.fn().mockResolvedValue(undefined),
            getModels: vi.fn().mockResolvedValue([]),
            downloadModel: vi.fn().mockResolvedValue({ success: true }),
            deleteModel: vi.fn().mockResolvedValue({ success: true }),
            getConfig: vi.fn().mockReturnValue({}),
            setConfig: vi.fn(),
            getGpuInfo: vi.fn().mockResolvedValue({ hasGpu: true }),
            getModelsDir: vi.fn().mockReturnValue('/path/to/models')
        } as never as LlamaService;

        mockEvent = {} as IpcMainInvokeEvent;

        registerLlamaIpc(() => null, mockLlamaService);
    });

    describe('llama:loadModel', () => {
        it('should load model with valid path', async () => {
            const handler = ipcMainHandlers.get('llama:loadModel');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, '/path/to/model.gguf', {});

            expect(mockLlamaService.loadModel).toHaveBeenCalledWith('/path/to/model.gguf', {});
            expect(result).toEqual({ success: true });
        });

        it('should load model with config parameters', async () => {
            const handler = ipcMainHandlers.get('llama:loadModel');
            const config = { threads: 4, contextSize: 2048 };

            await handler!(mockEvent, '/models/llama.gguf', config);

            expect(mockLlamaService.loadModel).toHaveBeenCalledWith('/models/llama.gguf', config);
        });

        it('should reject invalid model path', async () => {
            const handler = ipcMainHandlers.get('llama:loadModel');

            await expect(handler!(mockEvent, '', {})).rejects.toThrow('Invalid model path');
            await expect(handler!(mockEvent, null, {})).rejects.toThrow('Invalid model path');
            await expect(handler!(mockEvent, 123, {})).rejects.toThrow('Invalid model path');
        });

        it('should reject model paths exceeding max length', async () => {
            const handler = ipcMainHandlers.get('llama:loadModel');
            const longPath = '/'.repeat(5000);

            await expect(handler!(mockEvent, longPath, {})).rejects.toThrow('Invalid model path');
        });

        it('should use empty config for invalid config parameter', async () => {
            const handler = ipcMainHandlers.get('llama:loadModel');

            await handler!(mockEvent, '/path/to/model.gguf', 'invalid-config');

            expect(mockLlamaService.loadModel).toHaveBeenCalledWith('/path/to/model.gguf', {});
        });
    });

    describe('llama:unloadModel', () => {
        it('should unload model successfully', async () => {
            const handler = ipcMainHandlers.get('llama:unloadModel');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(mockLlamaService.stopServer).toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        it('should return default value on error', async () => {
            const handler = ipcMainHandlers.get('llama:unloadModel');
            vi.mocked(mockLlamaService.stopServer).mockRejectedValue(new Error('Stop failed'));

            const result = await handler!(mockEvent);

            expect(result).toEqual({ success: false });
        });
    });

    describe('llama:chat', () => {
        it('should chat with valid message', async () => {
            const handler = ipcMainHandlers.get('llama:chat');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 'Hello, world!', undefined);

            expect(mockLlamaService.chat).toHaveBeenCalledWith('Hello, world!', undefined);
            expect(result).toEqual({ success: true, response: { success: true, content: 'Response' } });
        });

        it('should chat with system prompt', async () => {
            const handler = ipcMainHandlers.get('llama:chat');

            await handler!(mockEvent, 'User message', 'You are a helpful assistant');

            expect(mockLlamaService.chat).toHaveBeenCalledWith('User message', 'You are a helpful assistant');
        });

        it('should reject empty messages', async () => {
            const handler = ipcMainHandlers.get('llama:chat');

            const result = await handler!(mockEvent, '', undefined);

            expect(result).toEqual({ success: false, response: { success: false } });
        });

        it('should reject messages exceeding max length (100KB)', async () => {
            const handler = ipcMainHandlers.get('llama:chat');
            const longMessage = 'a'.repeat(101 * 1024);

            const result = await handler!(mockEvent, longMessage, undefined);

            expect(result).toEqual({ success: false, response: { success: false } });
        });

        it('should truncate system prompts exceeding max length (50KB)', async () => {
            const handler = ipcMainHandlers.get('llama:chat');
            const longPrompt = 'a'.repeat(51 * 1024);

            await handler!(mockEvent, 'Message', longPrompt);

            const calls = vi.mocked(mockLlamaService.chat).mock.calls;
            expect(calls[0][1]).toHaveLength(50 * 1024);
        });

        it('should return default value on service error', async () => {
            const handler = ipcMainHandlers.get('llama:chat');
            vi.mocked(mockLlamaService.chat).mockRejectedValue(new Error('Chat failed'));

            const result = await handler!(mockEvent, 'Message', undefined);

            expect(result).toEqual({ success: false, response: { success: false } });
        });
    });

    describe('llama:resetSession', () => {
        it('should reset session successfully', async () => {
            const handler = ipcMainHandlers.get('llama:resetSession');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(mockLlamaService.resetSession).toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        it('should return default value on error', async () => {
            const handler = ipcMainHandlers.get('llama:resetSession');
            vi.mocked(mockLlamaService.resetSession).mockRejectedValue(new Error('Reset failed'));

            const result = await handler!(mockEvent);

            expect(result).toEqual({ success: false });
        });
    });

    describe('llama:getModels', () => {
        it('should get models list', async () => {
            const handler = ipcMainHandlers.get('llama:getModels');
            expect(handler).toBeDefined();

            vi.mocked(mockLlamaService.getModels).mockResolvedValue([
                { name: 'model1.gguf', path: '/models/model1.gguf', size: 1024, loaded: false },
                { name: 'model2.gguf', path: '/models/model2.gguf', size: 2048, loaded: false }
            ]);

            const result = await handler!(mockEvent);

            expect(mockLlamaService.getModels).toHaveBeenCalled();
            expect(result).toEqual([
                { name: 'model1.gguf', path: '/models/model1.gguf', size: 1024, loaded: false },
                { name: 'model2.gguf', path: '/models/model2.gguf', size: 2048, loaded: false }
            ]);
        });

        it('should return empty array on error', async () => {
            const handler = ipcMainHandlers.get('llama:getModels');
            vi.mocked(mockLlamaService.getModels).mockRejectedValue(new Error('Failed to get models'));

            const result = await handler!(mockEvent);

            expect(result).toEqual([]);
        });
    });

    describe('llama:downloadModel', () => {
        it('should download model with valid URL and filename', async () => {
            const handler = ipcMainHandlers.get('llama:downloadModel');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 'https://example.com/model.gguf', 'model.gguf');

            expect(mockLlamaService.downloadModel).toHaveBeenCalledWith('https://example.com/model.gguf', 'model.gguf');
            expect(result).toEqual({ success: true });
        });

        it('should reject invalid URLs', async () => {
            const handler = ipcMainHandlers.get('llama:downloadModel');

            await expect(handler!(mockEvent, 'not-a-url', 'model.gguf')).rejects.toThrow('Invalid URL or filename');
            await expect(handler!(mockEvent, '', 'model.gguf')).rejects.toThrow('Invalid URL or filename');
        });

        it('should reject invalid filenames', async () => {
            const handler = ipcMainHandlers.get('llama:downloadModel');

            await expect(handler!(mockEvent, 'https://example.com/model.gguf', '')).rejects.toThrow('Invalid URL or filename');
            await expect(handler!(mockEvent, 'https://example.com/model.gguf', null)).rejects.toThrow('Invalid URL or filename');
        });

        it('should reject filenames exceeding max length (255)', async () => {
            const handler = ipcMainHandlers.get('llama:downloadModel');
            const longFilename = 'a'.repeat(300) + '.gguf';

            await expect(handler!(mockEvent, 'https://example.com/model.gguf', longFilename))
                .rejects.toThrow('Invalid URL or filename');
        });
    });

    describe('llama:deleteModel', () => {
        it('should delete model with valid path', async () => {
            const handler = ipcMainHandlers.get('llama:deleteModel');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, '/path/to/model.gguf');

            expect(mockLlamaService.deleteModel).toHaveBeenCalledWith('/path/to/model.gguf');
            expect(result).toEqual({ success: true });
        });

        it('should reject invalid paths', async () => {
            const handler = ipcMainHandlers.get('llama:deleteModel');

            await expect(handler!(mockEvent, '')).rejects.toThrow('Invalid model path');
            await expect(handler!(mockEvent, null)).rejects.toThrow('Invalid model path');
        });
    });

    describe('llama:getConfig', () => {
        it('should get current config', async () => {
            const handler = ipcMainHandlers.get('llama:getConfig');
            expect(handler).toBeDefined();

            vi.mocked(mockLlamaService.getConfig).mockReturnValue({ threads: 8, contextSize: 4096 });

            const result = await handler!(mockEvent);

            expect(mockLlamaService.getConfig).toHaveBeenCalled();
            expect(result).toEqual({ threads: 8, contextSize: 4096 });
        });

        it('should return empty object on error', async () => {
            const handler = ipcMainHandlers.get('llama:getConfig');
            vi.mocked(mockLlamaService.getConfig).mockImplementation(() => {
                throw new Error('Config error');
            });

            const result = await handler!(mockEvent);

            expect(result).toEqual({});
        });
    });

    describe('llama:setConfig', () => {
        it('should set config with valid parameters', async () => {
            const handler = ipcMainHandlers.get('llama:setConfig');
            expect(handler).toBeDefined();

            const config = { threads: 4, contextSize: 2048 };
            const result = await handler!(mockEvent, config);

            expect(mockLlamaService.setConfig).toHaveBeenCalledWith(config);
            expect(result).toEqual({ success: true });
        });

        it('should use empty config for invalid parameters', async () => {
            const handler = ipcMainHandlers.get('llama:setConfig');

            await handler!(mockEvent, 'invalid-config');

            expect(mockLlamaService.setConfig).toHaveBeenCalledWith({});
        });

        it('should return default value on error', async () => {
            const handler = ipcMainHandlers.get('llama:setConfig');
            vi.mocked(mockLlamaService.setConfig).mockImplementation(() => {
                throw new Error('Set config failed');
            });

            const result = await handler!(mockEvent, { threads: 4 });

            expect(result).toEqual({ success: false });
        });
    });

    describe('llama:getGpuInfo', () => {
        it('should get GPU information', async () => {
            const handler = ipcMainHandlers.get('llama:getGpuInfo');
            expect(handler).toBeDefined();

            vi.mocked(mockLlamaService.getGpuInfo).mockResolvedValue({
                available: true,
                backends: ['cuda'],
                name: 'NVIDIA RTX 3080'
            });

            const result = await handler!(mockEvent);

            expect(mockLlamaService.getGpuInfo).toHaveBeenCalled();
            expect(result).toEqual({ available: true, backends: ['cuda'], name: 'NVIDIA RTX 3080' });
        });

        it('should return null on error', async () => {
            const handler = ipcMainHandlers.get('llama:getGpuInfo');
            vi.mocked(mockLlamaService.getGpuInfo).mockRejectedValue(new Error('GPU check failed'));

            const result = await handler!(mockEvent);

            expect(result).toBeNull();
        });
    });

    describe('llama:getModelsDir', () => {
        it('should get models directory path', async () => {
            const handler = ipcMainHandlers.get('llama:getModelsDir');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(mockLlamaService.getModelsDir).toHaveBeenCalled();
            expect(result).toBe('/path/to/models');
        });

        it('should return empty string on error', async () => {
            const handler = ipcMainHandlers.get('llama:getModelsDir');
            vi.mocked(mockLlamaService.getModelsDir).mockImplementation(() => {
                throw new Error('Get dir failed');
            });

            const result = await handler!(mockEvent);

            expect(result).toBe('');
        });
    });
});
