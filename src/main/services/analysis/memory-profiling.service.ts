/**
 * Memory Profiling Service
 * Provides utilities for detecting memory leaks and profiling memory usage.
 */

import * as path from 'path';
import * as v8 from 'v8';

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { app } from 'electron';

export interface MemorySnapshot {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    rss: number;
}

export interface LeakSuspect {
    name: string;
    size: number;
    retainedSize: number;
    count: number;
}

export interface MemoryReport {
    snapshots: MemorySnapshot[];
    trend: 'stable' | 'increasing' | 'decreasing';
    averageHeapUsed: number;
    peakHeapUsed: number;
    leakSuspects: LeakSuspect[];
    recommendations: string[];
}

export class MemoryProfilingService extends BaseService {
    private snapshots: MemorySnapshot[] = [];
    private intervalId: NodeJS.Timeout | null = null;
    private readonly maxSnapshots = 100;
    private dataService: DataService | null = null;

    constructor(dataService?: DataService) {
        super('MemoryProfilingService');
        this.dataService = dataService || null;
    }

    /**
     * Take a single memory snapshot
     */
    takeSnapshot(): MemorySnapshot {
        const memUsage = process.memoryUsage();
        const snapshot: MemorySnapshot = {
            timestamp: Date.now(),
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers,
            rss: memUsage.rss
        };

        this.snapshots.push(snapshot);

        // Keep only the last maxSnapshots
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }

