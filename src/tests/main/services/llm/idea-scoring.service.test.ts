import { IdeaScoringService } from '@main/services/llm/idea-scoring.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ProjectIdea } from '@shared/types/ideas';
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

function makeIdea(overrides: Partial<ProjectIdea> = {}): ProjectIdea {
    return {
        id: 'idea-1',
        sessionId: 'session-1',
        title: 'Test Idea',
        description: 'A test idea description',
        category: 'saas',
        status: 'generated',
        score: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
    } as ProjectIdea;
}

describe('IdeaScoringService', () => {
    let service: IdeaScoringService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new IdeaScoringService(
            mockLlmService as unknown as LLMService
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('initialize', () => {
        it('should initialize without error', async () => {
            await expect(service.initialize()).resolves.toBeUndefined();
        });
    });

    describe('cleanup', () => {
        it('should cleanup without error', async () => {
            await expect(service.cleanup()).resolves.toBeUndefined();
        });
    });

    describe('scoreIdea', () => {
        it('should return parsed score from LLM response', async () => {
            const llmResponse = JSON.stringify({
                overallScore: 78,
                dimensions: {
                    innovation: 80,
                    marketNeed: 70,
                    feasibility: 75,
                    businessPotential: 85,
                    targetClarity: 72,
                    competitiveMoat: 68,
                },
                strengths: ['Strong market fit'],
                weaknesses: ['High competition'],
                improvements: ['Add AI features'],
                confidence: 'high',
                summary: 'Good idea overall',
            });

            mockLlmService.chat.mockResolvedValue({ content: llmResponse });

            const result = await service.scoreIdea(makeIdea());

            expect(result.overallScore).toBe(78);
            expect(result.dimensions.innovation).toBe(80);
            expect(result.confidence).toBe('high');
            expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
        });

        it('should return default score on LLM error', async () => {
            mockLlmService.chat.mockRejectedValue(new Error('API error'));

            const result = await service.scoreIdea(makeIdea());

            expect(result.overallScore).toBe(50);
            expect(result.confidence).toBe('low');
            expect(result.summary).toBe('Scoring could not be completed');
        });

        it('should clamp dimension scores to 0-100', async () => {
            const llmResponse = JSON.stringify({
                overallScore: 150,
                dimensions: {
                    innovation: 200,
                    marketNeed: -10,
                    feasibility: 50,
                    businessPotential: 50,
                    targetClarity: 50,
                    competitiveMoat: 50,
                },
                strengths: [],
                weaknesses: [],
                improvements: [],
                confidence: 'medium',
                summary: 'Test',
            });

            mockLlmService.chat.mockResolvedValue({ content: llmResponse });

            const result = await service.scoreIdea(makeIdea());

            expect(result.overallScore).toBe(100);
            expect(result.dimensions.innovation).toBe(100);
            expect(result.dimensions.marketNeed).toBe(0);
        });

        it('should handle non-JSON LLM response gracefully', async () => {
            mockLlmService.chat.mockResolvedValue({ content: 'not json at all' });

            const result = await service.scoreIdea(makeIdea());

            expect(result.overallScore).toBe(50);
            expect(result.confidence).toBe('low');
        });
    });

    describe('rankIdeas', () => {
        it('should rank ideas by score descending', async () => {
            const ideas = [makeIdea({ id: 'a', title: 'Low' }), makeIdea({ id: 'b', title: 'High' })];

            mockLlmService.chat
                .mockResolvedValueOnce({
                    content: JSON.stringify({
                        overallScore: 40,
                        dimensions: { innovation: 40, marketNeed: 40, feasibility: 40, businessPotential: 40, targetClarity: 40, competitiveMoat: 40 },
                        strengths: [], weaknesses: [], improvements: [], confidence: 'medium', summary: 'Low',
                    }),
                })
                .mockResolvedValueOnce({
                    content: JSON.stringify({
                        overallScore: 90,
                        dimensions: { innovation: 90, marketNeed: 90, feasibility: 90, businessPotential: 90, targetClarity: 90, competitiveMoat: 90 },
                        strengths: [], weaknesses: [], improvements: [], confidence: 'high', summary: 'High',
                    }),
                });

            const ranked = await service.rankIdeas(ideas);

            expect(ranked).toHaveLength(2);
            expect(ranked[0].rank).toBe(1);
            expect(ranked[0].score.overallScore).toBe(90);
            expect(ranked[1].rank).toBe(2);
        });

        it('should handle empty ideas array', async () => {
            const ranked = await service.rankIdeas([]);
            expect(ranked).toHaveLength(0);
        });
    });

    describe('compareIdeas', () => {
        it('should return comparison from LLM', async () => {
            const comparison = JSON.stringify({
                winnerId: '1',
                reason: 'Better market fit',
                strengthComparison: { innovation: { idea1: 80, idea2: 60 } },
                recommendation: 'Improve idea 2 market research',
            });
            mockLlmService.chat.mockResolvedValue({ content: comparison });

            const idea1 = makeIdea({ id: 'id-1' });
            const idea2 = makeIdea({ id: 'id-2', title: 'Idea 2' });

            const result = await service.compareIdeas(idea1, idea2);

            expect(result.winnerId).toBe('id-1');
            expect(result.reason).toBe('Better market fit');
        });

        it('should return fallback on LLM error', async () => {
            mockLlmService.chat.mockRejectedValue(new Error('fail'));

            const idea1 = makeIdea({ id: 'id-1' });
            const idea2 = makeIdea({ id: 'id-2' });

            const result = await service.compareIdeas(idea1, idea2);

            expect(result.winnerId).toBe('id-1');
            expect(result.reason).toBe('Comparison could not be completed');
        });
    });

    describe('quickScore', () => {
        it('should return parsed number from LLM', async () => {
            mockLlmService.chat.mockResolvedValue({ content: '85' });

            const score = await service.quickScore('Title', 'Description', 'website');

            expect(score).toBe(85);
        });

        it('should return 50 for invalid LLM response', async () => {
            mockLlmService.chat.mockResolvedValue({ content: 'not a number' });

            const score = await service.quickScore('Title', 'Description', 'website');

            expect(score).toBe(50);
        });

        it('should return 50 on LLM error', async () => {
            mockLlmService.chat.mockRejectedValue(new Error('fail'));

            const score = await service.quickScore('Title', 'Description', 'website');

            expect(score).toBe(50);
        });

        it('should return 50 for out-of-range scores', async () => {
            mockLlmService.chat.mockResolvedValue({ content: '150' });

            const score = await service.quickScore('Title', 'Description', 'website');

            expect(score).toBe(50);
        });
    });
});
