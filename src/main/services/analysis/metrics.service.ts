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
 * Performance Metrics Service
 * Tracks API latencies, request counts, system performance, and error rate alerting
 */

import { EventEmitter } from 'events';

import { appLogger } from '@main/logging/logger';

/** Configuration for error rate alerting thresholds */
export interface ErrorRateThresholdConfig {
    /** Max errors allowed per window before warning */
    maxErrorsPerWindow: number;
    /** Time window in milliseconds */
    windowMs: number;
}

const DEFAULT_ERROR_RATE_THRESHOLDS: ErrorRateThresholdConfig = {
    maxErrorsPerWindow: 10,
    windowMs: 60_000,
};

const MAX_ERROR_TIMESTAMPS = 500;

export interface MetricData {
    name: string
    value: number
    unit: 'ms' | 'count' | 'bytes' | 'percent'
    timestamp: number
    tags?: Record<string, string>
}

export interface ProviderMetrics {
    requestCount: number
    successCount: number
    errorCount: number
    totalLatencyMs: number
    avgLatencyMs: number
    minLatencyMs: number
    maxLatencyMs: number
    lastRequestAt?: number
}

export class MetricsService extends EventEmitter {
    private metrics: Map<string, MetricData[]> = new Map();
    private providerStats: Map<string, ProviderMetrics> = new Map();
    private readonly maxDataPoints = 1000; // Per metric
    private errorTimestamps: number[] = [];
    private errorRateConfig: ErrorRateThresholdConfig = { ...DEFAULT_ERROR_RATE_THRESHOLDS };
    private lastAlertAt = 0;

    constructor() {
        super();
    }

    /**
     * Record a metric value
     */
    record(name: string, value: number, unit: 'ms' | 'count' | 'bytes' | 'percent', tags?: Record<string, string>) {
        const data: MetricData = {
            name,
            value,
            unit,
            timestamp: Date.now(),
            tags
        };

        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const arr = this.metrics.get(name);
        if (!arr) {
            throw new Error(`Failed to get metrics array for ${name}`);
        }
        arr.push(data);

        // Trim to max data points
        if (arr.length > this.maxDataPoints) {
            arr.shift();
        }

        this.emit('metric', data);
    }

    /**
     * Record an API request duration for a provider
     */
    recordRequest(provider: string, durationMs: number, success: boolean) {
        const key = provider.toLowerCase();

        if (!this.providerStats.has(key)) {
            this.providerStats.set(key, {
                requestCount: 0,
                successCount: 0,
                errorCount: 0,
                totalLatencyMs: 0,
                avgLatencyMs: 0,
                minLatencyMs: Infinity,
                maxLatencyMs: 0
            });
        }

        const stats = this.providerStats.get(key);
        if (!stats) {
            throw new Error(`Failed to get provider stats for ${key}`);
        }
        stats.requestCount++;
        if (success) {
            stats.successCount++;
        } else {
            stats.errorCount++;
            this.trackError();
        }
        stats.totalLatencyMs += durationMs;
        stats.avgLatencyMs = stats.totalLatencyMs / stats.requestCount;
        stats.minLatencyMs = Math.min(stats.minLatencyMs, durationMs);
        stats.maxLatencyMs = Math.max(stats.maxLatencyMs, durationMs);
        stats.lastRequestAt = Date.now();

        // Also record as time-series metric
        this.record(`api.${key}.latency`, durationMs, 'ms');
        this.record(`api.${key}.${success ? 'success' : 'error'}`, 1, 'count');
    }

    /**
     * Get metrics for a specific name
     */
    getMetrics(name: string, since?: number): MetricData[] {
        const data = this.metrics.get(name) ?? [];
        if (since) {
            return data.filter(d => d.timestamp >= since);
        }
        return data;
    }

    /**
     * Get provider statistics
     */
    getProviderStats(provider?: string): Map<string, ProviderMetrics> | ProviderMetrics | undefined {
        if (provider) {
            return this.providerStats.get(provider.toLowerCase());
        }
        return this.providerStats;
    }

    /**
     * Get all provider statistics as plain object
     */
    getAllProviderStats(): Record<string, ProviderMetrics> {
        const result: Record<string, ProviderMetrics> = {};
        for (const [key, stats] of this.providerStats) {
            result[key] = { ...stats };
        }
        return result;
    }

    /**
     * Get summary of all metrics
     */
    getSummary(): {
        totalRequests: number
        successRate: number
        avgLatencyMs: number
        providers: string[]
    } {
        let totalRequests = 0;
        let totalSuccess = 0;
        let totalLatency = 0;

        for (const stats of this.providerStats.values()) {
            totalRequests += stats.requestCount;
            totalSuccess += stats.successCount;
            totalLatency += stats.totalLatencyMs;
        }

        return {
            totalRequests,
            successRate: totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0,
            avgLatencyMs: totalRequests > 0 ? totalLatency / totalRequests : 0,
            providers: Array.from(this.providerStats.keys())
        };
    }

    /**
     * Configure error rate alerting thresholds
     */
    setErrorRateThresholds(config: Partial<ErrorRateThresholdConfig>): void {
        if (config.maxErrorsPerWindow !== undefined) {
            this.errorRateConfig.maxErrorsPerWindow = config.maxErrorsPerWindow;
        }
        if (config.windowMs !== undefined) {
            this.errorRateConfig.windowMs = config.windowMs;
        }
    }

    /** Track an error and check if threshold is exceeded */
    private trackError(): void {
        const now = Date.now();
        this.errorTimestamps.push(now);
        if (this.errorTimestamps.length > MAX_ERROR_TIMESTAMPS) {
            this.errorTimestamps = this.errorTimestamps.slice(-MAX_ERROR_TIMESTAMPS);
        }
        const cutoff = now - this.errorRateConfig.windowMs;
        const recentErrors = this.errorTimestamps.filter(t => t >= cutoff).length;
        const cooldown = this.errorRateConfig.windowMs;
        if (recentErrors >= this.errorRateConfig.maxErrorsPerWindow && now - this.lastAlertAt > cooldown) {
            this.lastAlertAt = now;
            appLogger.warn('MetricsService', `Error rate threshold exceeded: ${recentErrors} errors in ${this.errorRateConfig.windowMs / 1000}s (threshold: ${this.errorRateConfig.maxErrorsPerWindow})`);
            this.emit('error-rate-exceeded', { count: recentErrors, windowMs: this.errorRateConfig.windowMs });
        }
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics.clear();
        this.providerStats.clear();
        this.errorTimestamps = [];
        this.lastAlertAt = 0;
    }

    /**
     * Create a timer to measure operation duration
     */
    startTimer(): () => number {
        const start = Date.now();
        return () => Date.now() - start;
    }
}

// Singleton instance
let instance: MetricsService | null = null;

export function getMetricsService(): MetricsService {
    instance ??= new MetricsService();
    return instance;
}

