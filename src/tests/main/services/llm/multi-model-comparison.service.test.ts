import { LLMService } from '@main/services/llm/llm.service';
import { MultiLLMOrchestrator } from '@main/services/llm/multi-llm-orchestrator.service';
import {
    ComparisonRequest,
    MultiModelComparisonService,
} from '@main/services/llm/multi-model-comparison.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('uuid', () => ({ v4: () => 'test-uuid' }));

const mockLlmService = {
    chat: vi.fn(),
};

const mockOrchestrator = {
    addTask: vi.fn(),
};

describe('MultiModelComparisonService', () => {
    let service: MultiModelComparisonService;

    beforeEach(() => {
        vi.clearAllMocks();
        // Make addTask execute the task immediately
        mockOrchestrator.addTask.mockImplementation(async (task: { execute: () => Promise<void> }) => {
            await task.execute();
        });

        service = new MultiModelComparisonService(
            mockLlmService as never as LLMService,
            mockOrchestrator as never as MultiLLMOrchestrator
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('cleanup', () => {
        it('should cleanup without error', async () => {
            await expect(service.cleanup()).resolves.toBeUndefined();
        });
    });

    describe('compareModels', () => {
        it('should compare multiple models successfully', async () => {
            mockLlmService.chat
                .mockResolvedValueOnce({ content: 'Response from model A' })
                .mockResolvedValueOnce({ content: 'Response from model B' });

            const request: ComparisonRequest = {
                chatId: 'chat-1',
                messages: [{ role: 'user', content: 'Hello' }],
                models: [
                    { provider: 'openai', model: 'gpt-4o' },
                    { provider: 'anthropic', model: 'claude-3-5-sonnet' },
                ],
            };

            const result = await service.compareModels(request);

            expect(result.success).toBe(true);
            expect(result.result?.results['openai:gpt-4o'].success).toBe(true);
            expect(result.result?.results['anthropic:claude-3-5-sonnet'].success).toBe(true);
        });

        it('should capture errors per model without failing entirely', async () => {
            mockLlmService.chat
                .mockResolvedValueOnce({ content: 'OK' })
                .mockRejectedValueOnce(new Error('Model B failed'));

            const request: ComparisonRequest = {
                chatId: 'chat-1',
                messages: [{ role: 'user', content: 'Hi' }],
                models: [
                    { provider: 'openai', model: 'gpt-4o' },
                    { provider: 'anthropic', model: 'claude-3-5-sonnet' },
                ],
            };

            const result = await service.compareModels(request);

            expect(result.success).toBe(true);
            expect(result.result?.results['openai:gpt-4o'].success).toBe(true);
            expect(result.result?.results['anthropic:claude-3-5-sonnet'].success).toBe(false);
            expect(result.result?.results['anthropic:claude-3-5-sonnet'].error).toBe('Model B failed');
        });

        it('should handle empty models array', async () => {
            const request: ComparisonRequest = {
                chatId: 'chat-1',
                messages: [],
                models: [],
            };

            const result = await service.compareModels(request);

            expect(result.success).toBe(true);
            expect(Object.keys(result.result?.results ?? {})).toHaveLength(0);
        });
    });
});
