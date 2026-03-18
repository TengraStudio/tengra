/**
 * @fileoverview Telemetry events and health monitoring for Model Selector Modal
 * @description Provides metrics collection, health dashboards, and observability
 */

import { appLogger } from "@main/logging/logger";

/**
 * Telemetry event names for model selector
 */
export const TelemetryEvents = {
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

    // Modal events
    MODAL_OPENED: 'model_selector:modal_opened',
    MODAL_CLOSED: 'model_selector:modal_closed',
    MODAL_ESCAPE_PRESSED: 'model_selector:modal_escape_pressed',
    MODAL_BACKDROP_CLICKED: 'model_selector:modal_backdrop_clicked',

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

export type TelemetryEventName = typeof TelemetryEvents[keyof typeof TelemetryEvents];

/**
 * Telemetry event payload types
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

export interface ModalOpenedPayload {
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
 * Union type for all telemetry payloads
 */
export type TelemetryPayload =
    | ModelSelectedPayload
    | SearchPerformedPayload
    | ReasoningLevelSelectedPayload
    | ModalOpenedPayload
    | ErrorPayload
    | PerformancePayload
    | Record<string, RendererDataValue>;

/**
 * Telemetry event interface
 */
export interface TelemetryEvent {
    name: TelemetryEventName;
    timestamp: number;
    payload?: TelemetryPayload;
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
 * Telemetry collector for model selector
 */
export class ModelSelectorTelemetry {
    private events: TelemetryEvent[] = [];
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
     * Records a telemetry event
     */
    recordEvent(name: TelemetryEventName, payload?: TelemetryPayload): void {
        const event: TelemetryEvent = {
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
    private logEvent(event: TelemetryEvent): void {
        if (process.env.NODE_ENV === 'development') {
            appLogger.debug(`[Telemetry] ${event.name}`, JSON.stringify(event.payload ?? ''));
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

        this.recordEvent(TelemetryEvents.RENDER_TIME, {
            durationMs,
            operation,
            metadata,
        });

        return durationMs;
    }

    /**
     * Gets all events for the current session
     */
    getEvents(): TelemetryEvent[] {
        return [...this.events];
    }

    /**
     * Gets events by name
     */
    getEventsByName(name: TelemetryEventName): TelemetryEvent[] {
        return this.events.filter(e => e.name === name);
    }

    /**
     * Calculates health status
     */
    getHealthStatus(): HealthStatus {
        const renderEvents = this.getEventsByName(TelemetryEvents.RENDER_TIME);
        const searchEvents = this.getEventsByName(TelemetryEvents.SEARCH_PERFORMED);
        const errorEvents = [
            ...this.getEventsByName(TelemetryEvents.SELECTION_ERROR),
            ...this.getEventsByName(TelemetryEvents.VALIDATION_ERROR),
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
 * Global telemetry instance
 */
let globalTelemetry: ModelSelectorTelemetry | undefined;

/**
 * Gets the global telemetry instance
 */
export function getTelemetry(): ModelSelectorTelemetry {
    if (globalTelemetry === undefined) {
        globalTelemetry = new ModelSelectorTelemetry();
    }
    return globalTelemetry;
}

/**
 * Resets the global telemetry instance
 */
export function resetTelemetry(): void {
    globalTelemetry = new ModelSelectorTelemetry();
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
    getTelemetry().recordEvent(TelemetryEvents.MODEL_SELECTED, {
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
    getTelemetry().recordEvent(TelemetryEvents.SEARCH_PERFORMED, {
        query,
        resultCount,
        latencyMs,
    });
}

/**
 * Convenience function to record an error event
 */
export function recordError(code: string, message: string, context?: Record<string, RendererDataValue>): void {
    getTelemetry().recordEvent(TelemetryEvents.SELECTION_ERROR, {
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
    const telemetry = getTelemetry();
    const status = telemetry.getHealthStatus();
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
