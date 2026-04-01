import { LLMService } from '@main/services/llm/llm.service';
import { ChatMessage } from '@main/types/llm.types';
import { ApiError, AuthenticationError, ValidationError } from '@shared/utils/error.util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { en } from '../../../../renderer/i18n/en';
import { tr } from '../../../../renderer/i18n/tr';

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
const mockRateLimitService = {
    checkRateLimit: vi.fn(),
    waitForToken: vi.fn().mockResolvedValue(undefined)
};
const mockHuggingFaceService = {
    searchModels: vi.fn()
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
        type LlmDeps = ConstructorParameters<typeof LLMService>[0];
        service = new LLMService({
            httpService: mockHttpService as never as LlmDeps['httpService'],
            configService: mockConfigService as never as LlmDeps['configService'],
            keyRotationService: mockKeyRotationService as never as LlmDeps['keyRotationService'],
            rateLimitService: mockRateLimitService as never as LlmDeps['rateLimitService'],
            settingsService: { getSettings: vi.fn().mockReturnValue({}) } as never as LlmDeps['settingsService'],
            proxyService: { getEmbeddedProxyStatus: vi.fn().mockReturnValue({}), getProxyKey: vi.fn().mockResolvedValue('test-key') } as never as LlmDeps['proxyService'],
            tokenService: mockTokenService as never as LlmDeps['tokenService'],
            huggingFaceService: mockHuggingFaceService as never as LlmDeps['huggingFaceService'],
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
                expect.stringContaining('http://localhost:8317/v1/chat/completions'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    }),
                    body: expect.stringContaining('"provider":"codex"'),
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
            expect(en.serviceHealth.llm.empty).toBe(emptyMetrics.messageKey);
            expect(tr.serviceHealth.llm.empty).toBeTruthy();

            service.setOpenAIApiKey('sk-test');
            mockHttpService.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            });
            await expect(service.chatOpenAI([{ role: 'user', content: 'Hi' }])).rejects.toThrow(ApiError);

            const failureMetrics = service.getHealthMetrics();
            expect(failureMetrics.uiState).toBe('failure');
            expect(en.serviceHealth.llm.failure).toBe(failureMetrics.messageKey);
            expect(tr.serviceHealth.llm.failure).toBeTruthy();
        });
    });
});
