/**
 * Unit tests for TokenEstimationService
 */
import { TokenEstimationService } from '@main/services/llm/token-estimation.service';
import { beforeEach, describe, expect, it } from 'vitest';

import { Message } from '@/types/chat';

let service: TokenEstimationService;

beforeEach(() => {
    service = new TokenEstimationService();
});

describe('TokenEstimationService - Message Estimation', () => {
    describe('estimateMessageTokens', () => {
        it('should estimate tokens for string content', () => {
            const message: Message = { id: '1', timestamp: new Date(), role: 'user', content: 'Hello, how are you?' };
            const tokens = service.estimateMessageTokens(message);
            expect(tokens).toBeGreaterThan(0);
        });

        it('should estimate tokens for empty content', () => {
            const message: Message = { id: '1', timestamp: new Date(), role: 'user', content: '' };
            expect(service.estimateMessageTokens(message)).toBe(0);
        });
    });

    describe('estimateMessagesTokens', () => {
        it('should separate input and output tokens', () => {
            const messages: Message[] = [
                { id: '1', timestamp: new Date(), role: 'user', content: 'Hello!' },
                { id: '3', timestamp: new Date(), role: 'assistant', content: 'Hi there!' }
            ];
            const estimate = service.estimateMessagesTokens(messages);
            expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
            expect(estimate.estimatedOutputTokens).toBeGreaterThan(0);
        });
    });
});

describe('TokenEstimationService - Context Windows', () => {
    describe('getContextWindowSize', () => {
        it('should return correct size for major models', () => {
            expect(service.getContextWindowSize('gpt-4-turbo')).toBe(128000);
            expect(service.getContextWindowSize('claude-3-5-sonnet')).toBe(200000);
            expect(service.getContextWindowSize('gemini-1.5-pro')).toBe(2000000);
        });

        it('should be case-insensitive', () => {
            expect(service.getContextWindowSize('GPT-4-TURBO')).toBe(128000);
        });
    });

    describe('truncateToFitContextWindow', () => {
        it('should keep messages that fit', () => {
            const messages: Message[] = [{ id: '1', timestamp: new Date(), role: 'user', content: 'Hello' }];
            expect(service.truncateToFitContextWindow(messages, 'gpt-4')).toHaveLength(1);
        });

        it('should keep system messages when truncating', () => {
            const systemMessage: Message = { id: '0', timestamp: new Date(), role: 'system', content: 'Prompt' };
            const messages: Message[] = [systemMessage, { id: '1', timestamp: new Date(), role: 'user', content: 'a'.repeat(40000) }];
            const result = service.truncateToFitContextWindow(messages, 'gpt-4', 0, true);
            expect(result[0]).toBe(systemMessage);
        });
    });
});
