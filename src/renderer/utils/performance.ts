import { appLogger } from '@/utils/renderer-logger';

/**
 * Performance monitoring utility for tracking app startup and render times
 */

interface PerformanceMark {
    name: string;
    timestamp: number;
    duration?: number;
}

class PerformanceMonitor {
    private marks: Map<string, PerformanceMark> = new Map();
    private measures: PerformanceMark[] = [];
    private startTime: number = Date.now();

    /**
     * Mark a point in time
     */
    mark(name: string): void {
        const timestamp = Date.now() - this.startTime;
        this.marks.set(name, { name, timestamp });

        if (process.env.NODE_ENV === 'development') {
            appLogger.warn('Performance', `Mark: ${name}`, { timestamp });
        }
    }

    /**
     * Measure duration between two marks
     */
    measure(name: string, startMark: string, endMark: string): number | null {
        const start = this.marks.get(startMark);
        const end = this.marks.get(endMark);

        if (!start || !end) {
            appLogger.warn('Performance', `Missing marks for measure: ${startMark} -> ${endMark}`);
            return null;
        }

        const duration = end.timestamp - start.timestamp;
        this.measures.push({ name, timestamp: start.timestamp, duration });

        if (process.env.NODE_ENV === 'development') {
            appLogger.warn('Performance', `Measure: ${name}`, { duration });
        }

        return duration;
    }

    /**
     * Get all performance data
     */
    getReport(): { marks: PerformanceMark[], measures: PerformanceMark[], totalTime: number } {
        return {
            marks: Array.from(this.marks.values()),
            measures: this.measures,
            totalTime: Date.now() - this.startTime
        };
    }

    /**
     * Log a summary of performance data
     */
    logSummary(): void {
        const report = this.getReport();
        appLogger.warn('Performance', 'Summary', report);
    }

    /**
     * Reset all marks and measures
     */
    reset(): void {
        this.marks.clear();
        this.measures = [];
        this.startTime = Date.now();
    }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();
