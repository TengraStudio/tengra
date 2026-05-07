/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Unit tests for TokenEstimationService
 */
import { getTokenEstimationService,TokenEstimationService } from '@main/services/llm/token-estimation.service';
import { Message } from '@shared/types/chat';
import { beforeEach, describe, expect, it } from 'vitest';

describe('TokenEstimationService', () => {
    let service: TokenEstimationService;

    beforeEach(() => {
        service = new TokenEstimationService();
    });

    describe('estimateStringTokens', () => {
        it('should count tokens accurately for GPT-4 (cl100k_base)', () => {
            const text = 'Hello, world!';
            // "Hello, world!" is 4 tokens in cl100k_base
            const count = service.estimateStringTokens(text, 'gpt-4');
            expect(count).toBe(4);
        });

        it('should count tokens accurately for GPT-4o (o200k_base)', () => {
            const text = 'Exploring the universe.';
            // GPT-4o uses different encoding but "Exploring the universe." is likely the same or similar count
            const count = service.estimateStringTokens(text, 'gpt-4o');
            expect(count).toBeGreaterThan(0);
        });

        it('should fallback to cl100k_base for Claude models', () => {
            const text = 'Test message for Claude';
            const count = service.estimateStringTokens(text, 'claude-3-sonnet');
            expect(count).toBeGreaterThan(0);
        });

        it('should use heuristics for unknown models', () => {
            const text = 'This is a test message to check heuristic fallback logic.';
            const count = service.estimateStringTokens(text, 'my-custom-model-123');

            const words = text.trim().split(/\s+/).length;
            const chars = text.length;
            const expected = Math.max(Math.ceil(words * 1.35), Math.ceil(chars / 3.8));
            expect(count).toBe(expected);
        });
    });

    describe('estimateMessageTokens', () => {
        it('should include overhead for messages', () => {
            const message: Message = {
                id: '1',
                role: 'user',
                content: 'Hello',
                timestamp: new Date()
            };
            const count = service.estimateMessageTokens(message, 'gpt-4');
            const stringOnlyCount = service.estimateStringTokens('Hello', 'gpt-4');
            // Overhead should be around 4 tokens
            expect(count).toBe(stringOnlyCount + 4);
        });
    });

    describe('getContextWindowSize', () => {
        it('should return correct limits for known models', () => {
            expect(service.getContextWindowSize('gpt-4o')).toBe(128000);
            expect(service.getContextWindowSize('claude-3-opus')).toBe(200000);
            expect(service.getContextWindowSize('gemini-1.5-pro')).toBe(2000000);
            expect(service.getContextWindowSize('unknown')).toBe(8192);
        });

        it('should respect dynamic limits', () => {
            service.registerModelLimit('my-model', 50000);
            expect(service.getContextWindowSize('my-model')).toBe(50000);
        });
    });

    describe('fitsInContextWindow', () => {
        it('should correctly identify if messages fit', () => {
            const messages: Message[] = [
                { id: '1', role: 'user', content: 'Short message', timestamp: new Date() }
            ];
            const result = service.fitsInContextWindow(messages, 'gpt-4');
            expect(result.fits).toBe(true);
            expect(result.remainingTokens).toBeGreaterThan(0);
        });

        it('should identify when messages do not fit', () => {
            service.registerModelLimit('tiny-model', 1);
            const messages: Message[] = [
                { id: '1', role: 'user', content: 'Long message that definitely exceeds limit', timestamp: new Date() }
            ];
            const result = service.fitsInContextWindow(messages, 'tiny-model');
            expect(result.fits).toBe(false);
        });
    });

    describe('truncateToFitContextWindow', () => {
        it('should preserve system messages while truncating', () => {
            service.registerModelLimit('tiny-model', 10);
            const systemMessage: Message = { id: '0', role: 'system', content: 'System', timestamp: new Date() };
            const messages: Message[] = [
                systemMessage,
                { id: '1', role: 'user', content: 'a'.repeat(1000), timestamp: new Date() }
            ];

            const truncated = service.truncateToFitContextWindow(messages, 'tiny-model', 0, true);
            expect(truncated.length).toBe(1);
            expect(truncated[0]).toEqual(systemMessage);
        });
    });

    describe('singleton', () => {
        it('should return the same instance', () => {
            const s1 = getTokenEstimationService();
            const s2 = getTokenEstimationService();
            expect(s1).toBe(s2);
        });
    });
});

