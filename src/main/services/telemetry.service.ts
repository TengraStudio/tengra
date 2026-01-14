import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/settings.service';
import { v4 as uuidv4 } from 'uuid';

export interface TelemetryEvent {
    id: string;
    name: string;
    properties?: Record<string, any>;
    timestamp: number;
    sessionId: string;
}

export class TelemetryService extends BaseService {
    private sessionId: string;
    private queue: TelemetryEvent[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor(private settingsService: SettingsService) {
        super('TelemetryService');
        this.sessionId = uuidv4();
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
     */
    track(name: string, properties?: Record<string, any>) {
        if (!this.isTelemetryEnabled()) {
            return;
        }

        const event: TelemetryEvent = {
            id: uuidv4(),
            name,
            properties,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };

        this.queue.push(event);

        // Use logger for debug visibility
        appLogger.debug('Telemetry', `Tracked event: ${name}`, properties);
    }

    private startFlushing() {
        this.flushInterval = setInterval(() => this.flush(), 60000); // Flush every minute
    }

    private async flush() {
        if (this.queue.length === 0) {return;}

        const batch = [...this.queue];
        this.queue = [];

        try {
            // In a real app, this would send to an endpoint (PostHog, Mixpanel, etc.)
            // For now, we simulate processing or logging to a separate file
            // this.logInfo(`Flushed ${batch.length} telemetry events.`); 
        } catch (error) {
            // If flush fails, re-queue (with limit to avoid memory leak)
            if (this.queue.length < 1000) {
                this.queue = [...batch, ...this.queue];
            }
            this.logError('Failed to flush telemetry events', error);
        }
    }
}
