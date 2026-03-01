import { ChatQueueManager } from '@main/services/chat-queue.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@main/services/llm/multi-llm-orchestrator.service', () => ({
    multiLLMOrchestrator: {
        addTask: vi.fn().mockResolvedValue(undefined),
        isGenerating: vi.fn().mockReturnValue(false),
        getProviderStats: vi.fn().mockReturnValue({ active: 0, queued: 0 })
    }
}));

vi.mock('electron', () => ({
    BrowserWindow: {
        getAllWindows: vi.fn().mockReturnValue([])
    }
}));

vi.mock('uuid', () => ({
    v4: vi.fn().mockReturnValue('mock-uuid')
}));

describe('ChatQueueManager', () => {
    let manager: ChatQueueManager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new ChatQueueManager();
    });

    it('should create an instance', () => {
        expect(manager).toBeDefined();
    });

    it('should set policy', () => {
        manager.setPolicy('fifo');
        // No throw means success
    });

    it('should set policy to parallel', () => {
        manager.setPolicy('parallel');
    });

    it('should add task with provider using multi-LLM orchestrator', async () => {
        const { multiLLMOrchestrator } = await import('@main/services/llm/multi-llm-orchestrator.service');
        const execute = vi.fn().mockResolvedValue(undefined);

        await manager.addTask('chat-1', execute, { provider: 'openai', model: 'gpt-4' });

        expect(multiLLMOrchestrator.addTask).toHaveBeenCalledWith(
            expect.objectContaining({
                chatId: 'chat-1',
                provider: 'openai',
                model: 'gpt-4'
            })
        );
    });

    it('should fall back to legacy queue when no provider given', async () => {
        const execute = vi.fn().mockResolvedValue(undefined);
        await manager.addTask('chat-2', execute);
        // Task goes to legacy queue; execute will be called via processQueue
    });

    it('should check isGenerating via orchestrator when multiLLM enabled', async () => {
        const { multiLLMOrchestrator } = await import('@main/services/llm/multi-llm-orchestrator.service');
        vi.mocked(multiLLMOrchestrator.isGenerating).mockReturnValue(true);

        expect(manager.isGenerating('chat-1')).toBe(true);
    });

    it('should check isGenerating via local set when multiLLM disabled', () => {
        manager.setUseMultiLLM(false);
        expect(manager.isGenerating('chat-1')).toBe(false);
    });

    it('should get provider stats via orchestrator', async () => {
        const { multiLLMOrchestrator } = await import('@main/services/llm/multi-llm-orchestrator.service');
        manager.getProviderStats('openai');
        expect(multiLLMOrchestrator.getProviderStats).toHaveBeenCalledWith('openai');
    });

    it('should return null for provider stats when multiLLM disabled', () => {
        manager.setUseMultiLLM(false);
        expect(manager.getProviderStats('openai')).toBeNull();
    });

    it('should process legacy queue tasks', async () => {
        manager.setUseMultiLLM(false);
        manager.setPolicy('fifo');

        const execute = vi.fn().mockResolvedValue(undefined);
        await manager.addTask('chat-3', execute);

        // Give the async processQueue time to run
        await new Promise(r => setTimeout(r, 50));
        expect(execute).toHaveBeenCalled();
    });

    it('should handle task execution errors gracefully', async () => {
        manager.setUseMultiLLM(false);
        manager.setPolicy('fifo');

        const execute = vi.fn().mockRejectedValue(new Error('task failed'));
        await manager.addTask('chat-err', execute);

        await new Promise(r => setTimeout(r, 50));
        expect(execute).toHaveBeenCalled();
    });
});
