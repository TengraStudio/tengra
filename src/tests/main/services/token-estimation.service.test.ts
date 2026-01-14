/**
 * Unit tests for TokenEstimationService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TokenEstimationService } from '@main/services/token-estimation.service';
import { Message } from '@/types/chat';

describe('TokenEstimationService', () => {
    let service: TokenEstimationService;

    beforeEach(() => {
        service = new TokenEstimationService();
    });

    describe('estimateMessageTokens', () => {
        it('should estimate tokens for string content', () => {
            const message: Message = {
                id: '1',
                timestamp: new Date(),
                role: 'user',
                content: 'Hello, how are you doing today?'
            };

            const tokens = service.estimateMessageTokens(message);

            // ~31 chars / 4 = ~8 tokens
            expect(tokens).toBeGreaterThan(0);
            expect(tokens).toBeLessThan(15);
        });

        it('should estimate tokens for empty content', () => {
            const message: Message = {
                id: '1',
                timestamp: new Date(),
                role: 'user',
                content: ''
            };

            const tokens = service.estimateMessageTokens(message);
            expect(tokens).toBe(0);
        });

        it('should handle array content with text parts', () => {
            const message: Message = {
                id: '1',
                timestamp: new Date(),
                role: 'user',
                content: [
                    { type: 'text', text: 'First part' },
                    { type: 'text', text: 'Second part' }
                ]
            };

            const tokens = service.estimateMessageTokens(message);
            expect(tokens).toBeGreaterThan(0);
        });

        it('should ignore non-text content parts', () => {
            const message: Message = {
                id: '1',
                timestamp: new Date(),
                role: 'user',
                content: [
                    { type: 'text', text: 'Text content' },
                    { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } } as any
                ]
            };

            const tokens = service.estimateMessageTokens(message);
            expect(tokens).toBeGreaterThan(0);
        });
    });

    describe('estimateMessagesTokens', () => {
        it('should separate input and output tokens', () => {
            const messages: Message[] = [
                { id: '1', timestamp: new Date(), role: 'system', content: 'You are a helpful assistant.' },
                { id: '2', timestamp: new Date(), role: 'user', content: 'Hello!' },
                { id: '3', timestamp: new Date(), role: 'assistant', content: 'Hi there! How can I help?' }
            ];

            const estimate = service.estimateMessagesTokens(messages);

            expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
            expect(estimate.estimatedOutputTokens).toBeGreaterThan(0);
            expect(estimate.estimatedTotalTokens).toBe(
                estimate.estimatedInputTokens + estimate.estimatedOutputTokens
            );
        });

        it('should count system messages as input', () => {
            const messages: Message[] = [
                { id: '1', timestamp: new Date(), role: 'system', content: 'System prompt here' }
            ];

            const estimate = service.estimateMessagesTokens(messages);

            expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
            expect(estimate.estimatedOutputTokens).toBe(0);
        });

        it('should handle empty array', () => {
            const estimate = service.estimateMessagesTokens([]);

            expect(estimate.estimatedInputTokens).toBe(0);
            expect(estimate.estimatedOutputTokens).toBe(0);
            expect(estimate.estimatedTotalTokens).toBe(0);
        });
    });

    describe('estimateStringTokens', () => {
        it('should estimate tokens for a string', () => {
            const text = 'This is a test string for token estimation.';
            const tokens = service.estimateStringTokens(text);

            // ~44 chars / 4 = 11 tokens
            expect(tokens).toBeGreaterThan(8);
            expect(tokens).toBeLessThan(15);
        });

        it('should return 0 for empty string', () => {
            expect(service.estimateStringTokens('')).toBe(0);
        });

        it('should handle very long strings', () => {
            const longText = 'a'.repeat(10000);
            const tokens = service.estimateStringTokens(longText);

            expect(tokens).toBe(2500); // 10000 / 4
        });
    });

    describe('getContextWindowSize', () => {
        it('should return correct size for GPT-4 Turbo', () => {
            expect(service.getContextWindowSize('gpt-4-turbo')).toBe(128000);
            expect(service.getContextWindowSize('gpt-4o')).toBe(128000);
            expect(service.getContextWindowSize('gpt-4o-mini')).toBe(128000);
        });

        it('should return correct size for GPT-4', () => {
            expect(service.getContextWindowSize('gpt-4')).toBe(8192);
        });

        it('should return correct size for GPT-3.5', () => {
            expect(service.getContextWindowSize('gpt-3.5-turbo')).toBe(16385);
        });

        it('should return correct size for Claude models', () => {
            expect(service.getContextWindowSize('claude-3-5-sonnet')).toBe(200000);
            expect(service.getContextWindowSize('claude-3-opus')).toBe(200000);
            expect(service.getContextWindowSize('claude-3-haiku')).toBe(200000);
            expect(service.getContextWindowSize('claude-2.1')).toBe(100000);
        });

        it('should return correct size for Gemini models', () => {
            expect(service.getContextWindowSize('gemini-1.5-pro')).toBe(2000000);
            expect(service.getContextWindowSize('gemini-1.5-flash')).toBe(2000000);
            expect(service.getContextWindowSize('gemini-pro')).toBe(32768);
        });

        it('should return correct size for Llama models', () => {
            expect(service.getContextWindowSize('llama-3.1-70b')).toBe(131072);
            expect(service.getContextWindowSize('llama-3.1-405b')).toBe(131072);
            expect(service.getContextWindowSize('llama-3')).toBe(8192);
            expect(service.getContextWindowSize('llama-2-70b')).toBe(4096);
        });

        it('should return default for unknown models', () => {
            expect(service.getContextWindowSize('unknown-model')).toBe(8192);
        });

        it('should be case-insensitive', () => {
            expect(service.getContextWindowSize('GPT-4-TURBO')).toBe(128000);
            expect(service.getContextWindowSize('Claude-3-Opus')).toBe(200000);
        });
    });

    describe('fitsInContextWindow', () => {
        it('should return true when messages fit', () => {
            const messages: Message[] = [
                { id: '1', timestamp: new Date(), role: 'user', content: 'Short message' }
            ];

            const result = service.fitsInContextWindow(messages, 'gpt-4');

            expect(result.fits).toBe(true);
            expect(result.remainingTokens).toBeGreaterThan(0);
        });

        it('should account for reserved tokens', () => {
            const messages: Message[] = [
                { id: '1', timestamp: new Date(), role: 'user', content: 'a'.repeat(32000) } // ~8000 tokens
            ];

            const result = service.fitsInContextWindow(messages, 'gpt-4', 1000);

            expect(result.fits).toBe(false); // 8000 + 1000 > 8192
        });

        it('should return context window size', () => {
            const messages: Message[] = [];
            const result = service.fitsInContextWindow(messages, 'gpt-4-turbo');

            expect(result.contextWindow).toBe(128000);
        });
    });

    describe('truncateToFitContextWindow', () => {
        it('should keep messages that fit', () => {
            const messages: Message[] = [
                { id: '1', timestamp: new Date(), role: 'user', content: 'Hello' },
                { id: '2', timestamp: new Date(), role: 'assistant', content: 'Hi!' }
            ];

            const result = service.truncateToFitContextWindow(messages, 'gpt-4');

            expect(result).toHaveLength(2);
        });

        it('should keep system messages when truncating', () => {
            const systemMessage: Message = { id: '0', timestamp: new Date(), role: 'system', content: 'You are helpful.' };
            const messages: Message[] = [
                systemMessage,
                { id: '1', timestamp: new Date(), role: 'user', content: 'Message 1' },
                { id: '2', timestamp: new Date(), role: 'assistant', content: 'Response 1' },
                { id: '3', timestamp: new Date(), role: 'user', content: 'Message 2' }
            ];

            const result = service.truncateToFitContextWindow(messages, 'gpt-4', 0, true);

            expect(result[0]).toBe(systemMessage);
        });

        it('should keep recent messages when truncating', () => {
            // Create messages that will exceed llama-2 context (4096 tokens)
            const messages: Message[] = [];
            for (let i = 0; i < 20; i++) {
                messages.push({
                    id: String(i),
                    timestamp: new Date(),
                    role: 'user',
                    content: `Message ${i}: ${'a'.repeat(1000)}` // ~250 tokens each
                });
            }

            const result = service.truncateToFitContextWindow(messages, 'llama-2');

            // Should have fewer messages and include the last ones
            expect(result.length).toBeLessThan(messages.length);
            expect(result[result.length - 1].content).toContain('Message 19');
        });

        it('should handle empty messages array', () => {
            const result = service.truncateToFitContextWindow([], 'gpt-4');
            expect(result).toEqual([]);
        });

        it('should respect reservedTokens', () => {
            const messages: Message[] = [
                { id: '1', timestamp: new Date(), role: 'user', content: 'a'.repeat(16000) } // ~4000 tokens
            ];

            // gpt-4 has 8192 context, reserve 5000 = 3192 available
            const result = service.truncateToFitContextWindow(messages, 'gpt-4', 5000);

            expect(result).toHaveLength(0); // Can't fit
        });
    });
});
