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
 * Performance Monitoring Service
 * SPACE-LEVEL OPTIMIZATION: Real-time performance monitoring
 *
 * Tracks:
 * - Startup time
 * - Memory usage
 * - IPC latency
 * - Database query performance
 * - React render performance
 * - LLM response times
 */

import * as os from 'os';

import { BaseService } from '@main/services/base.service';

export interface PerformanceMetric {
    name: string;
    value: number;
    unit: 'ms' | 'mb' | 'bytes' | 'percent' | 'count';
    timestamp: number;
    category: 'startup' | 'memory' | 'ipc' | 'database' | 'llm' | 'render' | 'cpu';
}

export interface MemorySnapshot {
    heapUsed: number; // MB
    heapTotal: number; // MB
    external: number; // MB
    rss: number; // MB (Resident Set Size - total memory)
    systemFree: number; // MB
    systemTotal: number; // MB
}

export interface StartupMetrics {
    appReadyTime: number; // ms
    windowReadyTime: number; // ms
    servicesInitTime: number; // ms
    databaseInitTime: number; // ms
    totalStartupTime: number; // ms
}

export class PerformanceMonitorService extends BaseService {
    private metrics: PerformanceMetric[] = [];
    private readonly MAX_METRICS = 10000; // Keep last 10k metrics
    private startTime: number = Date.now();
    private startupMetrics: Partial<StartupMetrics> = {};
    private memoryCheckInterval?: NodeJS.Timeout;

    constructor() {
        super('PerformanceMonitorService');
    }

    override async cleanup(): Promise<void> {
        await this.dispose();
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing Performance Monitor (SPACE-GRADE)...');
        this.startTime = Date.now();

        // Take memory snapshot every 30 seconds
        this.memoryCheckInterval = setInterval(() => {
            this.recordMemorySnapshot();
        }, 30000);

        // Start startup metrics
        this.startupMetrics = {};

        this.logInfo('Performance Monitor initialized');
    }

    /**
     * Record a performance metric
     */
    recordMetric(
        name: string,
        value: number,
        unit: PerformanceMetric['unit'],
        category: PerformanceMetric['category']
    ): void {
        const metric: PerformanceMetric = {
            name,
            value,
            unit,
            category,
            timestamp: Date.now()
        };

        this.metrics.push(metric);

        // Circular buffer: Evict old metrics
        if (this.metrics.length > this.MAX_METRICS) {
            this.metrics.shift();
        }

        // Log critical metrics
        if (
            (category === 'memory' && unit === 'mb' && value > 1000) || // 1GB+ RAM
            (category === 'ipc' && unit === 'ms' && value > 100) || // 100ms+ IPC latency
            (category === 'database' && unit === 'ms' && value > 50) || // 50ms+ query
            (category === 'cpu' && unit === 'percent' && value > 80) // 80%+ CPU
        ) {
            this.logWarn(`[CRITICAL] ${name}: ${value}${unit} (category: ${category})`);
        }
    }

    /**
     * Record time taken for an operation
     */
    recordDuration(name: string, startTime: number, category: PerformanceMetric['category']): number {
        const duration = Date.now() - startTime;
        this.recordMetric(name, duration, 'ms', category);
        return duration;
    }

    /**
     * Wrap async function with automatic timing
     */
    async measure<T>(
        name: string,
        category: PerformanceMetric['category'],
        fn: () => Promise<T>
    ): Promise<T> {
        const start = Date.now();
        try {
            const result = await fn();
            this.recordDuration(name, start, category);
            return result;
        } catch (error) {
            this.recordDuration(`${name}_ERROR`, start, category);
            throw error;
        }
    }

    /**
     * Record memory snapshot
     */
    recordMemorySnapshot(): MemorySnapshot {
        const memUsage = process.memoryUsage();
        const systemMem = os.totalmem();
        const freeMem = os.freemem();

        const snapshot: MemorySnapshot = {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
            rss: Math.round(memUsage.rss / 1024 / 1024),
            systemFree: Math.round(freeMem / 1024 / 1024),
            systemTotal: Math.round(systemMem / 1024 / 1024)
        };

        // Record individual metrics
        this.recordMetric('memory.heap_used', snapshot.heapUsed, 'mb', 'memory');
        this.recordMetric('memory.heap_total', snapshot.heapTotal, 'mb', 'memory');
        this.recordMetric('memory.rss', snapshot.rss, 'mb', 'memory');
        this.recordMetric('memory.system_free', snapshot.systemFree, 'mb', 'memory');

        // Space-grade: Low memory warning
        const memoryUsagePercent = ((systemMem - freeMem) / systemMem) * 100;
        if (memoryUsagePercent > 90) {
            this.logError(`SPACE CRITICAL: System memory usage at ${memoryUsagePercent.toFixed(1)}%`);
        }

        return snapshot;
    }

