import { LifecycleAware } from '@main/core/container';

/**
 * Abstract base class for all application services.
 * Enforces the LifecycleAware interface for consistent initialization and cleanup.
 */
export abstract class BaseService implements LifecycleAware {
    constructor(protected readonly name: string) { }

    /**
     * Initialize the service.
     * Override this method to perform async setup (DB connection, file loading, etc).
     */
    async initialize(): Promise<void> {
        // Optional override
    }

    /**
     * Cleanup the service.
     * Override this method to perform resource release (closing sockets, saving state, etc).
     */
    async cleanup(): Promise<void> {
        // Optional override
    }

    protected logInfo(message: string, ...args: unknown[]): void {
        console.log(`[${this.name}] ${message}`, ...args);
    }

    protected logError(message: string, error?: unknown): void {
        console.error(`[${this.name}] ${message}`, error);
    }

    protected logWarn(message: string, ...args: unknown[]): void {
        console.warn(`[${this.name}] ${message}`, ...args);
    }
}
