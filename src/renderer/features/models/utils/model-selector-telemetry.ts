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
 * @fileoverview usageStats events and health monitoring for Model Selector Popover
 * @description Provides metrics collection, health dashboards, and observability
 */

import { appLogger } from "@/utils/renderer-logger";

/**
 * usageStats event names for model selector
 */
export const UsageStatsEvents = {
    // Model selection events
    MODEL_SELECTED: 'model_selector:model_selected',
    MODEL_DESELECTED: 'model_selector:model_deselected',
    MULTI_SELECT_ENABLED: 'model_selector:multi_select_enabled',

    // Search events
    SEARCH_PERFORMED: 'model_selector:search_performed',
    SEARCH_CLEARED: 'model_selector:search_cleared',
    SEARCH_RESULT_COUNT: 'model_selector:search_result_count',

    // Reasoning events
    REASONING_LEVEL_SELECTED: 'model_selector:reasoning_level_selected',
    REASONING_TAB_OPENED: 'model_selector:reasoning_tab_opened',

    // Popover events
    POPOVER_OPENED: 'model_selector:popover_opened',
    POPOVER_CLOSED: 'model_selector:popover_closed',
    POPOVER_ESCAPE_PRESSED: 'model_selector:popover_escape_pressed',
    POPOVER_BACKDROP_CLICKED: 'model_selector:popover_backdrop_clicked',

    // Error events
    SELECTION_ERROR: 'model_selector:selection_error',
    VALIDATION_ERROR: 'model_selector:validation_error',

    // Performance events
    RENDER_TIME: 'model_selector:render_time',
    SEARCH_LATENCY: 'model_selector:search_latency',
    CATEGORY_LOAD_TIME: 'model_selector:category_load_time',

    // User interaction events
    FAVORITE_TOGGLED: 'model_selector:favorite_toggled',
    CHAT_MODE_CHANGED: 'model_selector:chat_mode_changed',
    RECENT_MODEL_SELECTED: 'model_selector:recent_model_selected',
} as const;

export type UsageStatsEventName = typeof UsageStatsEvents[keyof typeof UsageStatsEvents];

/**
 * usageStats event payload types
 */
export interface ModelSelectedPayload {
    modelId: string;
    provider: string;
    hasThinkingLevels: boolean;
    selectionMethod: 'click' | 'keyboard' | 'recent';
}

export interface SearchPerformedPayload {
    query: string;
    resultCount: number;
    latencyMs: number;
}

export interface ReasoningLevelSelectedPayload {
    modelId: string;
    level: string;
}

export interface PopoverOpenedPayload {
    previousModel: string;
    categoryCount: number;
    modelCount: number;
}

export interface ErrorPayload {
    code: string;
    message: string;
    context?: Record<string, RendererDataValue>;
}

export interface PerformancePayload {
    durationMs: number;
    operation: string;
    metadata?: Record<string, RendererDataValue>;
}

/**
 * Union type for all usageStats payloads
 */
export type usageStatsPayload =
    | ModelSelectedPayload
    | SearchPerformedPayload
    | ReasoningLevelSelectedPayload
    | PopoverOpenedPayload
    | ErrorPayload
    | PerformancePayload
    | Record<string, RendererDataValue>;

/**
 * usageStats event interface
 */
export interface UsageStatsEvent {
    name: UsageStatsEventName;
    timestamp: number;
    payload?: usageStatsPayload;
    sessionId: string;
}

/**
 * Health status for model selector
 */
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
        averageRenderTime: number;
        averageSearchLatency: number;
        errorRate: number;
        lastError?: ErrorPayload;
    };
    lastUpdated: number;
}

/**
 * usageStats collector for model selector
 */
export class ModelSelectorusageStats {
    private events: UsageStatsEvent[] = [];
    private sessionId: string;
    private maxEvents: number = 1000;
    private performanceMarks: Map<string, number> = new Map();

    constructor() {
        this.sessionId = this.generateSessionId();
    }

