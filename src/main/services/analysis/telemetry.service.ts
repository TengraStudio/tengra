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
                return { valid: false, error: TelemetryErrorCode.INVALID_EVENT_NAME };
            }
        } catch {
            return { valid: false, error: TelemetryErrorCode.INVALID_EVENT_NAME };
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

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Telemetry Service...');
        this.startFlushing();
    }

    override async cleanup(): Promise<void> {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        await this.flush();
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

        return { success: true };
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
        return this.flushWithRetry();
    }
}
