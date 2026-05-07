/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@system/utils/renderer-logger';

/**
 * Performance monitoring utility for tracking app startup and render times
 */

interface PerformanceMark {
    name: string;
    timestamp: number;
    duration?: number;
}

interface TengraPerformanceBridge {
    mark: (name: string) => void;
    measure: (name: string, startMark: string, endMark: string) => number | null;
    hasMark: (name: string) => boolean;
    clear: (prefix?: string) => void;
    getReport: () => { marks: PerformanceMark[]; measures: PerformanceMark[]; totalTime: number };
}

declare global {
    interface Window {
        __TENGRA_PERFORMANCE__?: TengraPerformanceBridge;
    }
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

    hasMark(name: string): boolean {
        return this.marks.has(name);
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

    clear(prefix?: string): void {
        if (!prefix) {
            this.reset();
            return;
        }

        for (const key of this.marks.keys()) {
            if (key.startsWith(prefix)) {
                this.marks.delete(key);
            }
        }

        this.measures = this.measures.filter(measure => !measure.name.startsWith(prefix));
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

if (typeof window !== 'undefined') {
    window.__TENGRA_PERFORMANCE__ = {
        mark: name => performanceMonitor.mark(name),
        measure: (name, startMark, endMark) =>
            performanceMonitor.measure(name, startMark, endMark),
        hasMark: name => performanceMonitor.hasMark(name),
        clear: prefix => performanceMonitor.clear(prefix),
        getReport: () => performanceMonitor.getReport(),
    };
}