    /**
     * Generates a unique session ID
     */
    private generateSessionId(): string {
        return `ms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Records a usageStats event
     */
    recordEvent(name: UsageStatsEventName, payload?: usageStatsPayload): void {
        const event: UsageStatsEvent = {
            name,
            timestamp: Date.now(),
            payload,
            sessionId: this.sessionId,
        };

        this.events.push(event);

        // Trim events if exceeding max
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        // Log to console in development
        this.logEvent(event);
    }

    /**
     * Logs event to console (development only)
     */
    private logEvent(event: UsageStatsEvent): void {
        if (process.env.NODE_ENV === 'development') {
            appLogger.debug(`[usageStats] ${event.name}`, JSON.stringify(event.payload ?? ''));
        }
    }

    /**
     * Starts a performance measurement
     */
    startPerformanceMark(operation: string): void {
        this.performanceMarks.set(operation, performance.now());
    }

    /**
     * Ends a performance measurement and records the event
     */
    endPerformanceMark(operation: string, metadata?: Record<string, RendererDataValue>): number {
        const startTime = this.performanceMarks.get(operation);
        if (startTime === undefined) {
            return 0;
        }

        const durationMs = performance.now() - startTime;
        this.performanceMarks.delete(operation);

        this.recordEvent(UsageStatsEvents.RENDER_TIME, {
            durationMs,
            operation,
            metadata,
        });

        return durationMs;
    }

    /**
     * Gets all events for the current session
     */
    getEvents(): UsageStatsEvent[] {
        return [...this.events];
    }

    /**
     * Gets events by name
     */
    getEventsByName(name: UsageStatsEventName): UsageStatsEvent[] {
        return this.events.filter(e => e.name === name);
    }

    /**
     * Calculates health status
     */
    getHealthStatus(): HealthStatus {
        const renderEvents = this.getEventsByName(UsageStatsEvents.RENDER_TIME);
        const searchEvents = this.getEventsByName(UsageStatsEvents.SEARCH_PERFORMED);
        const errorEvents = [
            ...this.getEventsByName(UsageStatsEvents.SELECTION_ERROR),
            ...this.getEventsByName(UsageStatsEvents.VALIDATION_ERROR),
        ];

        const averageRenderTime = this.calculateAverage(
            renderEvents.map(e => (e.payload as PerformancePayload)?.durationMs ?? 0)
        );

        const averageSearchLatency = this.calculateAverage(
            searchEvents.map(e => (e.payload as SearchPerformedPayload)?.latencyMs ?? 0)
        );

        const totalOperations = this.events.length;
        const errorRate = totalOperations > 0 ? errorEvents.length / totalOperations : 0;

        const lastError = errorEvents.length > 0
            ? (errorEvents[errorEvents.length - 1]?.payload as ErrorPayload)
            : undefined;

        let status: HealthStatus['status'] = 'healthy';
        if (errorRate > 0.1 || averageRenderTime > 500) {
            status = 'degraded';
        }
        if (errorRate > 0.3 || averageRenderTime > 1000) {
            status = 'unhealthy';
        }

        return {
            status,
            metrics: {
                averageRenderTime,
                averageSearchLatency,
                errorRate,
                lastError,
            },
            lastUpdated: Date.now(),
        };
    }

    /**
     * Calculates average of numbers
     */
    private calculateAverage(values: number[]): number {
        if (values.length === 0) {
            return 0;
        }
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    /**
     * Clears all events
     */
    clearEvents(): void {
        this.events = [];
        this.performanceMarks.clear();
    }

    /**
     * Gets the current session ID
     */
    getSessionId(): string {
        return this.sessionId;
    }
}

/**
 * Global usageStats instance
 */
let globalusageStats: ModelSelectorusageStats | undefined;

/**
 * Gets the global usageStats instance
 */
export function getusageStats(): ModelSelectorusageStats {
    if (globalusageStats === undefined) {
        globalusageStats = new ModelSelectorusageStats();
    }
    return globalusageStats;
}

/**
 * Resets the global usageStats instance
 */
export function resetusageStats(): void {
    globalusageStats = new ModelSelectorusageStats();
}

/**
 * Convenience function to record a model selection event
 */
export function recordModelSelection(
    modelId: string,
    provider: string,
    hasThinkingLevels: boolean,
    selectionMethod: 'click' | 'keyboard' | 'recent' = 'click'
): void {
    getusageStats().recordEvent(UsageStatsEvents.MODEL_SELECTED, {
        modelId,
        provider,
        hasThinkingLevels,
        selectionMethod,
    });
}

/**
 * Convenience function to record a search event
 */
export function recordSearch(query: string, resultCount: number, latencyMs: number): void {
    getusageStats().recordEvent(UsageStatsEvents.SEARCH_PERFORMED, {
        query,
        resultCount,
        latencyMs,
    });
}

/**
 * Convenience function to record an error event
 */
export function recordError(code: string, message: string, context?: Record<string, RendererDataValue>): void {
    getusageStats().recordEvent(UsageStatsEvents.SELECTION_ERROR, {
        code,
        message,
        context,
    });
}

/**
 * Performance thresholds for health monitoring
 */
export const PerformanceThresholds = {
    renderTime: {
        healthy: 100, // ms
        degraded: 500, // ms
        unhealthy: 1000, // ms
    },
    searchLatency: {
        healthy: 50, // ms
        degraded: 200, // ms
        unhealthy: 500, // ms
    },
    errorRate: {
        healthy: 0.01, // 1%
        degraded: 0.1, // 10%
        unhealthy: 0.3, // 30%
    },
} as const;

/**
 * Evaluates a metric against thresholds
 */
export function evaluateMetric(
    value: number,
    thresholds: typeof PerformanceThresholds.renderTime
): 'healthy' | 'degraded' | 'unhealthy' {
    if (value <= thresholds.healthy) {
        return 'healthy';
    }
    if (value <= thresholds.degraded) {
        return 'degraded';
    }
    return 'unhealthy';
}

/**
 * Creates a health report for the model selector
 */
export function createHealthReport(): {
    status: HealthStatus;
    recommendations: string[];
} {
    const usageStats = getusageStats();
    const status = usageStats.getHealthStatus();
    const recommendations: string[] = [];

    if (status.metrics.averageRenderTime > PerformanceThresholds.renderTime.degraded) {
        recommendations.push('Consider optimizing render performance by reducing category count or implementing virtualization.');
    }

    if (status.metrics.averageSearchLatency > PerformanceThresholds.searchLatency.degraded) {
        recommendations.push('Search latency is high. Consider implementing search debouncing or caching.');
    }

    if (status.metrics.errorRate > PerformanceThresholds.errorRate.degraded) {
        recommendations.push('Error rate is elevated. Review recent errors and implement additional validation.');
    }

    return {
        status,
        recommendations,
    };
}

