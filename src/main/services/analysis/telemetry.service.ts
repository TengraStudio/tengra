import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject } from '@shared/types/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Telemetry error codes for standardized error handling
 */
export enum TelemetryErrorCode {
    TELEMETRY_DISABLED = 'TELEMETRY_DISABLED',
    INVALID_EVENT_NAME = 'INVALID_EVENT_NAME',
    INVALID_PROPERTIES = 'INVALID_PROPERTIES',
    INVALID_BATCH = 'INVALID_BATCH',
    QUEUE_OVERFLOW = 'QUEUE_OVERFLOW',
    FLUSH_FAILED = 'FLUSH_FAILED',
    SETTINGS_ERROR = 'SETTINGS_ERROR'
}

/**
 * Maximum queue size to prevent memory exhaustion
 */
const MAX_QUEUE_SIZE = 10000;

/**
 * Maximum event name length
 */
const MAX_EVENT_NAME_LENGTH = 256;

/**
 * Maximum properties object size (JSON stringified)
 */
const MAX_PROPERTIES_SIZE = 100000; // 100KB

/**
 * Maximum number of events in a single batch
 */
export const MAX_BATCH_SIZE = 500;

/**
 * Performance budgets for telemetry operations (in milliseconds)
 */
export const TELEMETRY_PERFORMANCE_BUDGETS = {
    track: 10,
    flush: 5000,
    initialize: 1000,
    cleanup: 2000
} as const;

/**
 * Health status for telemetry service
 */
export interface TelemetryHealth {
    isHealthy: boolean;
    queueSize: number;
    maxQueueSize: number;
    sessionId: string;
    flushIntervalMs: number;
    telemetryEnabled: boolean;
    lastFlushTime: number | null;
    totalTrackedEvents: number;
    totalFlushedEvents: number;
}

/**
 * Meta-telemetry snapshot for self-monitoring
 */
export interface MetaTelemetrySnapshot {
    flushAttempts: number;
    flushFailures: number;
    budgetExceeded: number;
    overflowDrops: number;
    validationRejects: number;
    lastOperationAt: number | null;
}

export interface TelemetryEvent {
    id: string;
    name: string;
    properties?: Record<string, unknown>;
    timestamp: number;
    sessionId: string;
}

export class TelemetryService extends BaseService {
    private sessionId: string;
    private queue: TelemetryEvent[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private totalTrackedEvents = 0;
    private totalFlushedEvents = 0;
    private lastFlushTime: number | null = null;
    private readonly flushIntervalMs = 60000; // Flush every minute
    private readonly maxQueueSize = MAX_QUEUE_SIZE;

    // Retry configuration
    private readonly maxRetryAttempts = 3;
    private readonly retryDelayMs = 1000;

    // Meta-telemetry counters for self-monitoring
    private metaFlushAttempts = 0;
    private metaFlushFailures = 0;
    private metaBudgetExceeded = 0;
    private metaOverflowDrops = 0;
    private metaValidationRejects = 0;
    private metaLastOperationAt: number | null = null;

    constructor(private settingsService: SettingsService) {
        super('TelemetryService');
        this.sessionId = uuidv4();
    }

    /**
     * Validates event name for security and correctness
     */
    private validateEventName(name: string): { valid: boolean; error?: TelemetryErrorCode } {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: TelemetryErrorCode.INVALID_EVENT_NAME };
        }

        if (name.length === 0 || name.length > MAX_EVENT_NAME_LENGTH) {
            return { valid: false, error: TelemetryErrorCode.INVALID_EVENT_NAME };
        }

