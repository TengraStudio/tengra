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
 * Unit tests for MetricsService
 */
import {
    getMetricsService,
    MetricData,
    MetricsService,
    ProviderMetrics
} from '@main/services/analysis/metrics.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('MetricsService', () => {
    let service: MetricsService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));
        service = new MetricsService();
    });

    afterEach(() => {
        service.reset();
        vi.useRealTimers();
    });

    describe('record', () => {
        it('should record a metric with correct data', () => {
            service.record('cpu.usage', 55, 'percent');

            const metrics = service.getMetrics('cpu.usage');
            expect(metrics).toHaveLength(1);
            expect(metrics[0].name).toBe('cpu.usage');
            expect(metrics[0].value).toBe(55);
            expect(metrics[0].unit).toBe('percent');
            expect(metrics[0].timestamp).toBe(Date.now());
        });

        it('should record metric with tags', () => {
            service.record('api.latency', 120, 'ms', { provider: 'openai', region: 'us-east' });

            const metrics = service.getMetrics('api.latency');
            expect(metrics).toHaveLength(1);
            expect(metrics[0].tags).toEqual({ provider: 'openai', region: 'us-east' });
        });

        it('should record metric without tags', () => {
            service.record('request.count', 1, 'count');

            const metrics = service.getMetrics('request.count');
            expect(metrics[0].tags).toBeUndefined();
        });

        it('should append multiple metrics under the same name', () => {
            service.record('memory', 500, 'bytes');
            service.record('memory', 600, 'bytes');
            service.record('memory', 700, 'bytes');

            const metrics = service.getMetrics('memory');
            expect(metrics).toHaveLength(3);
            expect(metrics[0].value).toBe(500);
            expect(metrics[1].value).toBe(600);
            expect(metrics[2].value).toBe(700);
        });

        it('should emit metric event when recording', () => {
            const handler = vi.fn();
            service.on('metric', handler);

            service.record('test.metric', 42, 'count');

            expect(handler).toHaveBeenCalledOnce();
            const emittedData: MetricData = handler.mock.calls[0][0];
            expect(emittedData.name).toBe('test.metric');
            expect(emittedData.value).toBe(42);
        });

        it('should trim oldest data points when exceeding maxDataPoints', () => {
            // Record 1001 data points (max is 1000)
            for (let i = 0; i < 1001; i++) {
                vi.setSystemTime(new Date(2024, 0, 1, 0, 0, i));
                service.record('trimmed', i, 'count');
            }

            const metrics = service.getMetrics('trimmed');
            expect(metrics).toHaveLength(1000);
            // First entry should be the second recorded (index 1), since index 0 was trimmed
            expect(metrics[0].value).toBe(1);
            expect(metrics[999].value).toBe(1000);
        });

        it('should support all unit types', () => {
            const units: Array<'ms' | 'count' | 'bytes' | 'percent'> = ['ms', 'count', 'bytes', 'percent'];

            for (const unit of units) {
                service.record(`metric.${unit}`, 10, unit);
                const metrics = service.getMetrics(`metric.${unit}`);
                expect(metrics[0].unit).toBe(unit);
            }
        });

        it('should record zero values', () => {
            service.record('empty', 0, 'count');

            const metrics = service.getMetrics('empty');
            expect(metrics[0].value).toBe(0);
        });

        it('should record negative values', () => {
            service.record('delta', -5, 'count');

            const metrics = service.getMetrics('delta');
            expect(metrics[0].value).toBe(-5);
        });
    });

    describe('recordRequest', () => {
        it('should initialize provider stats on first request', () => {
            service.recordRequest('OpenAI', 150, true);

            const stats = service.getProviderStats('openai') as ProviderMetrics;
            expect(stats).toBeDefined();
            expect(stats.requestCount).toBe(1);
            expect(stats.successCount).toBe(1);
            expect(stats.errorCount).toBe(0);
            expect(stats.totalLatencyMs).toBe(150);
            expect(stats.avgLatencyMs).toBe(150);
            expect(stats.minLatencyMs).toBe(150);
            expect(stats.maxLatencyMs).toBe(150);
        });

        it('should normalize provider name to lowercase', () => {
            service.recordRequest('OpenAI', 100, true);
            service.recordRequest('OPENAI', 200, true);
            service.recordRequest('openai', 300, true);

            const stats = service.getProviderStats('openai') as ProviderMetrics;
            expect(stats.requestCount).toBe(3);
        });

        it('should increment error count on failed request', () => {
            service.recordRequest('claude', 500, false);

            const stats = service.getProviderStats('claude') as ProviderMetrics;
            expect(stats.errorCount).toBe(1);
            expect(stats.successCount).toBe(0);
        });

        it('should compute correct average latency', () => {
            service.recordRequest('provider', 100, true);
            service.recordRequest('provider', 200, true);
            service.recordRequest('provider', 300, true);

            const stats = service.getProviderStats('provider') as ProviderMetrics;
            expect(stats.avgLatencyMs).toBe(200);
            expect(stats.totalLatencyMs).toBe(600);
        });

        it('should track min and max latency', () => {
            service.recordRequest('provider', 200, true);
            service.recordRequest('provider', 50, true);
            service.recordRequest('provider', 500, true);
            service.recordRequest('provider', 100, true);

            const stats = service.getProviderStats('provider') as ProviderMetrics;
            expect(stats.minLatencyMs).toBe(50);
            expect(stats.maxLatencyMs).toBe(500);
        });

        it('should set lastRequestAt timestamp', () => {
            service.recordRequest('provider', 100, true);

            const stats = service.getProviderStats('provider') as ProviderMetrics;
            expect(stats.lastRequestAt).toBe(Date.now());
        });

        it('should also record time-series latency metric', () => {
            service.recordRequest('openai', 150, true);

            const latencyMetrics = service.getMetrics('api.openai.latency');
            expect(latencyMetrics).toHaveLength(1);
            expect(latencyMetrics[0].value).toBe(150);
            expect(latencyMetrics[0].unit).toBe('ms');
        });

        it('should record success count metric on successful request', () => {
            service.recordRequest('openai', 100, true);

            const successMetrics = service.getMetrics('api.openai.success');
            expect(successMetrics).toHaveLength(1);
            expect(successMetrics[0].value).toBe(1);
            expect(successMetrics[0].unit).toBe('count');
        });

        it('should record error count metric on failed request', () => {
            service.recordRequest('openai', 100, false);

            const errorMetrics = service.getMetrics('api.openai.error');
            expect(errorMetrics).toHaveLength(1);
            expect(errorMetrics[0].value).toBe(1);
        });

        it('should track mixed success and error requests', () => {
            service.recordRequest('mixed', 100, true);
            service.recordRequest('mixed', 200, false);
            service.recordRequest('mixed', 150, true);
            service.recordRequest('mixed', 300, false);

            const stats = service.getProviderStats('mixed') as ProviderMetrics;
            expect(stats.requestCount).toBe(4);
            expect(stats.successCount).toBe(2);
            expect(stats.errorCount).toBe(2);
        });

        it('should track multiple providers independently', () => {
            service.recordRequest('openai', 100, true);
            service.recordRequest('claude', 200, false);

            const openaiStats = service.getProviderStats('openai') as ProviderMetrics;
            const claudeStats = service.getProviderStats('claude') as ProviderMetrics;

            expect(openaiStats.requestCount).toBe(1);
            expect(openaiStats.successCount).toBe(1);
            expect(claudeStats.requestCount).toBe(1);
            expect(claudeStats.errorCount).toBe(1);
        });
    });

    describe('getMetrics', () => {
        it('should return empty array for unknown metric name', () => {
            const metrics = service.getMetrics('nonexistent');
            expect(metrics).toEqual([]);
        });

        it('should return all metrics without since filter', () => {
            service.record('test', 1, 'count');
            service.record('test', 2, 'count');

            const metrics = service.getMetrics('test');
            expect(metrics).toHaveLength(2);
        });

        it('should filter metrics by since timestamp', () => {
            vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));
            service.record('test', 1, 'count');

            vi.setSystemTime(new Date('2024-06-01T13:00:00Z'));
            service.record('test', 2, 'count');

            vi.setSystemTime(new Date('2024-06-01T14:00:00Z'));
            service.record('test', 3, 'count');

            const since = new Date('2024-06-01T12:30:00Z').getTime();
            const filtered = service.getMetrics('test', since);
            expect(filtered).toHaveLength(2);
            expect(filtered[0].value).toBe(2);
            expect(filtered[1].value).toBe(3);
        });

        it('should return empty array when since is in the future', () => {
            service.record('test', 1, 'count');

            const futureTimestamp = Date.now() + 1000000;
            const filtered = service.getMetrics('test', futureTimestamp);
            expect(filtered).toEqual([]);
        });

        it('should return all metrics when since is 0', () => {
            service.record('test', 1, 'count');
            service.record('test', 2, 'count');

            // since=0 is falsy, so no filtering
            const metrics = service.getMetrics('test', 0);
            expect(metrics).toHaveLength(2);
        });
    });

    describe('getProviderStats', () => {
        it('should return undefined for unknown provider', () => {
            const stats = service.getProviderStats('unknown');
            expect(stats).toBeUndefined();
        });

        it('should return stats for a specific provider', () => {
            service.recordRequest('openai', 100, true);

            const stats = service.getProviderStats('openai') as ProviderMetrics;
            expect(stats).toBeDefined();
            expect(stats.requestCount).toBe(1);
        });

        it('should return all provider stats map when no provider specified', () => {
            service.recordRequest('openai', 100, true);
            service.recordRequest('claude', 200, true);

            const allStats = service.getProviderStats() as Map<string, ProviderMetrics>;
            expect(allStats).toBeInstanceOf(Map);
            expect(allStats.size).toBe(2);
            expect(allStats.has('openai')).toBe(true);
            expect(allStats.has('claude')).toBe(true);
        });

        it('should be case-insensitive for provider lookup', () => {
            service.recordRequest('OpenAI', 100, true);

            const stats = service.getProviderStats('OPENAI') as ProviderMetrics;
            expect(stats).toBeDefined();
            expect(stats.requestCount).toBe(1);
        });
    });

    describe('getAllProviderStats', () => {
        it('should return empty object when no providers exist', () => {
            const result = service.getAllProviderStats();
            expect(result).toEqual({});
        });

        it('should return plain object with all provider stats', () => {
            service.recordRequest('openai', 100, true);
            service.recordRequest('claude', 200, false);

            const result = service.getAllProviderStats();
            expect(Object.keys(result)).toEqual(['openai', 'claude']);
            expect(result['openai'].requestCount).toBe(1);
            expect(result['claude'].errorCount).toBe(1);
        });

        it('should return copies of stats (not references)', () => {
            service.recordRequest('openai', 100, true);

            const result = service.getAllProviderStats();
            result['openai'].requestCount = 999;

            const fresh = service.getAllProviderStats();
            expect(fresh['openai'].requestCount).toBe(1);
        });
    });

    describe('getSummary', () => {
        it('should return zero values when no requests exist', () => {
            const summary = service.getSummary();

            expect(summary.totalRequests).toBe(0);
            expect(summary.successRate).toBe(0);
            expect(summary.avgLatencyMs).toBe(0);
            expect(summary.providers).toEqual([]);
        });

        it('should compute correct summary across multiple providers', () => {
            service.recordRequest('openai', 100, true);
            service.recordRequest('openai', 200, true);
            service.recordRequest('claude', 300, false);

            const summary = service.getSummary();
            expect(summary.totalRequests).toBe(3);
            expect(summary.successRate).toBeCloseTo(66.67, 1);
            expect(summary.avgLatencyMs).toBe(200);
            expect(summary.providers).toContain('openai');
            expect(summary.providers).toContain('claude');
        });

        it('should return 100% success rate when all succeed', () => {
            service.recordRequest('openai', 100, true);
            service.recordRequest('openai', 200, true);

            const summary = service.getSummary();
            expect(summary.successRate).toBe(100);
        });

        it('should return 0% success rate when all fail', () => {
            service.recordRequest('openai', 100, false);
            service.recordRequest('openai', 200, false);

            const summary = service.getSummary();
            expect(summary.successRate).toBe(0);
        });

        it('should list all provider keys', () => {
            service.recordRequest('openai', 100, true);
            service.recordRequest('claude', 200, true);
            service.recordRequest('gemini', 300, true);

            const summary = service.getSummary();
            expect(summary.providers).toHaveLength(3);
        });
    });

    describe('reset', () => {
        it('should clear all metrics', () => {
            service.record('test', 1, 'count');
            service.recordRequest('openai', 100, true);

            service.reset();

            expect(service.getMetrics('test')).toEqual([]);
            expect(service.getProviderStats('openai')).toBeUndefined();
        });

        it('should clear all provider stats', () => {
            service.recordRequest('openai', 100, true);
            service.recordRequest('claude', 200, true);

            service.reset();

            const summary = service.getSummary();
            expect(summary.totalRequests).toBe(0);
            expect(summary.providers).toEqual([]);
        });

        it('should allow recording after reset', () => {
            service.record('test', 1, 'count');
            service.reset();
            service.record('test', 2, 'count');

            const metrics = service.getMetrics('test');
            expect(metrics).toHaveLength(1);
            expect(metrics[0].value).toBe(2);
        });
    });

    describe('startTimer', () => {
        it('should return a function', () => {
            const timer = service.startTimer();
            expect(typeof timer).toBe('function');
        });

        it('should measure elapsed time', () => {
            const timer = service.startTimer();

            vi.advanceTimersByTime(250);

            const elapsed = timer();
            expect(elapsed).toBe(250);
        });

        it('should return 0 when called immediately', () => {
            const timer = service.startTimer();
            const elapsed = timer();
            expect(elapsed).toBe(0);
        });

        it('should allow multiple reads from the same timer', () => {
            const timer = service.startTimer();

            vi.advanceTimersByTime(100);
            const first = timer();

            vi.advanceTimersByTime(200);
            const second = timer();

            expect(first).toBe(100);
            expect(second).toBe(300);
        });
    });

    describe('getMetricsService singleton', () => {
        it('should return a MetricsService instance', () => {
            const instance = getMetricsService();
            expect(instance).toBeInstanceOf(MetricsService);
        });

        it('should return the same instance on repeated calls', () => {
            const first = getMetricsService();
            const second = getMetricsService();
            expect(first).toBe(second);
        });
    });

    describe('EventEmitter integration', () => {
        it('should support multiple listeners', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            service.on('metric', handler1);
            service.on('metric', handler2);

            service.record('test', 1, 'count');

            expect(handler1).toHaveBeenCalledOnce();
            expect(handler2).toHaveBeenCalledOnce();
        });

        it('should not emit when no listeners are registered', () => {
            // Should not throw
            service.record('test', 1, 'count');
        });

        it('should stop emitting to removed listeners', () => {
            const handler = vi.fn();
            service.on('metric', handler);

            service.record('test', 1, 'count');
            expect(handler).toHaveBeenCalledOnce();

            service.removeListener('metric', handler);
            service.record('test', 2, 'count');
            expect(handler).toHaveBeenCalledOnce();
        });
    });

    describe('edge cases', () => {
        it('should handle very large metric values', () => {
            service.record('large', Number.MAX_SAFE_INTEGER, 'count');

            const metrics = service.getMetrics('large');
            expect(metrics[0].value).toBe(Number.MAX_SAFE_INTEGER);
        });

        it('should handle empty string metric name', () => {
            service.record('', 1, 'count');

            const metrics = service.getMetrics('');
            expect(metrics).toHaveLength(1);
        });

        it('should handle provider with zero duration', () => {
            service.recordRequest('fast', 0, true);

            const stats = service.getProviderStats('fast') as ProviderMetrics;
            expect(stats.totalLatencyMs).toBe(0);
            expect(stats.avgLatencyMs).toBe(0);
            expect(stats.minLatencyMs).toBe(0);
            expect(stats.maxLatencyMs).toBe(0);
        });

        it('should handle empty tags object', () => {
            service.record('test', 1, 'count', {});

            const metrics = service.getMetrics('test');
            expect(metrics[0].tags).toEqual({});
        });

        it('should handle rapid successive recordings', () => {
            for (let i = 0; i < 500; i++) {
                service.record('rapid', i, 'count');
            }

            const metrics = service.getMetrics('rapid');
            expect(metrics).toHaveLength(500);
        });

        it('should maintain data integrity at maxDataPoints boundary', () => {
            // Record exactly 1000 data points
            for (let i = 0; i < 1000; i++) {
                service.record('boundary', i, 'count');
            }

            let metrics = service.getMetrics('boundary');
            expect(metrics).toHaveLength(1000);
            expect(metrics[0].value).toBe(0);

            // Record one more to trigger trim
            service.record('boundary', 1000, 'count');
            metrics = service.getMetrics('boundary');
            expect(metrics).toHaveLength(1000);
            expect(metrics[0].value).toBe(1);
            expect(metrics[999].value).toBe(1000);
        });

        it('should handle ProviderMetrics minLatencyMs initialized to Infinity', () => {
            service.recordRequest('provider', 100, true);

            const stats = service.getProviderStats('provider') as ProviderMetrics;
            // After first request, min should be the actual value, not Infinity
            expect(stats.minLatencyMs).toBe(100);
            expect(Number.isFinite(stats.minLatencyMs)).toBe(true);
        });
    });
});