    /**
     * Record CPU usage
     */
    recordCPUUsage(): void {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type as keyof typeof cpu.times];
            }
            totalIdle += cpu.times.idle;
        });

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - (100 * idle / total);

        this.recordMetric('cpu.usage', Math.round(usage), 'percent', 'cpu');
    }

    /**
     * Record startup metrics
     */
    recordStartupMetric(phase: keyof StartupMetrics, timeMs: number): void {
        this.startupMetrics[phase] = timeMs;
        this.recordMetric(`startup.${phase}`, timeMs, 'ms', 'startup');

        this.logInfo(`Startup phase '${phase}': ${timeMs}ms`);
    }

    /**
     * Get startup metrics
     */
    getStartupMetrics(): Partial<StartupMetrics> {
        return { ...this.startupMetrics };
    }

    /**
     * Get metrics by category
     */
    getMetrics(category?: PerformanceMetric['category'], limit = 100): PerformanceMetric[] {
        let filtered = this.metrics;
        if (category) {
            filtered = filtered.filter(m => m.category === category);
        }
        // Last N metrics
        return filtered.slice(-limit);
    }

    /**
     * Get average metric value
     */
    getAverageMetric(name: string, timeWindowMs = 60000): number {
        const cutoff = Date.now() - timeWindowMs;
        const relevantMetrics = this.metrics.filter(
            m => m.name === name && m.timestamp >= cutoff
        );

        if (relevantMetrics.length === 0) {
            return 0;
        }

        const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
        return sum / relevantMetrics.length;
    }

    /**
     * Get performance summary
     */
    getSummary(): {
        startup: Partial<StartupMetrics>;
        memory: MemorySnapshot;
        averages: {
            ipcLatency: number;
            dbQueryTime: number;
            llmResponseTime: number;
        };
        uptime: number;
    } {
        const currentMemory = this.recordMemorySnapshot();

        return {
            startup: this.getStartupMetrics(),
            memory: currentMemory,
            averages: {
                ipcLatency: this.getAverageMetric('ipc.latency', 300000), // Last 5 minutes
                dbQueryTime: this.getAverageMetric('database.query', 300000),
                llmResponseTime: this.getAverageMetric('llm.response', 300000)
            },
            uptime: Math.floor((Date.now() - this.startTime) / 1000) // seconds
        };
    }

    /**
     * Force garbage collection if available
     */
    forceGarbageCollection(): boolean {
        if (global.gc) {
            this.logInfo('Forcing garbage collection...');
            global.gc();
            return true;
        }
        this.logWarn('Garbage collection not available (run with --expose-gc)');
        return false;
    }

    /**
     * Get app resource usage
     */
    getResourceUsage(): {
        memory: MemorySnapshot;
        cpu: number;
        handles: number;
    } {
        const memory = this.recordMemorySnapshot();
        this.recordCPUUsage();

        // File descriptor count (handle count)
        type ProcessWithHandles = NodeJS.Process & { _getActiveHandles?: () => RuntimeValue[] };
        const processWithHandles = process as ProcessWithHandles;
        const handleCount = processWithHandles._getActiveHandles?.().length ?? 0;

        return {
            memory,
            cpu: Math.round(this.getAverageMetric('cpu.usage', 10000)), // Last 10 seconds
            handles: handleCount
        };
    }

    async dispose(): Promise<void> {
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
        }

        this.logInfo('Performance Monitor disposed');

        // Final summary
        const summary = this.getSummary();
        this.logInfo(`Final Performance Summary:
            - Uptime: ${summary.uptime}s
            - Memory RSS: ${summary.memory.rss}MB
            - Avg IPC Latency: ${summary.averages.ipcLatency.toFixed(2)}ms
            - Avg DB Query: ${summary.averages.dbQueryTime.toFixed(2)}ms
        `);
    }
}
