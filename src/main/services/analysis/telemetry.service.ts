import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { PowerManagerService } from '@main/services/system/power-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { UtilityProcessService } from '@main/services/system/utility-process.service';
import { getBundledUtilityWorkerPath } from '@main/services/system/utility-worker-path.util';
import { withRetry } from '@main/utils/retry.util';
import { RETRY_DEFAULTS } from '@shared/constants/defaults';
import { JsonObject } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
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
    properties?: Record<string, RuntimeValue>;
    timestamp: number;
    sessionId: string;
}

export class TelemetryService extends BaseService {
    private static readonly FLUSH_JOB_ID = 'telemetry:flush';
    private static readonly WORKER_FILE_NAME = 'telemetry.worker.cjs';
    private sessionId: string;
    private queue: TelemetryEvent[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private totalTrackedEvents = 0;
    private totalFlushedEvents = 0;
    private lastFlushTime: number | null = null;
    private workerProcessId: string | null = null;
    private workerQueueSize = 0;
    private readonly flushIntervalMs = 60000; // Flush every minute
    private readonly maxQueueSize = MAX_QUEUE_SIZE;

    // Retry configuration
    private readonly maxRetryAttempts = RETRY_DEFAULTS.MAX_ATTEMPTS;
    private readonly retryDelayMs = RETRY_DEFAULTS.BASE_DELAY_MS;

    // Meta-telemetry counters for self-monitoring
    private metaFlushAttempts = 0;
    private metaFlushFailures = 0;
    private metaBudgetExceeded = 0;
    private metaOverflowDrops = 0;
    private metaValidationRejects = 0;
    private metaLastOperationAt: number | null = null;
    private readonly settingsService: SettingsService;
    private readonly powerManager: PowerManagerService;
    private readonly eventBus: EventBusService;
    private readonly jobScheduler?: JobSchedulerService;
    private readonly utilityProcessService?: UtilityProcessService;

    constructor(
        settingsService?: SettingsService,
        powerManager?: PowerManagerService,
        eventBus?: EventBusService,
        jobScheduler?: JobSchedulerService,
        utilityProcessService?: UtilityProcessService
    ) {
        super('TelemetryService');
        this.eventBus = eventBus ?? new EventBusService();
        this.settingsService = settingsService ?? this.createFallbackSettingsService();
        this.powerManager = powerManager ?? this.createFallbackPowerManager();
        this.jobScheduler = jobScheduler;
        this.utilityProcessService = utilityProcessService;
        this.sessionId = uuidv4();
    }

    private createFallbackSettingsService(): SettingsService {
        return {
            getSettings: () => ({}),
        } as SettingsService;
    }

    private createFallbackPowerManager(): PowerManagerService {
        return new PowerManagerService(this.settingsService, this.eventBus);
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
    private validateProperties(properties: Record<string, RuntimeValue> | undefined): { valid: boolean; error?: TelemetryErrorCode } {
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
        const queueSize = this.getTrackedQueueSize();
        return {
            isHealthy: queueSize < this.maxQueueSize * 0.9,
            queueSize,
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
        return this.getTrackedQueueSize();
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
        await this.startWorkerIfAvailable();
        this.startFlushing();

        this.checkPerformanceBudget('initialize', performance.now() - start, TELEMETRY_PERFORMANCE_BUDGETS.initialize);
    }

    override async cleanup(): Promise<void> {
        const start = performance.now();
        this.jobScheduler?.unregisterRecurringJob(TelemetryService.FLUSH_JOB_ID);
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        await this.flush();
        if (this.workerProcessId && this.utilityProcessService) {
            this.utilityProcessService.terminate(this.workerProcessId);
            this.workerProcessId = null;
            this.workerQueueSize = 0;
        }
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
    track(name: string, properties?: Record<string, RuntimeValue>): { success: boolean; error?: TelemetryErrorCode } {
        const start = performance.now();

        if (!this.isTelemetryEnabled()) {
            return { success: false, error: TelemetryErrorCode.TELEMETRY_DISABLED };
        }

        // Validate event name
        const nameValidation = this.validateEventName(name);
        if (!nameValidation.valid) {
            this.metaValidationRejects++;
            appLogger.warn('Telemetry', 'Invalid event name rejected', { name, error: nameValidation.error });
            return { success: false, error: nameValidation.error };
        }

        // Validate properties
        const propsValidation = this.validateProperties(properties);
        if (!propsValidation.valid) {
            this.metaValidationRejects++;
            appLogger.warn('Telemetry', 'Invalid properties rejected', { name, error: propsValidation.error });
            return { success: false, error: propsValidation.error };
        }

        // Check queue overflow
        if (this.getTrackedQueueSize() >= this.maxQueueSize) {
            this.metaOverflowDrops++;
            appLogger.warn('Telemetry', 'Queue overflow, dropping event', { queueSize: this.getTrackedQueueSize() });
            return { success: false, error: TelemetryErrorCode.QUEUE_OVERFLOW };
        }

        const event: TelemetryEvent = {
            id: uuidv4(),
            name,
            properties,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };

        this.enqueueTelemetryEvent(event);
        this.totalTrackedEvents++;
        this.metaLastOperationAt = Date.now();

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
        events: ReadonlyArray<{ name: string; properties?: Record<string, RuntimeValue> }>
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

    private getTrackedQueueSize(): number {
        return this.workerProcessId ? this.workerQueueSize : this.queue.length;
    }

    private enqueueTelemetryEvent(event: TelemetryEvent): void {
        if (!this.workerProcessId || !this.utilityProcessService) {
            this.queue.push(event);
            return;
        }

        this.workerQueueSize += 1;
        this.utilityProcessService.postMessage(this.workerProcessId, {
            type: 'telemetry.track',
            payload: { event },
        });
    }

    private async startWorkerIfAvailable(): Promise<void> {
        if (!this.utilityProcessService || this.workerProcessId) {
            return;
        }

        try {
            this.workerProcessId = this.utilityProcessService.spawn({
                name: 'telemetry-worker',
                entryPoint: getBundledUtilityWorkerPath(TelemetryService.WORKER_FILE_NAME),
            });
            this.workerQueueSize = 0;

            if (this.queue.length > 0) {
                await this.utilityProcessService.request(this.workerProcessId, 'telemetry.track', {
                    events: [...this.queue],
                });
                this.workerQueueSize = this.queue.length;
                this.queue = [];
            }
        } catch (error) {
            this.workerProcessId = null;
            this.workerQueueSize = 0;
            appLogger.warn(
                'TelemetryService',
                `Falling back to main-process telemetry queue: ${getErrorMessage(error as Error)}`
            );
        }
    }

    private readWorkerFlushedCount(response: RuntimeValue): number {
        if (typeof response !== 'object' || response === null || !('flushedCount' in response)) {
            return 0;
        }
        const flushedCount = (response as { flushedCount?: RuntimeValue }).flushedCount;
        return typeof flushedCount === 'number' ? flushedCount : 0;
    }

    private readWorkerQueueSize(response: RuntimeValue): number {
        if (typeof response !== 'object' || response === null || !('state' in response)) {
            return 0;
        }
        const state = (response as { state?: RuntimeValue }).state;
        if (typeof state !== 'object' || state === null || !('queueSize' in state)) {
            return 0;
        }
        const queueSize = (state as { queueSize?: RuntimeValue }).queueSize;
        return typeof queueSize === 'number' ? queueSize : 0;
    }

    private readWorkerLastFlushTime(response: RuntimeValue): number {
        if (typeof response !== 'object' || response === null || !('state' in response)) {
            return Date.now();
        }
        const state = (response as { state?: RuntimeValue }).state;
        if (typeof state !== 'object' || state === null || !('lastFlushTime' in state)) {
            return Date.now();
        }
        const lastFlushTime = (state as { lastFlushTime?: RuntimeValue }).lastFlushTime;
        return typeof lastFlushTime === 'number' ? lastFlushTime : Date.now();
    }

    private startFlushing() {
        if (this.jobScheduler) {
            this.jobScheduler.registerRecurringJob(
                TelemetryService.FLUSH_JOB_ID,
                async () => {
                    await this.flush();
                },
                () => this.getFlushIntervalMs(),
                {
                    persistState: false,
                    runOnStart: false,
                }
            );
            return;
        }

        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        this.flushInterval = setInterval(() => {
            void this.flush();
        }, this.getFlushIntervalMs());
    }

    private getFlushIntervalMs(): number {
        return this.powerManager.isLowPowerMode() ? 300000 : this.flushIntervalMs;
    }

    private async flushWithRetry(): Promise<boolean> {
        if (this.getTrackedQueueSize() === 0) { return true; }

        this.metaFlushAttempts++;
        const batch = [...this.queue];
        this.queue = [];

        try {
            await withRetry(
                async () => {
                    if (this.workerProcessId && this.utilityProcessService) {
                        const result = await this.utilityProcessService.request(
                            this.workerProcessId,
                            'telemetry.flush'
                        );
                        const flushedCount = this.readWorkerFlushedCount(result);
                        this.totalFlushedEvents += flushedCount;
                        this.lastFlushTime = this.readWorkerLastFlushTime(result);
                        this.workerQueueSize = this.readWorkerQueueSize(result);
                        this.metaLastOperationAt = Date.now();
                        return;
                    }

                    // In a real app, this would send to an endpoint (PostHog, Mixpanel, etc.)
                    this.totalFlushedEvents += batch.length;
                    this.lastFlushTime = Date.now();
                    this.metaLastOperationAt = Date.now();
                },
                {
                    maxRetries: this.maxRetryAttempts - 1,
                    baseDelayMs: this.retryDelayMs,
                    shouldRetry: () => true,
                    onRetry: (_err, attempt) => {
                        this.logWarn(`Flush attempt ${attempt + 1}/${this.maxRetryAttempts} failed`);
                    }
                }
            );
            return true;
        } catch (error) {
            // All retries failed
            this.metaFlushFailures++;
            const lastError = error instanceof Error ? error : new Error(String(error));
            if (!this.workerProcessId && this.queue.length + batch.length <= this.maxQueueSize) {
                this.queue = [...batch, ...this.queue];
                this.logError('All flush attempts failed, re-queued events', lastError);
            } else {
                this.logError('Queue full after flush failure, dropping events', lastError);
            }
            return false;
        }
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
