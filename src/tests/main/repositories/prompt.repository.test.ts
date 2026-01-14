import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptRepository } from '@main/repositories/prompt.repository';

// Mock DatabaseService
const mockDb = {
    getPrompts: vi.fn(),
    createPrompt: vi.fn(),
    updatePrompt: vi.fn(),
    deletePrompt: vi.fn()
};

describe('PromptRepository', () => {
    let repo: PromptRepository;

    beforeEach(() => {
        repo = new PromptRepository(mockDb as any);
        vi.clearAllMocks();
    });

    it('should find all prompts', async () => {
        const prompts = [{ id: '1', title: 'test' }];
        mockDb.getPrompts.mockResolvedValue(prompts);

        const result = await repo.findAll();
        expect(result).toBe(prompts);
        expect(mockDb.getPrompts).toHaveBeenCalled();
    });

    it('should create prompt', async () => {
        const prompt = { id: '1', title: 'Test', content: 'Content', tags: [] };
        // db.createPrompt returns the created object
        mockDb.createPrompt.mockResolvedValue(prompt);

        const result = await repo.create(prompt as any);
        expect(result).toBe(prompt);
        // Expect decomposed arguments
        expect(mockDb.createPrompt).toHaveBeenCalledWith('Test', 'Content', []);
    });
});
