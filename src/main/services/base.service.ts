import { LifecycleAware } from '@main/core/container';
import { appLogger } from '@main/logging/logger';
import { AppError, JsonValue } from '@shared/types/common';

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

    protected logInfo(message: string, ...args: (JsonValue | Error | AppError | undefined)[]): void {
        appLogger.info(this.name, message, ...args);
    }

    protected logError(message: string, error?: unknown): void {
        appLogger.error(this.name, message, error as Error);
    }

    protected logWarn(message: string, ...args: (JsonValue | Error | AppError | undefined)[]): void {
        appLogger.warn(this.name, message, ...args);
    }

    protected logDebug(message: string, ...args: (JsonValue | Error | AppError | undefined)[]): void {
        appLogger.debug(this.name, message, ...args);
    }
}
