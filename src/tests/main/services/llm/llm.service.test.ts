/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LLMService } from '@main/services/llm/llm.service';
import { ChatMessage } from '@main/types/llm.types';
import { ApiError, AuthenticationError, ValidationError } from '@shared/utils/error.util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { en } from '../../../../renderer/i18n/locales';

const mockImagePersistence = {
    saveImage: vi.fn().mockResolvedValue('/tmp/image.png')
};

const globalFetch = vi.fn();
global.fetch = globalFetch;

const mockHttpService = {
    get: vi.fn(),
    post: vi.fn(),
    fetch: vi.fn()
};
const mockConfigService = { get: vi.fn().mockReturnValue('') };
const mockKeyRotationService = {
    getApiKey: vi.fn(),
    initializeProviderKeys: vi.fn(),
    getCurrentKey: vi.fn().mockReturnValue(null),
    rotateKey: vi.fn()
};
const mockHuggingFaceService = {
    searchModels: vi.fn(),
    getModelVersions: vi.fn(),
};
const mockLlamaService = {
    getLoadedModel: vi.fn().mockReturnValue(null),
    isServerRunning: vi.fn().mockResolvedValue(false),
    loadModel: vi.fn().mockResolvedValue({ success: true }),
    getConfig: vi.fn().mockReturnValue({ host: '127.0.0.1', port: 8080 }),
};
const mockTokenService = {
    ensureFreshToken: vi.fn().mockResolvedValue(undefined),
};
const mockCacheService = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    delete: vi.fn()
};