        // Check for valid characters (alphanumeric, dots, dashes, underscores)
        if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
            return { valid: false, error: TelemetryErrorCode.INVALID_EVENT_NAME };
        }

        return { valid: true };
    }

    /**
     * Validates properties object size
     */
    private validateProperties(properties: Record<string, unknown> | undefined): { valid: boolean; error?: TelemetryErrorCode } {
        if (!properties) {
            return { valid: true };
        }

        try {
            const size = JSON.stringify(properties).length;
            if (size > MAX_PROPERTIES_SIZE) {
                return { valid: false, error: TelemetryErrorCode.INVALID_PROPERTIES };
            }
        } catch {
            return { valid: false, error: TelemetryErrorCode.INVALID_PROPERTIES };
        }

        return { valid: true };
    }

    /**
     * Gets the current health status of the telemetry service
     */
    getHealth(): TelemetryHealth {
        return {
            isHealthy: this.queue.length < this.maxQueueSize * 0.9,
            queueSize: this.queue.length,
            maxQueueSize: this.maxQueueSize,
            sessionId: this.sessionId,
            flushIntervalMs: this.flushIntervalMs,
            telemetryEnabled: this.isTelemetryEnabled(),
            lastFlushTime: this.lastFlushTime,
            totalTrackedEvents: this.totalTrackedEvents,
            totalFlushedEvents: this.totalFlushedEvents
        };
    }

    /**
     * Gets current queue size
     */
    getQueueSize(): number {
        return this.queue.length;
    }

    /**
     * Gets total tracked events count
     */
    getTotalTrackedEvents(): number {
        return this.totalTrackedEvents;
    }

    /**
     * Gets total flushed events count
     */
    getTotalFlushedEvents(): number {
        return this.totalFlushedEvents;
    }

    /**
     * Gets a snapshot of meta-telemetry counters for self-monitoring
     */
    getMetaTelemetry(): MetaTelemetrySnapshot {
        return {
            flushAttempts: this.metaFlushAttempts,
            flushFailures: this.metaFlushFailures,
            budgetExceeded: this.metaBudgetExceeded,
            overflowDrops: this.metaOverflowDrops,
            validationRejects: this.metaValidationRejects,
            lastOperationAt: this.metaLastOperationAt
        };
    }

    /**
     * Logs a warning if an operation exceeds its performance budget.
     * @param operation - Name of the operation
     * @param durationMs - Actual duration in milliseconds
     * @param budgetMs - Budget threshold in milliseconds
     */
    private checkPerformanceBudget(operation: string, durationMs: number, budgetMs: number): void {
        if (durationMs > budgetMs) {
            this.metaBudgetExceeded++;
            appLogger.warn('TelemetryService', `Performance budget exceeded for ${operation}: ${durationMs.toFixed(2)}ms (budget: ${budgetMs}ms)`);
        }
    }

    override async initialize(): Promise<void> {
        const start = performance.now();
        this.logInfo('Initializing Telemetry Service...');
        this.startFlushing();
        this.checkPerformanceBudget('initialize', performance.now() - start, TELEMETRY_PERFORMANCE_BUDGETS.initialize);
    }

    override async cleanup(): Promise<void> {
        const start = performance.now();
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        await this.flush();
        this.checkPerformanceBudget('cleanup', performance.now() - start, TELEMETRY_PERFORMANCE_BUDGETS.cleanup);
    }

    private isTelemetryEnabled(): boolean {
        const settings = this.settingsService.getSettings();
        const telemetrySettings = settings?.telemetry as { enabled?: boolean } | undefined;
        return telemetrySettings?.enabled ?? false;
    }

    /**
     * Tracks a telemetry event if the user has opted in.
     * @param name - The event name (max 256 chars, alphanumeric, dots, dashes, underscores)
     * @param properties - Optional properties object (max 100KB when stringified)
     */
    track(name: string, properties?: Record<string, unknown>): { success: boolean; error?: TelemetryErrorCode } {
        const start = performance.now();

        if (!this.isTelemetryEnabled()) {
            return { success: false, error: TelemetryErrorCode.TELEMETRY_DISABLED };
        }

        // Validate event name
        const nameValidation = this.validateEventName(name);
        if (!nameValidation.valid) {
            appLogger.warn('Telemetry', 'Invalid event name rejected', { name, error: nameValidation.error });
            return { success: false, error: nameValidation.error };
        }

        // Validate properties
        const propsValidation = this.validateProperties(properties);
        if (!propsValidation.valid) {
            appLogger.warn('Telemetry', 'Invalid properties rejected', { name, error: propsValidation.error });
            return { success: false, error: propsValidation.error };
        }

        // Check queue overflow
        if (this.queue.length >= this.maxQueueSize) {
            appLogger.warn('Telemetry', 'Queue overflow, dropping event', { queueSize: this.queue.length });
            return { success: false, error: TelemetryErrorCode.QUEUE_OVERFLOW };
        }

        const event: TelemetryEvent = {
            id: uuidv4(),
            name,
            properties,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };

        this.queue.push(event);
        this.totalTrackedEvents++;

        // Use logger for debug visibility
        appLogger.debug('Telemetry', `Tracked event: ${name}`, properties as JsonObject);

        this.checkPerformanceBudget('track', performance.now() - start, TELEMETRY_PERFORMANCE_BUDGETS.track);

        return { success: true };
    }

    /**
     * Tracks a batch of telemetry events.
     * Validates the batch size and each individual event before queueing.
     * @param events - Array of events with name and optional properties
     * @returns Result with per-event success/failure details
     */
    trackBatch(
        events: ReadonlyArray<{ name: string; properties?: Record<string, unknown> }>
    ): { success: boolean; error?: TelemetryErrorCode; results?: Array<{ success: boolean; error?: TelemetryErrorCode }> } {
        const start = performance.now();

        if (!Array.isArray(events)) {
            return { success: false, error: TelemetryErrorCode.INVALID_BATCH };
        }

        if (events.length === 0) {
            return { success: false, error: TelemetryErrorCode.INVALID_BATCH };
        }

        if (events.length > MAX_BATCH_SIZE) {
            appLogger.warn('Telemetry', 'Batch too large', { size: events.length, max: MAX_BATCH_SIZE });
            return { success: false, error: TelemetryErrorCode.INVALID_BATCH };
        }

        const results: Array<{ success: boolean; error?: TelemetryErrorCode }> = [];
        let allSucceeded = true;

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const result = this.track(event.name, event.properties);
            results.push(result);
            if (!result.success) {
                allSucceeded = false;
            }
        }

        const durationMs = performance.now() - start;
        const batchBudgetMs = TELEMETRY_PERFORMANCE_BUDGETS.track * events.length;
        this.checkPerformanceBudget('trackBatch', durationMs, batchBudgetMs);

        return { success: allSucceeded, results };
    }

    private startFlushing() {
        this.flushInterval = setInterval(() => { void this.flush(); }, 60000); // Flush every minute
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async flushWithRetry(): Promise<boolean> {
        if (this.queue.length === 0) { return true; }

        const batch = [...this.queue];
        this.queue = [];
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.maxRetryAttempts; attempt++) {
            try {
                // In a real app, this would send to an endpoint (PostHog, Mixpanel, etc.)
                // For now, we simulate processing or logging to a separate file
                // this.logInfo(`Flushed ${batch.length} telemetry events.`);

                this.totalFlushedEvents += batch.length;
                this.lastFlushTime = Date.now();
                return true;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.logWarn(`Flush attempt ${attempt}/${this.maxRetryAttempts} failed`, lastError);

                if (attempt < this.maxRetryAttempts) {
                    await this.sleep(this.retryDelayMs * attempt); // Exponential backoff
                }
            }
        }

        // All retries failed, re-queue with limit to avoid memory leak
        if (lastError) {
            if (this.queue.length + batch.length <= this.maxQueueSize) {
                this.queue = [...batch, ...this.queue];
                this.logError('All flush attempts failed, re-queued events', lastError);
            } else {
                this.logError('Queue full after flush failure, dropping events', lastError);
            }
        }

        return false;
    }

    /**
     * Manually triggers a flush of the telemetry queue
     */
    async flush(): Promise<boolean> {
        const start = performance.now();
        const result = await this.flushWithRetry();
        this.checkPerformanceBudget('flush', performance.now() - start, TELEMETRY_PERFORMANCE_BUDGETS.flush);
        return result;
    }
}
