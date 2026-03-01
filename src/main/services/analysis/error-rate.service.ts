/**
 * Error Rate Monitoring Service (IDEA-065)
 * Tracks errors per service per 5-minute window and emits warnings via EventBus.
 */

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import type { EventBusService } from '@main/services/system/event-bus.service';

/** Error rate data for a single service within a window */
export interface ServiceErrorRate {
    service: string;
    errorCount: number;
    windowStartMs: number;
    windowEndMs: number;
}

/** Threshold configuration */
const ERROR_THRESHOLD = 10;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TRACKED_SERVICES = 200;

/** Internal entry for tracking timestamps per service */
interface ServiceErrorEntry {
    timestamps: number[];
    lastAlertAt: number;
}

/**
 * Monitors error rates per service and emits warnings when thresholds are exceeded.
 */
export class ErrorRateService extends BaseService {
    private serviceErrors = new Map<string, ServiceErrorEntry>();
    private eventBus: EventBusService | null = null;

    constructor() {
        super('ErrorRateService');
    }

    /**
     * Sets the EventBus for emitting threshold warnings.
     * @param eventBus - The EventBusService instance.
     */
    setEventBus(eventBus: EventBusService): void {
        this.eventBus = eventBus;
    }

    /**
     * Records an error for a given service context.
     * @param service - The service name where the error occurred.
     */
    recordError(service: string): void {
        const now = Date.now();

        if (!this.serviceErrors.has(service) && this.serviceErrors.size >= MAX_TRACKED_SERVICES) {
            return;
        }

        if (!this.serviceErrors.has(service)) {
            this.serviceErrors.set(service, { timestamps: [], lastAlertAt: 0 });
        }

        const entry = this.serviceErrors.get(service);
        if (!entry) { return; }
        entry.timestamps.push(now);

        // Trim old entries outside window
        const cutoff = now - WINDOW_MS;
        entry.timestamps = entry.timestamps.filter(t => t >= cutoff);

        if (entry.timestamps.length >= ERROR_THRESHOLD && now - entry.lastAlertAt > WINDOW_MS) {
            entry.lastAlertAt = now;
            const msg = `Error rate exceeded for ${service}: ${entry.timestamps.length} errors in 5min`;
            appLogger.warn('ErrorRateService', msg);
            this.eventBus?.emitCustom('error-rate:threshold-exceeded', {
                service,
                errorCount: entry.timestamps.length,
                windowMs: WINDOW_MS,
                timestamp: now,
            });
        }
    }

    /**
     * Gets the current error rates for all tracked services.
     * @returns Array of error rate data per service.
     */
    getErrorRates(): ServiceErrorRate[] {
        const now = Date.now();
        const cutoff = now - WINDOW_MS;
        const result: ServiceErrorRate[] = [];

        for (const [service, entry] of this.serviceErrors) {
            const recent = entry.timestamps.filter(t => t >= cutoff);
            result.push({
                service,
                errorCount: recent.length,
                windowStartMs: cutoff,
                windowEndMs: now,
            });
        }

        return result;
    }

    async cleanup(): Promise<void> {
        this.serviceErrors.clear();
        this.logInfo('Cleaned up error rate tracking');
    }
}

// Singleton
let instance: ErrorRateService | null = null;

/** Gets the singleton ErrorRateService instance. */
export function getErrorRateService(): ErrorRateService {
    instance ??= new ErrorRateService();
    return instance;
}