        return snapshot;
    }

    /**
     * Start automatic memory monitoring
     */
    startMonitoring(intervalMs: number = 30000): void {
        if (this.intervalId) {
            this.stopMonitoring();
        }

        this.logInfo(`Starting memory monitoring with ${intervalMs}ms interval`);
        this.takeSnapshot(); // Take initial snapshot

        this.intervalId = setInterval(() => {
            this.takeSnapshot();
        }, intervalMs);
    }

    /**
     * Stop automatic memory monitoring
     */
    stopMonitoring(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.logInfo('Memory monitoring stopped');
        }
    }

    /**
     * Analyze collected snapshots for memory leaks
     */
    analyzeMemory(): MemoryReport {
        if (this.snapshots.length < 2) {
            return {
                snapshots: this.snapshots,
                trend: 'stable',
                averageHeapUsed: this.snapshots[0]?.heapUsed || 0,
                peakHeapUsed: this.snapshots[0]?.heapUsed || 0,
                leakSuspects: [],
                recommendations: ['Not enough snapshots for analysis. Take more snapshots.']
            };
        }

        const heapValues = this.snapshots.map(s => s.heapUsed);
        const averageHeapUsed = heapValues.reduce((a, b) => a + b, 0) / heapValues.length;
        const peakHeapUsed = Math.max(...heapValues);

        // Calculate trend using linear regression
        const trend = this.calculateTrend(heapValues);

        // Analyze for leak suspects
        const leakSuspects = this.detectLeakSuspects();

        // Generate recommendations
        const recommendations = this.generateRecommendations(trend, averageHeapUsed, peakHeapUsed);

        return {
            snapshots: this.snapshots,
            trend,
            averageHeapUsed,
            peakHeapUsed,
            leakSuspects,
            recommendations
        };
    }

    /**
     * Calculate memory trend
     */
    private calculateTrend(values: number[]): 'stable' | 'increasing' | 'decreasing' {
        if (values.length < 3) { return 'stable'; }

        // Simple linear regression
        const n = values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
        const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        // Normalize slope relative to average
        const avgValue = sumY / n;
        const normalizedSlope = slope / avgValue;

        if (normalizedSlope > 0.01) { return 'increasing'; }
        if (normalizedSlope < -0.01) { return 'decreasing'; }
        return 'stable';
    }

    /**
     * Detect potential memory leak suspects
     */
    private detectLeakSuspects(): LeakSuspect[] {
        const suspects: LeakSuspect[] = [];

        // Check for continuous heap growth
        if (this.snapshots.length >= 10) {
            const recent = this.snapshots.slice(-10);
            const first = recent[0]!.heapUsed;
            const last = recent[recent.length - 1]!.heapUsed;
            const growth = ((last - first) / first) * 100;

            if (growth > 20) {
                suspects.push({
                    name: 'Continuous Heap Growth',
                    size: last - first,
                    retainedSize: last,
                    count: 10
                });
            }
        }

        // Check for external memory growth (native bindings)
        if (this.snapshots.length >= 5) {
            const recent = this.snapshots.slice(-5);
            const firstExternal = recent[0]!.external;
            const lastExternal = recent[recent.length - 1]!.external;

            if (lastExternal > firstExternal * 1.5) {
                suspects.push({
                    name: 'External Memory Growth (Native Modules)',
                    size: lastExternal - firstExternal,
                    retainedSize: lastExternal,
                    count: 5
                });
            }
        }

        return suspects;
    }

    /**
     * Generate recommendations based on analysis
     */
    private generateRecommendations(
        trend: 'stable' | 'increasing' | 'decreasing',
        avgHeap: number,
        peakHeap: number
    ): string[] {
        const recommendations: string[] = [];
        const heapLimitMB = v8.getHeapStatistics().heap_size_limit / (1024 * 1024);

        if (trend === 'increasing') {
            recommendations.push('Memory usage is increasing over time. Consider investigating potential memory leaks.');
            recommendations.push('Use Chrome DevTools to take heap snapshots for detailed analysis.');
        }

        const peakMB = peakHeap / (1024 * 1024);
        if (peakMB > heapLimitMB * 0.7) {
            recommendations.push(`Peak heap usage (${peakMB.toFixed(0)}MB) is approaching the limit (${heapLimitMB.toFixed(0)}MB).`);
            recommendations.push('Consider increasing --max-old-space-size or optimizing memory usage.');
        }

        const avgMB = avgHeap / (1024 * 1024);
        if (avgMB > 500) {
            recommendations.push(`Average heap usage (${avgMB.toFixed(0)}MB) is high. Review for optimization opportunities.`);
        }

        if (recommendations.length === 0) {
            recommendations.push('Memory usage appears healthy.');
        }

        return recommendations;
    }

    /**
     * Force garbage collection (if exposed via --expose-gc)
     */
    forceGC(): boolean {
        if (global.gc) {
            global.gc();
            this.logInfo('Forced garbage collection');
            return true;
        }
        this.logWarn('GC not exposed. Run with --expose-gc flag.');
        return false;
    }

    /**
     * Get V8 heap statistics
     */
    getHeapStatistics(): v8.HeapInfo {
        return v8.getHeapStatistics();
    }

    /**
     * Write heap snapshot to file
     */
    async writeHeapSnapshot(): Promise<string> {
        const snapshotDir = this.dataService?.getPath('logs') || app.getPath('userData');
        const filename = `heap-${Date.now()}.heapsnapshot`;
        const filepath = path.join(snapshotDir, filename);

        const snapshotPath = v8.writeHeapSnapshot(filepath);
        this.logInfo(`Heap snapshot written to: ${snapshotPath}`);

        return snapshotPath || filepath;
    }

    /**
     * Get current memory usage formatted
     */
    getFormattedMemoryUsage(): Record<string, string> {
        const usage = process.memoryUsage();
        const formatMB = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

        return {
            heapUsed: formatMB(usage.heapUsed),
            heapTotal: formatMB(usage.heapTotal),
            external: formatMB(usage.external),
            arrayBuffers: formatMB(usage.arrayBuffers),
            rss: formatMB(usage.rss)
        };
    }

    /**
     * Clear collected snapshots
     */
    clearSnapshots(): void {
        this.snapshots = [];
    }

    /**
     * Cleanup on service disposal
     */
    async cleanup(): Promise<void> {
        this.stopMonitoring();
        this.clearSnapshots();
    }
}
