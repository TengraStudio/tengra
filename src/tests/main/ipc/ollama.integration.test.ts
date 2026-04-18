/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));


vi.mock('@main/startup/ollama', () => ({
    startOllama: vi.fn().mockResolvedValue({
        success: true,
        message: 'Started',
        messageKey: 'images.ollamaStartup.started'
    })
}));

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn()
    },
    BrowserWindow: {
        getAllWindows: vi.fn()
    }
}));

// Import after mocks
import { registerOllamaIpc } from '@main/ipc/ollama';
import type { LLMService } from '@main/services/llm/llm.service';
import type { LocalAIService } from '@main/services/llm/local-ai.service';
import type { OllamaService } from '@main/services/llm/ollama.service';
import type { OllamaHealthService } from '@main/services/llm/ollama-health.service';
import type { ProxyService } from '@main/services/proxy/proxy.service';
import type { SettingsService } from '@main/services/system/settings.service';
import { SESSION_CONVERSATION_CHANNELS } from '@shared/constants/ipc-channels';

describe('Ollama IPC Handlers', () => {
    const ipcMainHandlers = new Map<string, CallableFunction>();
    let mockLocalAIService: LocalAIService;
    let mockOllamaService: OllamaService;
    let mockOllamaHealthService: OllamaHealthService;
    let mockSettingsService: SettingsService;
    let mockLLMService: LLMService;
    let mockProxyService: ProxyService;
    let mockEvent: IpcMainInvokeEvent;
    let mockWindow: BrowserWindow;

    beforeEach(() => {
        vi.clearAllMocks();
        ipcMainHandlers.clear();

        // Capture IPC handlers
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: CallableFunction) => {
            ipcMainHandlers.set(channel, handler);
            return { channels: [channel] } as never as Electron.IpcMain;
        });

        // Mock window
        mockWindow = {
            isDestroyed: vi.fn().mockReturnValue(false),
            webContents: {
                send: vi.fn()
            }
        } as never as BrowserWindow;

        vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow]);

        // Mock services
        mockLocalAIService = {
            checkCudaSupport: vi.fn().mockResolvedValue({ hasCuda: false }),
            ollamaChat: vi.fn().mockResolvedValue({ message: { content: 'Response', role: 'assistant' } })
        } as never as LocalAIService;

        mockOllamaService = {
            pullModel: vi.fn().mockResolvedValue({ success: true }),
            abort: vi.fn(),
            getLibraryModels: vi.fn().mockResolvedValue([]),
            chat: vi.fn().mockResolvedValue({ message: { content: 'Response', role: 'assistant' } }),
            chatStream: vi.fn().mockImplementation(async (_messages, _model, _tools, onChunk) => {
                if (onChunk) {
                    onChunk('Response');
                }
                return { content: 'Response' };
            }),
            onGPUAlert: vi.fn(),
            onGPUStatus: vi.fn(),
            startGPUMonitoring: vi.fn(),
            stopGPUMonitoring: vi.fn(),
            setGPUAlertThresholds: vi.fn(),
            getGPUAlertThresholds: vi.fn().mockResolvedValue({ highMemoryPercent: 90, highTemperatureC: 85, lowMemoryMB: 500 }),
            checkModelHealth: vi.fn(),
            checkAllModelsHealth: vi.fn(),
            getModelRecommendations: vi.fn(),
            getRecommendedModelForTask: vi.fn(),
            getConnectionStatus: vi.fn(),
            testConnection: vi.fn(),
            reconnect: vi.fn(),
            getGPUInfo: vi.fn()
        } as never as OllamaService;

        mockOllamaHealthService = {
            getStatus: vi.fn().mockReturnValue({ online: true, lastCheck: new Date() }),
            forceCheck: vi.fn().mockResolvedValue({ online: true, lastCheck: new Date() }),
            on: vi.fn()
        } as never as OllamaHealthService;

        mockSettingsService = {} as SettingsService;
        mockLLMService = {} as LLMService;
        mockProxyService = {} as ProxyService;

        mockEvent = {
            sender: {
                send: vi.fn()
            }
        } as never as IpcMainInvokeEvent;

        registerOllamaIpc({
            getMainWindow: () => null,
            localAIService: mockLocalAIService,
            settingsService: mockSettingsService,
            llmService: mockLLMService,
            ollamaService: mockOllamaService,
            ollamaHealthService: mockOllamaHealthService,
            proxyService: mockProxyService
        });
    });

    describe('ollama:tags', () => {
        it('should return empty array (moved to Rust)', async () => {
            const handler = ipcMainHandlers.get('ollama:tags');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(result).toEqual([]);
        });
    });

    describe('ollama:getModels', () => {
        it('should return empty array (moved to Rust)', async () => {
            const handler = ipcMainHandlers.get('ollama:getModels');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(result).toEqual([]);
        });
    });

    describe('ollama:isRunning', () => {
        it('should check if Ollama is running', async () => {
            const handler = ipcMainHandlers.get('ollama:isRunning');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(mockOllamaHealthService.getStatus).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('should return false when offline', async () => {
            const handler = ipcMainHandlers.get('ollama:isRunning');
            vi.mocked(mockOllamaHealthService.getStatus).mockReturnValue({ online: false, lastCheck: new Date() });

            const result = await handler!(mockEvent);

            expect(result).toBe(false);
        });

        it('should return fallback value when service unavailable', async () => {
            // Re-register without health service
            ipcMainHandlers.clear();
            registerOllamaIpc({
                getMainWindow: () => null,
                localAIService: mockLocalAIService,
                settingsService: mockSettingsService,
                llmService: mockLLMService
            });

            const newHandler = ipcMainHandlers.get('ollama:isRunning');
            const result = await newHandler!(mockEvent);

            expect(result).toBe(true); // Fallback
        });
    });

    describe('ollama:healthStatus', () => {
        it('should get health status', async () => {
            const handler = ipcMainHandlers.get('ollama:healthStatus');
            expect(handler).toBeDefined();

            const status = { online: true, lastCheck: new Date('2026-02-12T10:00:00Z') };
            vi.mocked(mockOllamaHealthService.getStatus).mockReturnValue(status);

            const result = await handler!(mockEvent);

            expect(result).toEqual(status);
        });

        it('should return default when service unavailable', async () => {
            // Re-register without health service
            ipcMainHandlers.clear();
            registerOllamaIpc({
                getMainWindow: () => null,
                localAIService: mockLocalAIService,
                settingsService: mockSettingsService,
                llmService: mockLLMService
            });

            const newHandler = ipcMainHandlers.get('ollama:healthStatus');
            const result = await newHandler!(mockEvent);

            expect(result).toHaveProperty('online');
            expect(result).toHaveProperty('lastCheck');
        });
    });

    describe('ollama:forceHealthCheck', () => {
        it('should force a health check', async () => {
            const handler = ipcMainHandlers.get('ollama:forceHealthCheck');
            expect(handler).toBeDefined();

            const status = { online: true, lastCheck: new Date() };
            vi.mocked(mockOllamaHealthService.forceCheck).mockResolvedValue(status);

            const result = await handler!(mockEvent);

            expect(mockOllamaHealthService.forceCheck).toHaveBeenCalled();
            expect(result).toEqual(status);
        });
    });

    describe('ollama:checkCuda', () => {
        it('should check CUDA support', async () => {
            const handler = ipcMainHandlers.get('ollama:checkCuda');
            expect(handler).toBeDefined();

            vi.mocked(mockLocalAIService.checkCudaSupport).mockResolvedValue({ hasCuda: true, detail: 'CUDA 12.0' });

            const result = await handler!(mockEvent);

            expect(mockLocalAIService.checkCudaSupport).toHaveBeenCalled();
            expect(result).toEqual({ hasCuda: true, detail: 'CUDA 12.0' });
        });

        it('should return default value on error', async () => {
            const handler = ipcMainHandlers.get('ollama:checkCuda');
            vi.mocked(mockLocalAIService.checkCudaSupport).mockRejectedValue(new Error('CUDA check failed'));

            const result = await handler!(mockEvent);

            expect(result).toEqual({ hasCuda: false });
        });
    });

    describe('ollama:chat', () => {
        it('should chat with valid messages and model', async () => {
            const handler = ipcMainHandlers.get('ollama:chat');
            expect(handler).toBeDefined();

            const messages = [{ role: 'user' as const, content: 'Hello' }];
            const result = await handler!(mockEvent, messages, 'llama2');

            expect(mockOllamaService.chat).toHaveBeenCalledWith(messages, 'llama2');
            expect(result).toEqual({ message: { content: 'Response', role: 'assistant' } });
        });

        it('should filter invalid messages', async () => {
            const handler = ipcMainHandlers.get('ollama:chat');

            const messages = [
                { role: 'user', content: 'Valid' },
                { role: 'invalid', content: 'Bad' },
                { content: 'No role' },
                { role: 'system', content: 123 }
            ];

            const result = await handler!(mockEvent, messages, 'llama2');

            // Only first message should be valid
            expect(mockOllamaService.chat).toHaveBeenCalledWith([
                { role: 'user', content: 'Valid' }
            ], 'llama2');
            expect(result).toBeDefined();
        });

        it('should reject invalid model name', async () => {
            const handler = ipcMainHandlers.get('ollama:chat');

            const result = await handler!(mockEvent, [{ role: 'user', content: 'Hi' }], '');

            expect(result).toEqual({ message: { content: '', role: 'assistant' } });
        });

        it('should reject empty messages array', async () => {
            const handler = ipcMainHandlers.get('ollama:chat');

            const result = await handler!(mockEvent, [], 'llama2');

            expect(result).toEqual({ message: { content: '', role: 'assistant' } });
        });

        it('should return default value on error', async () => {
            const handler = ipcMainHandlers.get('ollama:chat');
            vi.mocked(mockOllamaService.chat).mockRejectedValue(new Error('Chat failed'));

            const result = await handler!(mockEvent, [{ role: 'user', content: 'Hi' }], 'llama2');

            expect(result).toEqual({ message: { content: '', role: 'assistant' } });
        });
    });

    describe('ollama:chatStream', () => {
        it('should stream chat responses', async () => {
            const handler = ipcMainHandlers.get('ollama:chatStream');
            expect(handler).toBeDefined();

            const messages = [{ role: 'user' as const, content: 'Stream test' }];
            await handler!(mockEvent, messages, 'llama2');

            expect(mockOllamaService.chatStream).toHaveBeenCalled();
            expect(mockEvent.sender.send).toHaveBeenCalledWith(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, {
                content: 'Response',
                reasoning: ''
            });
        });

        it('should return error on failure', async () => {
            const handler = ipcMainHandlers.get('ollama:chatStream');
            vi.mocked(mockOllamaService.chatStream).mockRejectedValue(new Error('Stream failed'));

            const result = await handler!(mockEvent, [{ role: 'user', content: 'Hi' }], 'llama2');

            expect(result).toHaveProperty('error');
        });
    });

    describe('ollama:pull', () => {
        it('should pull model with valid name', async () => {
            const handler = ipcMainHandlers.get('ollama:pull');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 'llama2');

            expect(mockOllamaService.pullModel).toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        it('should send progress events during pull', async () => {
            const handler = ipcMainHandlers.get('ollama:pull');

            vi.mocked(mockOllamaService.pullModel).mockImplementation(async (_name, progressCb) => {
                if (progressCb) {
                    progressCb({ status: 'downloading', completed: 50, total: 100 });
                }
                return { success: true };
            });

            await handler!(mockEvent, 'llama2');

            expect(mockWindow.webContents.send).toHaveBeenCalledWith('ollama:pullProgress', {
                status: 'downloading',
                completed: 50,
                total: 100,
                modelName: 'llama2'
            });
        });

        it('should reject invalid model names', async () => {
            const handler = ipcMainHandlers.get('ollama:pull');

            const result = await handler!(mockEvent, '');

            expect(result).toEqual({ success: false, error: 'Service unavailable' });
        });

        it('should return error when service unavailable', async () => {
            // Re-register without ollama service
            ipcMainHandlers.clear();
            registerOllamaIpc({
                getMainWindow: () => null,
                localAIService: mockLocalAIService,
                settingsService: mockSettingsService,
                llmService: mockLLMService
            });

            const newHandler = ipcMainHandlers.get('ollama:pull');
            const result = await newHandler!(mockEvent, 'llama2');

            expect(result).toEqual({ success: false, error: 'Service unavailable' });
        });
    });

    describe('ollama:abort', () => {
        it('should abort chat operation', async () => {
            const handler = ipcMainHandlers.get('ollama:abort');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(mockOllamaService.abort).toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        it('should return false when service unavailable', async () => {
            // Re-register without ollama service
            ipcMainHandlers.clear();
            registerOllamaIpc({
                getMainWindow: () => null,
                localAIService: mockLocalAIService,
                settingsService: mockSettingsService,
                llmService: mockLLMService
            });

            const newHandler = ipcMainHandlers.get('ollama:abort');
            const result = await newHandler!(mockEvent);

            expect(result).toEqual({ success: false });
        });
    });

    describe('ollama:abortPull', () => {
        it('should abort pull operation', async () => {
            const handler = ipcMainHandlers.get('ollama:abortPull');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(mockOllamaService.abort).toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        it('should return false when service unavailable', async () => {
            // Re-register without ollama service
            ipcMainHandlers.clear();
            registerOllamaIpc({
                getMainWindow: () => null,
                localAIService: mockLocalAIService,
                settingsService: mockSettingsService,
                llmService: mockLLMService
            });

            const newHandler = ipcMainHandlers.get('ollama:abortPull');
            const result = await newHandler!(mockEvent);

            expect(result).toEqual({ success: false });
        });
    });

    describe('ollama:getLibraryModels', () => {
        it('should get library models', async () => {
            const handler = ipcMainHandlers.get('ollama:getLibraryModels');
            expect(handler).toBeDefined();

            vi.mocked(mockOllamaService.getLibraryModels).mockResolvedValue([
                { name: 'llama2', description: 'A great model', tags: ['latest'] }
            ]);

            const result = await handler!(mockEvent);

            expect(mockOllamaService.getLibraryModels).toHaveBeenCalled();
            expect(result).toEqual([{ name: 'llama2', description: 'A great model', tags: ['latest'] }]);
        });
    });

    describe('ollama:start', () => {
        it('should start Ollama server', async () => {
            const handler = ipcMainHandlers.get('ollama:start');
            expect(handler).toBeDefined();

            const { startOllama } = await import('@main/startup/ollama');

            const result = await handler!(mockEvent);

            expect(startOllama).toHaveBeenCalled();
            expect(result).toEqual({
                success: true,
                message: 'Started',
                messageKey: 'images.ollamaStartup.started'
            });
        });
    });

});
