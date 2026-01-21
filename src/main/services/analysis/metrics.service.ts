/**
 * Performance Metrics Service
 * Tracks API latencies, request counts, and system performance
 */

import { EventEmitter } from 'events'

import { JsonValue } from '@shared/types/common'

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
    private metrics: Map<string, MetricData[]> = new Map()
    private providerStats: Map<string, ProviderMetrics> = new Map()
    private readonly maxDataPoints = 1000 // Per metric

    constructor() {
        super()
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
        }

        if (!this.metrics.has(name)) {
            this.metrics.set(name, [])
        }

        const arr = this.metrics.get(name)
        if (!arr) {
            throw new Error(`Failed to get metrics array for ${name}`)
        }
        arr.push(data)

        // Trim to max data points
        if (arr.length > this.maxDataPoints) {
            arr.shift()
        }

        this.emit('metric', data)
    }

    /**
     * Record an API request duration for a provider
     */
    recordRequest(provider: string, durationMs: number, success: boolean) {
        const key = provider.toLowerCase()

        if (!this.providerStats.has(key)) {
            this.providerStats.set(key, {
                requestCount: 0,
                successCount: 0,
                errorCount: 0,
                totalLatencyMs: 0,
                avgLatencyMs: 0,
                minLatencyMs: Infinity,
                maxLatencyMs: 0
            })
        }

        const stats = this.providerStats.get(key)
        if (!stats) {
            throw new Error(`Failed to get provider stats for ${key}`)
        }
        stats.requestCount++
        if (success) {
            stats.successCount++
        } else {
            stats.errorCount++
        }
        stats.totalLatencyMs += durationMs
        stats.avgLatencyMs = stats.totalLatencyMs / stats.requestCount
        stats.minLatencyMs = Math.min(stats.minLatencyMs, durationMs)
        stats.maxLatencyMs = Math.max(stats.maxLatencyMs, durationMs)
        stats.lastRequestAt = Date.now()

        // Also record as time-series metric
        this.record(`api.${key}.latency`, durationMs, 'ms')
        this.record(`api.${key}.${success ? 'success' : 'error'}`, 1, 'count')
    }

    /**
     * Get metrics for a specific name
     */
    getMetrics(name: string, since?: number): MetricData[] {
        const data = this.metrics.get(name) ?? []
        if (since) {
            return data.filter(d => d.timestamp >= since)
        }
        return data
    }

    /**
     * Get provider statistics
     */
    getProviderStats(provider?: string): Map<string, ProviderMetrics> | ProviderMetrics | undefined {
        if (provider) {
            return this.providerStats.get(provider.toLowerCase())
        }
        return this.providerStats
    }

    /**
     * Get all provider statistics as plain object
     */
    getAllProviderStats(): Record<string, ProviderMetrics> {
        const result: Record<string, ProviderMetrics> = {}
        for (const [key, stats] of this.providerStats) {
            result[key] = { ...stats }
        }
        return result
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
        let totalRequests = 0
        let totalSuccess = 0
        let totalLatency = 0

        for (const stats of this.providerStats.values()) {
            totalRequests += stats.requestCount
            totalSuccess += stats.successCount
            totalLatency += stats.totalLatencyMs
        }

        return {
            totalRequests,
            successRate: totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0,
            avgLatencyMs: totalRequests > 0 ? totalLatency / totalRequests : 0,
            providers: Array.from(this.providerStats.keys())
        }
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics.clear()
        this.providerStats.clear()
    }

    /**
     * Create a timer to measure operation duration
     */
    startTimer(): () => number {
        const start = Date.now()
        return () => Date.now() - start
    }
}

// Singleton instance
let instance: MetricsService | null = null

export function getMetricsService(): MetricsService {
    instance ??= new MetricsService()
    return instance
}

/**
 * Decorator to automatically measure method duration
 */
export function measureDuration(provider: string) {
    return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value

        descriptor.value = async function (...args: Array<JsonValue | object | null | undefined>) {
            const metrics = getMetricsService()
            const timer = metrics.startTimer()
            let success = true

            try {
                return await original.apply(this, args)
            } catch (error) {
                success = false;
                throw error;
            } finally {
                metrics.recordRequest(provider, timer(), success)
            }
        }

        return descriptor
    }
}
