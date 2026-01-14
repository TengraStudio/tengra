/**
 * Model Performance Analytics Service
 * Tracks and analyzes model usage, response times, token counts, and costs.
 */

import { BaseService } from './base.service';
import { DataService } from './data/data.service';

export interface ModelUsageRecord {
    id: string;
    timestamp: number;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    responseTimeMs: number;
    success: boolean;
    errorType?: string;
    cost?: number;
}

export interface ModelStats {
    model: string;
    provider: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    avgResponseTimeMs: number;
    minResponseTimeMs: number;
    maxResponseTimeMs: number;
    totalCost: number;
    successRate: number;
    tokensPerSecond: number;
}

export interface AnalyticsSummary {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgResponseTime: number;
    modelBreakdown: ModelStats[];
    providerBreakdown: { provider: string; requests: number; tokens: number; cost: number }[];
    dailyUsage: { date: string; requests: number; tokens: number; cost: number }[];
    topModels: { model: string; requests: number }[];
}

export class ModelAnalyticsService extends BaseService {
    private records: ModelUsageRecord[] = [];
    // private dataService: DataService | null = null; // Unused
    private readonly maxRecords = 10000;

    constructor(_dataService?: DataService) {
        super('ModelAnalyticsService');
        // this.dataService = dataService || null;
    }

    /**
     * Record a model usage event
     */
    recordUsage(data: Omit<ModelUsageRecord, 'id' | 'timestamp'>): void {
        const record: ModelUsageRecord = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            ...data
        };

        this.records.push(record);

        // Keep only recent records in memory
        if (this.records.length > this.maxRecords) {
            this.records = this.records.slice(-this.maxRecords);
        }

        this.logInfo(`Recorded usage: ${data.model} - ${data.totalTokens} tokens in ${data.responseTimeMs}ms`);
    }

    /**
     * Get statistics for a specific model
     */
    getModelStats(model: string): ModelStats | null {
        const modelRecords = this.records.filter(r => r.model === model);
        if (modelRecords.length === 0) return null;

        return this.calculateStats(modelRecords, model);
    }

    /**
     * Get statistics for all models
     */
    getAllModelStats(): ModelStats[] {
        const models = [...new Set(this.records.map(r => r.model))];
        return models.map(model => this.calculateStats(
            this.records.filter(r => r.model === model),
            model
        ));
    }

    /**
     * Get analytics summary
     */
    getSummary(startDate?: Date, endDate?: Date): AnalyticsSummary {
        let filteredRecords = this.records;

        if (startDate) {
            filteredRecords = filteredRecords.filter(r => r.timestamp >= startDate.getTime());
        }
        if (endDate) {
            filteredRecords = filteredRecords.filter(r => r.timestamp <= endDate.getTime());
        }

        const totalRequests = filteredRecords.length;
        const totalTokens = filteredRecords.reduce((sum, r) => sum + r.totalTokens, 0);
        const totalCost = filteredRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
        const avgResponseTime = totalRequests > 0
            ? filteredRecords.reduce((sum, r) => sum + r.responseTimeMs, 0) / totalRequests
            : 0;

        // Model breakdown
        const modelBreakdown = this.getAllModelStats();

        // Provider breakdown
        const providers = [...new Set(filteredRecords.map(r => r.provider))];
        const providerBreakdown = providers.map(provider => {
            const providerRecords = filteredRecords.filter(r => r.provider === provider);
            return {
                provider,
                requests: providerRecords.length,
                tokens: providerRecords.reduce((sum, r) => sum + r.totalTokens, 0),
                cost: providerRecords.reduce((sum, r) => sum + (r.cost || 0), 0)
            };
        });

        // Daily usage
        const dailyMap = new Map<string, { requests: number; tokens: number; cost: number }>();
        filteredRecords.forEach(r => {
            const date = new Date(r.timestamp).toISOString().split('T')[0];
            const existing = dailyMap.get(date) || { requests: 0, tokens: 0, cost: 0 };
            dailyMap.set(date, {
                requests: existing.requests + 1,
                tokens: existing.tokens + r.totalTokens,
                cost: existing.cost + (r.cost || 0)
            });
        });
        const dailyUsage = Array.from(dailyMap.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Top models
        const modelCounts = new Map<string, number>();
        filteredRecords.forEach(r => {
            modelCounts.set(r.model, (modelCounts.get(r.model) || 0) + 1);
        });
        const topModels = Array.from(modelCounts.entries())
            .map(([model, requests]) => ({ model, requests }))
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 10);

        return {
            totalRequests,
            totalTokens,
            totalCost,
            avgResponseTime,
            modelBreakdown,
            providerBreakdown,
            dailyUsage,
            topModels
        };
    }

    /**
     * Get recent records
     */
    getRecentRecords(limit: number = 100): ModelUsageRecord[] {
        return this.records.slice(-limit).reverse();
    }

    /**
     * Calculate cost estimate based on provider pricing
     */
    estimateCost(model: string, inputTokens: number, outputTokens: number): number {
        // Pricing per million tokens (approximate)
        const pricing: Record<string, { input: number; output: number }> = {
            'gpt-4': { input: 30, output: 60 },
            'gpt-4-turbo': { input: 10, output: 30 },
            'gpt-4o': { input: 5, output: 15 },
            'gpt-4o-mini': { input: 0.15, output: 0.6 },
            'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
            'claude-3-opus': { input: 15, output: 75 },
            'claude-3-sonnet': { input: 3, output: 15 },
            'claude-3-haiku': { input: 0.25, output: 1.25 },
            'claude-3.5-sonnet': { input: 3, output: 15 },
        };

        // Find matching pricing (partial match)
        const modelLower = model.toLowerCase();
        const matchedPricing = Object.entries(pricing).find(([key]) =>
            modelLower.includes(key.toLowerCase())
        );

        if (!matchedPricing) return 0;

        const [, price] = matchedPricing;
        return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
    }

    /**
     * Export analytics data as JSON
     */
    exportData(): string {
        return JSON.stringify({
            records: this.records,
            summary: this.getSummary(),
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    /**
     * Clear all records
     */
    clearRecords(): void {
        this.records = [];
        this.logInfo('Analytics records cleared');
    }

    private calculateStats(records: ModelUsageRecord[], model: string): ModelStats {
        const successful = records.filter(r => r.success);
        const responseTimes = records.map(r => r.responseTimeMs);

        return {
            model,
            provider: records[0]?.provider || 'unknown',
            totalRequests: records.length,
            successfulRequests: successful.length,
            failedRequests: records.length - successful.length,
            totalInputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
            totalOutputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
            totalTokens: records.reduce((sum, r) => sum + r.totalTokens, 0),
            avgResponseTimeMs: responseTimes.length > 0
                ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
                : 0,
            minResponseTimeMs: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
            maxResponseTimeMs: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
            totalCost: records.reduce((sum, r) => sum + (r.cost || 0), 0),
            successRate: records.length > 0 ? (successful.length / records.length) * 100 : 0,
            tokensPerSecond: records.length > 0
                ? records.reduce((sum, r) => sum + r.totalTokens, 0) /
                (records.reduce((sum, r) => sum + r.responseTimeMs, 0) / 1000)
                : 0
        };
    }
}
