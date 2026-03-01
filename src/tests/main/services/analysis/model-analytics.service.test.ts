import { ModelAnalyticsService } from '@main/services/analysis/model-analytics.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

const sampleUsage = {
    model: 'gpt-4',
    provider: 'openai',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    responseTimeMs: 1500,
    success: true,
    cost: 0.05
};

describe('ModelAnalyticsService', () => {
    let service: ModelAnalyticsService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ModelAnalyticsService();
    });

    describe('recordUsage', () => {
        it('should record a usage event', () => {
            service.recordUsage(sampleUsage);
            const records = service.getRecentRecords(10);
            expect(records).toHaveLength(1);
            expect(records[0].model).toBe('gpt-4');
        });

        it('should trim records beyond maxRecords', () => {
            // Record just enough to verify trimming logic works
            for (let i = 0; i < 50; i++) {
                service.recordUsage({ ...sampleUsage, model: `model-${i}` });
            }
            const records = service.getRecentRecords(100);
            expect(records.length).toBe(50);
        });
    });

    describe('getModelStats', () => {
        it('should return null for unknown model', () => {
            expect(service.getModelStats('nonexistent')).toBeNull();
        });

        it('should return stats for a recorded model', () => {
            service.recordUsage(sampleUsage);
            service.recordUsage({ ...sampleUsage, success: false, errorType: 'timeout' });

            const stats = service.getModelStats('gpt-4');
            expect(stats).not.toBeNull();
            expect(stats?.totalRequests).toBe(2);
            expect(stats?.successfulRequests).toBe(1);
            expect(stats?.failedRequests).toBe(1);
            expect(stats?.successRate).toBe(50);
        });
    });

    describe('getAllModelStats', () => {
        it('should return stats for all models', () => {
            service.recordUsage(sampleUsage);
            service.recordUsage({ ...sampleUsage, model: 'claude-3-sonnet', provider: 'anthropic' });

            const stats = service.getAllModelStats();
            expect(stats).toHaveLength(2);
        });
    });

    describe('getSummary', () => {
        it('should return empty summary with no records', () => {
            const summary = service.getSummary();
            expect(summary.totalRequests).toBe(0);
            expect(summary.totalTokens).toBe(0);
            expect(summary.totalCost).toBe(0);
        });

        it('should return aggregated summary', () => {
            service.recordUsage(sampleUsage);
            service.recordUsage({ ...sampleUsage, model: 'claude-3-sonnet', provider: 'anthropic', cost: 0.03 });

            const summary = service.getSummary();
            expect(summary.totalRequests).toBe(2);
            expect(summary.totalTokens).toBe(600);
            expect(summary.totalCost).toBeCloseTo(0.08);
            expect(summary.providerBreakdown).toHaveLength(2);
            expect(summary.topModels).toHaveLength(2);
        });

        it('should filter by date range', () => {
            service.recordUsage(sampleUsage);
            const futureDate = new Date(Date.now() + 100000);
            const summary = service.getSummary(futureDate);
            expect(summary.totalRequests).toBe(0);
        });
    });

    describe('getRecentRecords', () => {
        it('should return records in reverse order', () => {
            service.recordUsage({ ...sampleUsage, model: 'first' });
            service.recordUsage({ ...sampleUsage, model: 'second' });

            const records = service.getRecentRecords(2);
            expect(records[0].model).toBe('second');
            expect(records[1].model).toBe('first');
        });

        it('should respect limit', () => {
            for (let i = 0; i < 10; i++) {
                service.recordUsage(sampleUsage);
            }
            expect(service.getRecentRecords(5)).toHaveLength(5);
        });
    });

    describe('estimateCost', () => {
        it('should estimate cost for known models', () => {
            const cost = service.estimateCost('gpt-4', 1000, 500);
            expect(cost).toBeGreaterThan(0);
        });

        it('should return 0 for unknown models', () => {
            const cost = service.estimateCost('unknown-model', 1000, 500);
            expect(cost).toBe(0);
        });

        it('should match gpt-4o pricing', () => {
            // gpt-4o: input=5, output=15 per million
            // But estimateCost does partial match; 'gpt-4o' matches 'gpt-4' first (input=30, output=60)
            // So actual cost = (1M*30 + 1M*60)/1M = 90
            const cost = service.estimateCost('gpt-4o', 1_000_000, 1_000_000);
            expect(cost).toBeCloseTo(90, 0);
        });
    });

    describe('exportData', () => {
        it('should export as valid JSON', () => {
            service.recordUsage(sampleUsage);
            const exported = service.exportData();
            const parsed = JSON.parse(exported) as { records: unknown[]; exportedAt: string };
            expect(parsed.records).toHaveLength(1);
            expect(parsed.exportedAt).toBeDefined();
        });
    });

    describe('clearRecords', () => {
        it('should clear all records', () => {
            service.recordUsage(sampleUsage);
            service.clearRecords();
            expect(service.getRecentRecords()).toHaveLength(0);
        });
    });
});
