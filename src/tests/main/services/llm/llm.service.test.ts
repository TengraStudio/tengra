import { LLMService } from '@main/services/llm/llm.service';
import { ChatMessage } from '@main/types/llm.types';
import { ApiError, AuthenticationError } from '@main/utils/error.util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    getCurrentKey: vi.fn().mockReturnValue(null)
};
const mockRateLimitService = {
    checkRateLimit: vi.fn(),
    waitForToken: vi.fn().mockResolvedValue(undefined)
};
const mockHuggingFaceService = {
    searchModels: vi.fn()
};

describe('LLMService', () => {
    let service: LLMService;

    beforeEach(() => {
        vi.clearAllMocks();
        type LlmDeps = ConstructorParameters<typeof LLMService>[0];
        service = new LLMService({
            httpService: mockHttpService as unknown as LlmDeps['httpService'],
            configService: mockConfigService as unknown as LlmDeps['configService'],
            keyRotationService: mockKeyRotationService as unknown as LlmDeps['keyRotationService'],
            rateLimitService: mockRateLimitService as unknown as LlmDeps['rateLimitService'],
            settingsService: { getSettings: vi.fn().mockReturnValue({}) } as unknown as LlmDeps['settingsService'],
            proxyService: { getEmbeddedProxyStatus: vi.fn().mockReturnValue({}), getProxyKey: vi.fn().mockResolvedValue('test-key') } as unknown as LlmDeps['proxyService'],
            huggingFaceService: mockHuggingFaceService as unknown as LlmDeps['huggingFaceService'],
            fallbackService: { route: vi.fn(), getChain: vi.fn().mockReturnValue([]) } as unknown as LlmDeps['fallbackService'],
            cacheService: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), delete: vi.fn() } as unknown as LlmDeps['cacheService']
        });
        (service as unknown as { imagePersistence: unknown }).imagePersistence = mockImagePersistence;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('chatOpenAI', () => {
        it('should throw AuthenticationError if API key is missing', async () => {
            await expect(service.chatOpenAI([])).rejects.toThrow(AuthenticationError);
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
        });

        it('should throw ApiError on non-ok response', async () => {
            service.setOpenAIApiKey('sk-test');

            mockHttpService.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error'
            });

            await expect(service.chatOpenAI([])).rejects.toThrow(ApiError);
        });
    });

    describe('chatAnthropic', () => {
        it('should throw AuthenticationError if API key is missing', async () => {
            await expect(service.chatAnthropic([])).rejects.toThrow(AuthenticationError);
        });
    });

    describe('chat (routing)', () => {
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
                expect.stringContaining('http://localhost:8317/api/provider/codex/v1/chat/completions'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-key'
                    })
                })
            );
        });
    });
});
