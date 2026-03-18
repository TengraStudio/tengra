import { EventEmitter } from 'events';

import { CircuitBreaker } from '@main/core/circuit-breaker';
import { BaseService } from '@main/services/base.service';
import { REQUEST_TIMEOUTS } from '@shared/constants/timeouts';
import { getErrorMessage } from '@shared/utils/error.util';

export interface OllamaStatus {
    online: boolean
    lastCheck: Date
    version?: string
    modelsCount?: number
    error?: string
}

export class OllamaHealthService extends BaseService {
    private intervalId: NodeJS.Timeout | null = null;
    private status: OllamaStatus = { online: false, lastCheck: new Date() };
    private baseUrl: string = 'http://127.0.0.1:11434';
    private checkInterval: number = 30000; // 30 seconds
    private events = new EventEmitter();
    /** Lock to prevent concurrent health checks (race condition fix) */
    private isChecking: boolean = false;
    /** Debounce timer for rapid check requests */
    private lastCheckTime: number = 0;
    private readonly minCheckIntervalMs: number = 2000; // Minimum 2s between checks
    /** Circuit breaker for Ollama health check requests */
    private circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
        serviceName: 'OllamaHealth'
    });

    constructor(baseUrl?: string) {
        super('OllamaHealthService');
        if (baseUrl) { this.baseUrl = baseUrl; }
        this.logInfo('Service initialized');
    }

    on(event: string | symbol, listener: (...args: RuntimeValue[]) => void): this {
        this.events.on(event, listener);
        return this;
    }

    emit(event: string | symbol, ...args: RuntimeValue[]): boolean {
        return this.events.emit(event, ...args);
    }

    setBaseUrl(url: string) {
        this.baseUrl = url;
        this.logInfo(`Base URL updated: ${url}`);
    }

    getStatus(): OllamaStatus {
        return { ...this.status };
    }

    async initialize(): Promise<void> {
        this.start();
    }

    async cleanup(): Promise<void> {
        this.stop();
        this.events.removeAllListeners();
    }

    start() {
        if (this.intervalId) {
            this.logInfo('Already running');
            return;
        }

        this.logInfo('Starting health checks...');

        // Initial check
        void this.checkHealth();

        // Periodic checks
        this.intervalId = setInterval(() => {
            void this.checkHealth();
        }, this.checkInterval);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.logInfo('Stopped health checks');
        }
    }

    async checkHealth(): Promise<OllamaStatus> {
        // Prevent race condition: skip if already checking
        if (this.isChecking) {
            this.logInfo('Health check already in progress, skipping');
            return this.status;
        }

        // Debounce: skip if checked recently
        const now = Date.now();
        if (now - this.lastCheckTime < this.minCheckIntervalMs) {
            this.logInfo('Health check debounced, returning cached status');
            return this.status;
        }

        this.isChecking = true;
        this.lastCheckTime = now;
        const wasOnline = this.status.online;

        try {
            // Try to get Ollama version/tags
            const response = await this.circuitBreaker.execute(async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUTS.HEALTH_CHECK);
                try {
                    const res = await fetch(`${this.baseUrl}/api/tags`, {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    return res;
                } catch (err) {
                    clearTimeout(timeoutId);
                    throw err;
                }
            });

            if (response.ok) {
                const data = await response.json() as { models?: RuntimeValue[] };
                const modelsCount = data.models?.length ?? 0;

                this.status = {
                    online: true,
                    lastCheck: new Date(),
                    modelsCount,
                    version: 'connected'
                };

                // Emit event if status changed
                if (!wasOnline) {
                    this.logInfo('Server came online');
                    this.emit('online', this.status);
                    this.emit('statusChange', this.status);
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            const errorMsg = getErrorMessage(error as Error);
            this.status = {
                online: false,
                lastCheck: new Date(),
                error: errorMsg
            };

            // Emit event if status changed
            if (wasOnline) {
                this.logInfo(`Server went offline: ${errorMsg}`);
                this.emit('offline', this.status);
                this.emit('statusChange', this.status);
            }
        } finally {
            this.isChecking = false;
        }

        return this.status;
    }

    // Force an immediate check (bypasses debounce but not the lock)
    async forceCheck(): Promise<OllamaStatus> {
        // Reset debounce timer for forced checks
        this.lastCheckTime = 0;
        return this.checkHealth();
    }
}

// Singleton instance
let instance: OllamaHealthService | null = null;

export function getOllamaHealthService(baseUrl?: string): OllamaHealthService {
    if (!instance) {
        instance = new OllamaHealthService(baseUrl);
    } else if (baseUrl) {
        instance.setBaseUrl(baseUrl);
    }
    return instance;
}
