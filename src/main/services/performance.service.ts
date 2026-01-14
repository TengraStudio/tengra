import { IPerformanceService } from '@main/types/services';
import { ServiceResponse } from '@shared/types';
import { BaseService } from '@main/services/base.service';
import { getErrorMessage } from '@shared/utils/error.util';

export class PerformanceService extends BaseService implements IPerformanceService {
    private memoryHistory: number[] = [];
    private maxHistoryLength = 60; // 1 hour if sampled every minute

    constructor() {
        super('PerformanceService');
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
}
