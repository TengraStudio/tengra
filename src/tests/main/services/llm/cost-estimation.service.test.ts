import { CostEstimationService } from '@main/services/llm/cost-estimation.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@main/services/llm/token-estimation.service', () => ({
    getTokenEstimationService: () => ({
        estimateMessagesTokens: vi.fn().mockReturnValue({ estimatedInputTokens: 100 }),
    }),
}));

describe('CostEstimationService', () => {
    let service: CostEstimationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new CostEstimationService();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('getPricing', () => {
        it('should return exact match pricing', () => {
            const pricing = service.getPricing('gpt-4o');
            expect(pricing.provider).toBe('openai');
            expect(pricing.inputPricePerMillionTokens).toBe(2.5);
        });

        it('should return partial match pricing', () => {
            const pricing = service.getPricing('claude-3-5-sonnet-latest');
            expect(pricing.provider).toBe('anthropic');
        });

        it('should return default pricing for unknown model', () => {
            const pricing = service.getPricing('totally-unknown-model-xyz');
            expect(pricing.provider).toBe('unknown');
            expect(pricing.inputPricePerMillionTokens).toBe(5.0);
        });

        it('should match provider-specific patterns', () => {
            const pricing = service.getPricing('gemini-custom-variant');
            expect(pricing.provider).toBe('google');
        });
    });

    describe('calculateCost', () => {
        it('should calculate cost correctly', () => {
            const result = service.calculateCost(1_000_000, 500_000, 'gpt-4o');

            expect(result.inputTokens).toBe(1_000_000);
            expect(result.outputTokens).toBe(500_000);
            expect(result.totalTokens).toBe(1_500_000);
            // gpt-4o: input $2.5/M, output $10/M
            expect(result.costUsd).toBeCloseTo(2.5 + 5.0);
        });

        it('should return zero cost for zero tokens', () => {
            const result = service.calculateCost(0, 0, 'gpt-4o');
            expect(result.costUsd).toBe(0);
        });
    });

    describe('estimatePlanCost', () => {
        it('should estimate cost for plan steps', () => {
            const steps = [
                { id: 's1', text: 'Step 1', status: 'pending' as const },
                { id: 's2', text: 'Step 2', status: 'pending' as const },
            ];

            const result = service.estimatePlanCost(
                steps as Parameters<typeof service.estimatePlanCost>[0],
                [],
                'gpt-4o-mini',
                'openai'
            );

            expect(result.modelId).toBe('gpt-4o-mini');
            expect(result.provider).toBe('openai');
            expect(result.stepBreakdown).toHaveLength(2);
            expect(result.totalEstimatedCost).toBeGreaterThan(0);
            expect(result.inputCost).toBeGreaterThan(0);
            expect(result.outputCost).toBeGreaterThan(0);
        });

        it('should handle empty plan', () => {
            const result = service.estimatePlanCost([], [], 'gpt-4o', 'openai');

            expect(result.stepBreakdown).toHaveLength(0);
            expect(result.totalEstimatedCost).toBe(0);
        });
    });

    describe('calculateActualPlanCost', () => {
        it('should calculate actual cost from token usage', () => {
            const steps = [
                { id: 's1', text: 'Step 1', status: 'completed' as const, tokens: { prompt: 500, completion: 200 } },
                { id: 's2', text: 'Step 2', status: 'completed' as const, tokens: { prompt: 300, completion: 100 } },
            ];

            const result = service.calculateActualPlanCost(
                steps as Parameters<typeof service.calculateActualPlanCost>[0],
                'gpt-4o-mini',
                'openai'
            );

            expect(result.stepBreakdown).toHaveLength(2);
            expect(result.totalEstimatedCost).toBeGreaterThan(0);
        });

        it('should handle steps without token data', () => {
            const steps = [
                { id: 's1', text: 'Step 1', status: 'pending' as const },
            ];

            const result = service.calculateActualPlanCost(
                steps as Parameters<typeof service.calculateActualPlanCost>[0],
                'gpt-4o',
                'openai'
            );

            expect(result.totalEstimatedCost).toBe(0);
        });
    });

    describe('formatCost', () => {
        it('should format very small costs', () => {
            expect(service.formatCost(0.00001)).toBe('<$0.0001');
        });

        it('should format small costs with 4 decimals', () => {
            expect(service.formatCost(0.0012)).toBe('$0.0012');
        });

        it('should format medium costs with 3 decimals', () => {
            expect(service.formatCost(0.123)).toBe('$0.123');
        });

        it('should format large costs with 2 decimals', () => {
            expect(service.formatCost(5.678)).toBe('$5.68');
        });
    });

    describe('getAllPricing', () => {
        it('should return a non-empty record', () => {
            const pricing = service.getAllPricing();
            expect(Object.keys(pricing).length).toBeGreaterThan(0);
            expect(pricing['gpt-4o']).toBeDefined();
        });
    });
});
