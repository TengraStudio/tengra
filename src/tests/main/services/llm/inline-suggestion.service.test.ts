/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { InlineSuggestionRequest } from '@shared/schemas/inline-suggestions.schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

const mockLlmService = {
    chat: vi.fn(),
};

const mockAuthService = {
    getAccountsByProvider: vi.fn().mockResolvedValue([]),
    getActiveAccount: vi.fn().mockResolvedValue(null),
    setActiveAccount: vi.fn().mockResolvedValue(undefined),
};

type InlineDeps = ConstructorParameters<typeof InlineSuggestionService>[0];

function makeRequest(overrides: Partial<InlineSuggestionRequest> = {}): InlineSuggestionRequest {
    return {
        prefix: 'function hello() {',
        language: 'typescript',
        cursorLine: 1,
        cursorColumn: 19,
        source: 'custom',
        ...overrides,
    } as InlineSuggestionRequest;
}

describe('InlineSuggestionService', () => {
    let service: InlineSuggestionService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new InlineSuggestionService({
            llmService: mockLlmService as never as InlineDeps['llmService'],
            authService: mockAuthService as never as InlineDeps['authService'],
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('getInlineSuggestion', () => {
        it('should return suggestion from LLM', async () => {
            mockLlmService.chat.mockResolvedValue({ content: 'return "hello";' });

            const result = await service.getInlineSuggestion(makeRequest());

            expect(result.suggestion).toBe('return "hello";');
            expect(result.source).toBe('custom');
        });

        it('should return null suggestion for empty prefix', async () => {
            const result = await service.getInlineSuggestion(makeRequest({ prefix: '   ' }));

            expect(result.suggestion).toBeNull();
            expect(mockLlmService.chat).not.toHaveBeenCalled();
        });

        it('should strip markdown fences from response', async () => {
            mockLlmService.chat.mockResolvedValue({ content: '```typescript\nreturn 42;\n```' });

            const result = await service.getInlineSuggestion(makeRequest());

            expect(result.suggestion).toBe('return 42;');
        });

        it('should return null for empty normalized content', async () => {
            mockLlmService.chat.mockResolvedValue({ content: '```\n```' });

            const result = await service.getInlineSuggestion(makeRequest());

            expect(result.suggestion).toBeNull();
        });

        it('should use copilot provider when source is copilot with accounts', async () => {
            mockAuthService.getAccountsByProvider.mockResolvedValue([{ id: 'acc-1' }]);
            mockAuthService.getActiveAccount.mockResolvedValue({ id: 'acc-1' });
            mockLlmService.chat.mockResolvedValue({ content: 'result' });

            const result = await service.getInlineSuggestion(
                makeRequest({ source: 'copilot' })
            );

            expect(result.provider).toBe('copilot');
        });

        it('should return null when copilot source has no accounts', async () => {
            mockAuthService.getAccountsByProvider.mockResolvedValue([]);

            const result = await service.getInlineSuggestion(
                makeRequest({ source: 'copilot' })
            );

            expect(result.suggestion).toBeNull();
            expect(result.provider).toBe('copilot');
        });

        it('should fallback on custom provider error', async () => {
            mockLlmService.chat
                .mockRejectedValueOnce(new Error('provider error'))
                .mockResolvedValueOnce({ content: 'fallback result' });

            const result = await service.getInlineSuggestion(
                makeRequest({ provider: 'openai' })
            );

            expect(result.suggestion).toBe('fallback result');
            expect(result.provider).toBeUndefined();
            expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
        });

        it('should rethrow error for non-custom source', async () => {
            mockAuthService.getAccountsByProvider.mockResolvedValue([{ id: 'acc-1' }]);
            mockAuthService.getActiveAccount.mockResolvedValue({ id: 'acc-1' });
            mockLlmService.chat.mockRejectedValue(new Error('fatal'));

            await expect(
                service.getInlineSuggestion(makeRequest({ source: 'copilot' }))
            ).rejects.toThrow('fatal');
        });
    });

    describe('getCompletion', () => {
        it('should return suggestion text', async () => {
            mockLlmService.chat.mockResolvedValue({ content: ' world' });

            const result = await service.getCompletion('hello');

            expect(result).toBe('world');
        });

        it('should return empty string when suggestion is null', async () => {
            const result = await service.getCompletion('   ');

            expect(result).toBe('');
        });
    });

    describe('trackTelemetry', () => {
        it('should record telemetry and return success', async () => {
            const result = await service.trackTelemetry({
                event: 'request',
                source: 'custom',
                provider: 'openai',
                model: 'gpt-4o-mini',
                language: 'typescript',
            });

            expect(result).toEqual({ success: true });
        });
    });
});
