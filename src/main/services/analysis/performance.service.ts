import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { IPerformanceService } from '@main/types/services';
import { getCacheAnalyticsSnapshot } from '@main/utils/cache.util';
import { ServiceResponse } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';

export class PerformanceService extends BaseService implements IPerformanceService {
    private memoryHistory: number[] = [];
    private maxHistoryLength = 60; // 1 hour if sampled every minute
    private monitoringInterval?: NodeJS.Timeout;
    private alerts: Array<{ timestamp: number; level: 'info' | 'warn' | 'error'; message: string }> = [];
    private readonly memoryPressureBytes = 800 * 1024 * 1024;

    constructor() {
        super('PerformanceService');
    }

    /**
     * Initialize the PerformanceService
     */
    async initialize(): Promise<void> {
        appLogger.info(this.name, 'Initializing performance service...');
        
        // Start memory monitoring
        this.startMemoryMonitoring();
        
        appLogger.info(this.name, `Performance monitoring started (${this.maxHistoryLength} sample history)`);
    }

    /**
     * Cleanup the PerformanceService
     */
    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up performance service...');
        
        // Stop memory monitoring
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        
        // Clear history
        this.memoryHistory = [];
        
        appLogger.info(this.name, 'Performance service cleaned up');
    }

    /**
     * Start automatic memory monitoring
     */
    private startMemoryMonitoring(): void {
        // Sample memory every 60 seconds
        this.monitoringInterval = setInterval(() => {
            const stats = process.memoryUsage();
            this.memoryHistory.push(stats.heapUsed);
            
            if (this.memoryHistory.length > this.maxHistoryLength) {
                this.memoryHistory.shift();
            }
            
            // Log memory leaks if detected
            if (this.memoryHistory.length >= 5) {
                const leak = this.detectLeakSync();
                if (leak.isPossibleLeak) {
                    appLogger.warn(this.name, 'Possible memory leak detected');
                    this.pushAlert('warn', 'Possible memory leak detected from heap trend');
                }
            }

            // Memory pressure monitoring and automatic GC hint
            if (stats.rss > this.memoryPressureBytes) {
                this.pushAlert('warn', `Memory pressure detected (rss=${Math.round(stats.rss / 1024 / 1024)}MB)`);
                const gc = this.triggerGC();
                if (!gc.success) {
                    this.pushAlert('info', 'GC hint skipped (global.gc unavailable)');
                }
            }
        }, 60000); // 60 seconds
    }

    private pushAlert(level: 'info' | 'warn' | 'error', message: string): void {
        this.alerts.push({ timestamp: Date.now(), level, message });
        if (this.alerts.length > 200) {
            this.alerts.shift();
        }
    }

    /**
     * Synchronous leak detection for internal monitoring
     */
    private detectLeakSync(): { isPossibleLeak: boolean; trend: number[] } {
        if (this.memoryHistory.length < 5) {
            return { isPossibleLeak: false, trend: this.memoryHistory };
        }

        const lastSamples = this.memoryHistory.slice(-5);
        let strictlyIncreasing = true;
        for (let i = 1; i < lastSamples.length; i++) {
            if (lastSamples[i] <= lastSamples[i - 1]) {
                strictlyIncreasing = false;
                break;
            }
        }

        const first = lastSamples[0];
        const last = lastSamples[lastSamples.length - 1];
        const growth = ((last - first) / first) * 100;

        return {
            isPossibleLeak: strictlyIncreasing && growth > 10,
            trend: lastSamples
        };
    }

    getMemoryStats(): ServiceResponse<{ main: NodeJS.MemoryUsage; timestamp: number }> {
        const stats = {
            main: process.memoryUsage(),
            timestamp: Date.now()
        };

        // Add heapUsed to history
        this.memoryHistory.push(stats.main.heapUsed);
        if (this.memoryHistory.length > this.maxHistoryLength) {
            this.memoryHistory.shift();
        }

        return { success: true, result: stats };
    }

    async detectLeak(): Promise<ServiceResponse<{ isPossibleLeak: boolean; trend: number[] }>> {
        if (this.memoryHistory.length < 5) {
            return {
                success: true,
                result: { isPossibleLeak: false, trend: this.memoryHistory }
            };
        }

        // Simple heuristic: check if the last 5 samples are strictly increasing
        const lastSamples = this.memoryHistory.slice(-5);
        let strictlyIncreasing = true;
        for (let i = 1; i < lastSamples.length; i++) {
            if (lastSamples[i] <= lastSamples[i - 1]) {
                strictlyIncreasing = false;
                break;
            }
        }

        // Also check growth percentage
        const first = lastSamples[0];
        const last = lastSamples[lastSamples.length - 1];
        const growth = ((last - first) / first) * 100;

        const isPossibleLeak = strictlyIncreasing && growth > 5;

        return {
            success: true,
            result: { isPossibleLeak, trend: lastSamples }
        };
    }

    triggerGC(): ServiceResponse<{ success: boolean }> {
        try {
            if (global.gc) {
                global.gc();
                this.pushAlert('info', 'Manual garbage collection triggered');
                return { success: true, result: { success: true } };
            }
            return {
                success: false,
                error: 'GC not exposed. Please run with --expose-gc'
            };
        } catch (e) {
            return { success: false, error: getErrorMessage(e) };
        }
    }

    getDashboard(): ServiceResponse<{
        memory: {
            latestRss: number;
            latestHeapUsed: number;
            sampleCount: number;
        };
        alerts: Array<{ timestamp: number; level: 'info' | 'warn' | 'error'; message: string }>;
        caches?: Record<string, unknown>;
    }> {
        const usage = process.memoryUsage();
        return {
            success: true,
            result: {
                memory: {
                    latestRss: usage.rss,
                    latestHeapUsed: usage.heapUsed,
                    sampleCount: this.memoryHistory.length
                },
                alerts: [...this.alerts],
                caches: getCacheAnalyticsSnapshot()
            }
        };
    }
}