describe('LLMService', () => {
    let service: LLMService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockLlamaService.getLoadedModel.mockReturnValue(null);
        mockLlamaService.isServerRunning.mockResolvedValue(false);
        mockLlamaService.loadModel.mockResolvedValue({ success: true });
        mockLlamaService.getConfig.mockReturnValue({ host: '127.0.0.1', port: 8080 });
        type LlmDeps = ConstructorParameters<typeof LLMService>[0];
        service = new LLMService({
            httpService: mockHttpService as never as LlmDeps['httpService'],
            configService: mockConfigService as never as LlmDeps['configService'],
            keyRotationService: mockKeyRotationService as never as LlmDeps['keyRotationService'],
            settingsService: { getSettings: vi.fn().mockReturnValue({}) } as never as LlmDeps['settingsService'],
            authService: { getActiveToken: vi.fn().mockResolvedValue(null) } as never as LlmDeps['authService'],
            proxyService: { getEmbeddedProxyStatus: vi.fn().mockReturnValue({}), getProxyKey: vi.fn().mockResolvedValue('test-key') } as never as LlmDeps['proxyService'],
            tokenService: mockTokenService as never as LlmDeps['tokenService'],
            huggingFaceService: mockHuggingFaceService as never as LlmDeps['huggingFaceService'],
            llamaService: mockLlamaService as never as LlmDeps['llamaService'],
            fallbackService: { route: vi.fn(), getChain: vi.fn().mockReturnValue([]) } as never as LlmDeps['fallbackService'],
            cacheService: mockCacheService as never as LlmDeps['cacheService']
        });
        (service as never as { imagePersistence: TestValue }).imagePersistence = mockImagePersistence;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('chatOpenAI', () => {
        it('should throw AuthenticationError if API key is missing', async () => {
            await expect(service.chatOpenAI([])).rejects.toThrow(AuthenticationError);
        });

        it('should throw ValidationError when message content is invalid', async () => {
            service.setOpenAIApiKey('sk-test');
            const invalidMessages = [{ role: 'user' }] as never as ChatMessage[];
            await expect(service.chatOpenAI(invalidMessages)).rejects.toThrow(ValidationError);
        });

        it('should make correct API call and parse response', async () => {
            service.setOpenAIApiKey('sk-test');

            const mockResponse = {
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: 'Hello world',
                            role: 'assistant'
                        }
                    }],
                    usage: { completion_tokens: 10 }
                })
            };
            mockHttpService.fetch.mockResolvedValue(mockResponse);

            const messages: ChatMessage[] = [{ role: 'user', content: 'Hi' }];
            const response = await service.chatOpenAI(messages);

            expect(response.content).toBe('Hello world');
            expect(response.role).toBe('assistant');
            expect(mockHttpService.fetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer sk-test'
                    })
                })
            );
            expect(service.getHealthMetrics()).toMatchObject({
                openAiRequests: 1,
                openAiFailures: 0,
                status: 'healthy',
            });
        });

        it('should throw ApiError on non-ok response', async () => {
            service.setOpenAIApiKey('sk-test');

            mockHttpService.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error'
            });

            await expect(service.chatOpenAI([])).rejects.toMatchObject({
                code: 'API_ERROR',
                context: expect.objectContaining({
                    code: 'LLM_OPENAI_HTTP_FAILURE',
                }),
            });
            expect(service.getHealthMetrics()).toMatchObject({
                openAiRequests: 1,
                openAiFailures: 1,
                status: 'degraded',
            });
        });

        it('should surface unauthorized responses without JS-side refresh retry', async () => {
            service.setOpenAIApiKey('sk-test');
            // Mock auth token for codex to pass LLMService key check
            const mockAuthService = (service as any).deps.authService;
            vi.mocked(mockAuthService.getActiveToken).mockResolvedValueOnce('mock-codex-key');

            mockHttpService.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized',
            });

            await expect(service.chatOpenAI([{ role: 'user', content: 'Hi' }], {
                provider: 'codex',
            })).rejects.toThrow(ApiError);

            expect(mockTokenService.ensureFreshToken).not.toHaveBeenCalled();
            expect(mockHttpService.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('chatAnthropic', () => {
        it('should throw AuthenticationError if API key is missing', async () => {
            await expect(service.chatAnthropic([])).rejects.toThrow(AuthenticationError);
        });
    });

    describe('chat (routing)', () => {
        it('should return cached response without calling route handlers', async () => {
            const cached = { content: 'From cache', role: 'assistant' } as const;
            mockCacheService.get.mockResolvedValueOnce(cached);

            const response = await service.chat([{ role: 'user', content: 'Hi' }], 'gpt-4o');

            expect(response).toEqual(cached);
            expect(mockHttpService.fetch).not.toHaveBeenCalled();
            expect(mockCacheService.set).not.toHaveBeenCalled();
        });

        it('should route codex provider to proxy', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Proxy response', role: 'assistant' } }],
                    usage: { completion_tokens: 5 }
                })
            };
            mockHttpService.fetch.mockResolvedValue(mockResponse);

            const messages: ChatMessage[] = [{ role: 'user', content: 'Hi' }];
            await service.chat(messages, 'gpt-4o', undefined, 'codex');

            expect(mockHttpService.fetch).toHaveBeenCalledWith(
                expect.stringContaining('http://127.0.0.1:8317/v1/chat/completions'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    }),
                    body: expect.stringContaining('"provider":"codex"'),
                })
            );
        });

        it('should route kimi provider to moonshot openai-compatible endpoint', async () => {
            mockKeyRotationService.getCurrentKey.mockImplementation((provider: string) =>
                provider === 'kimi' ? 'kimi-key' : null
            );
            mockHttpService.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Kimi response', role: 'assistant' } }],
                    usage: { completion_tokens: 4 }
                })
            });

            await service.chat([{ role: 'user', content: 'Hi' }], 'kimi-k2', undefined, 'kimi');

            expect(mockHttpService.fetch).toHaveBeenCalledWith(
                'https://api.moonshot.ai/v1/chat/completions',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer kimi-key'
                    }),
                })
            );
        });

        it('should route cursor provider to proxy compatibility path', async () => {
            mockHttpService.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Cursor compatibility response', role: 'assistant' } }],
                    usage: { completion_tokens: 2 }
                })
            });

            await service.chat([{ role: 'user', content: 'Hi' }], 'cursor/gpt-4o', undefined, 'cursor');

            expect(mockHttpService.fetch).toHaveBeenCalledWith(
                'http://127.0.0.1:8317/v1/chat/completions',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    }),
                    body: expect.stringContaining('"provider":"cursor"'),
                })
            );
        });

        it('should cache uncached chat responses as regression coverage for routing flow', async () => {
            mockCacheService.get.mockResolvedValueOnce(null);
            mockHttpService.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Fresh response', role: 'assistant' } }],
                    usage: { completion_tokens: 3 },
                }),
            });

            const response = await service.chat([{ role: 'user', content: 'Hi' }], 'gpt-4o');

            expect(response.content).toBe('Fresh response');
            expect(mockCacheService.set).toHaveBeenCalledTimes(1);
        });

        it('should route locally installed Hugging Face models via llama.cpp', async () => {
            mockCacheService.get.mockResolvedValueOnce(null);
            mockHuggingFaceService.getModelVersions.mockResolvedValueOnce([
                {
                    versionId: 'v1',
                    modelId: 'lmstudio-community/gemma-4-E4B-it-GGUF',
                    path: 'C:\\models\\gemma-4-E4B-it-Q4_K_M.gguf',
                    createdAt: Date.now(),
                }
            ]);
            mockLlamaService.getLoadedModel.mockReturnValueOnce(null);
            mockLlamaService.isServerRunning.mockResolvedValueOnce(false);
            mockLlamaService.loadModel.mockResolvedValueOnce({ success: true });
            mockHttpService.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Local HF response', role: 'assistant' } }],
                    usage: { completion_tokens: 9 }
                })
            });

            const response = await service.chat(
                [{ role: 'user', content: 'Hi' }],
                'lmstudio-community/gemma-4-E4B-it-GGUF',
                undefined,
                'huggingface'
            );

            expect(response.content).toBe('Local HF response');
            expect(mockHuggingFaceService.getModelVersions).toHaveBeenCalledWith('lmstudio-community/gemma-4-E4B-it-GGUF');
            expect(mockLlamaService.loadModel).toHaveBeenCalledWith('C:\\models\\gemma-4-E4B-it-Q4_K_M.gguf');
            expect(mockHttpService.fetch).toHaveBeenCalledWith(
                'http://127.0.0.1:8080/v1/chat/completions',
                expect.objectContaining({
                    body: expect.stringContaining('"provider":"huggingface"'),
                })
            );
            expect(mockHttpService.fetch).toHaveBeenCalledWith(
                'http://127.0.0.1:8080/v1/chat/completions',
                expect.objectContaining({
                    body: expect.stringContaining('"max_tokens":16384'),
                })
            );
        });
    });

    describe('getEmbeddings', () => {
        it('should throw ValidationError when embedding input is blank', async () => {
            await expect(service.getEmbeddings('   ')).rejects.toThrow(ValidationError);
        });
    });

    describe('health metrics', () => {
        it('should expose budgets, normalized ui states and i18n message keys', async () => {
            const emptyMetrics = service.getHealthMetrics();
            expect(emptyMetrics.uiState).toBe('empty');
            expect(emptyMetrics.performanceBudget.chatCompletionMs).toBe(30000);
            expect(en.frontend.serviceHealth.llm.empty).toBe(emptyMetrics.messageKey);

            service.setOpenAIApiKey('sk-test');
            mockHttpService.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            });
            await expect(service.chatOpenAI([{ role: 'user', content: 'Hi' }])).rejects.toThrow(ApiError);

            const failureMetrics = service.getHealthMetrics();
            expect(failureMetrics.uiState).toBe('failure');
            expect(en.frontend.serviceHealth.llm.failure).toBe(failureMetrics.messageKey);
        });
    });

    describe('provider availability', () => {
        it('should include kimi when kimi key is configured', async () => {
            service.setKimiApiKey('kimi-key');
            const providers = await service.getAvailableProviders();
            expect(providers).toContain('kimi');
        });

        it('should include cursor when proxy key is available', async () => {
            const providers = await service.getAvailableProviders();
            expect(providers).toContain('cursor');
        });
    });
});

