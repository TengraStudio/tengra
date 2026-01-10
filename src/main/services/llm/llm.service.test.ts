
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMService } from './llm.service';
import { ChatMessage } from '../../types/llm.types';
import { ApiError, AuthenticationError } from '../../utils/error.util';

// Mock dependencies


const mockImagePersistence = {
    saveImage: vi.fn().mockResolvedValue('/tmp/image.png')
};

// Mock fetch global
const globalFetch = vi.fn();
global.fetch = globalFetch;

const mockHttpService = { get: vi.fn(), post: vi.fn() };
const mockConfigService = { get: vi.fn() };
const mockKeyRotationService = { getApiKey: vi.fn() };
const mockRateLimitService = { checkRateLimit: vi.fn() };

describe('LLMService', () => {
    let service: LLMService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new LLMService(
            mockHttpService as any,
            mockConfigService as any,
            mockKeyRotationService as any,
            mockRateLimitService as any
        );
        // Inject mock image persistence (private property hack for testing)
        (service as any).imagePersistence = mockImagePersistence;
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
            globalFetch.mockResolvedValue(mockResponse);

            const messages: ChatMessage[] = [{ role: 'user', content: 'Hi' }];
            const response = await service.chatOpenAI(messages);

            expect(response.content).toBe('Hello world');
            expect(response.role).toBe('assistant');
            expect(globalFetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer sk-test'
                    })
                })
            );
        });

        it('should throw ApiError on non-ok response', async () => {
            service.setOpenAIApiKey('sk-test');

            globalFetch.mockResolvedValue({
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
});
