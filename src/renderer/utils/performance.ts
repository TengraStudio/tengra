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

// Convenience function for timing async operations
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;

    performanceMonitor.mark(startMark);
    try {
        const result = await fn();
        performanceMonitor.mark(endMark);
        performanceMonitor.measure(name, startMark, endMark);
        return result;
    } catch (error) {
        performanceMonitor.mark(endMark);
        performanceMonitor.measure(`${name} (failed)`, startMark, endMark);
        throw error;
    }
}

// React hook for component render timing
export function useRenderTiming(componentName: string): void {
    const startTime = Date.now();

    // Use useEffect to mark when component is mounted
    if (typeof window !== 'undefined') {
        setTimeout(() => {
            const renderTime = Date.now() - startTime;
            if (process.env.NODE_ENV === 'development' && renderTime > 100) {
                appLogger.warn('Performance', `Slow render: ${componentName} took ${renderTime}ms`);
            }
        }, 0);
    }
}
